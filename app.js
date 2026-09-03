/* =============================================
   Shields SVG Downloader — Application Logic
   ============================================= */

(function () {
  "use strict";

  // ── DOM refs ──────────────────────────────────
  const searchInput     = document.getElementById("search-input");
  const searchHint      = document.getElementById("search-hint");
  const dropdown        = document.getElementById("suggestions-dropdown");
  const chipsWrap       = document.getElementById("chips");
  const customSection   = document.getElementById("customization");
  const previewSection  = document.getElementById("preview-section");
  const previewArea     = document.getElementById("preview-area");
  const urlDisplay      = document.getElementById("url-display");
  const btnDownload     = document.getElementById("btn-download");
  const btnCopyUrl      = document.getElementById("btn-copy-url");
  const bulkSelected    = document.getElementById("bulk-selected");
  const bulkActions     = document.getElementById("bulk-actions");
  const bulkCountEl     = document.getElementById("bulk-count");
  const btnBulkDownload = document.getElementById("btn-bulk-download");
  const btnBulkClear    = document.getElementById("btn-bulk-clear");
  const toastContainer  = document.getElementById("toast-container");

  // ── Fields ────────────────────────────────────
  const fieldLabel      = document.getElementById("field-label");
  const fieldColor      = document.getElementById("field-color");
  const fieldColorPicker= document.getElementById("field-color-picker");
  const fieldLogo       = document.getElementById("field-logo");
  const fieldLogoColor  = document.getElementById("field-logoColor");
  const fieldStyle      = document.getElementById("field-style");
  const fieldLabelColor = document.getElementById("field-labelColor");

  // ── State ─────────────────────────────────────
  let currentTech = null;         // selected tech from DB or custom
  let bulkQueue   = [];           // array of badge configs for bulk download
  let activeIdx   = -1;           // keyboard nav index in suggestions
  let debounceId  = null;

  // ── Helpers ───────────────────────────────────

  /**
   * Encode text for the Shields.io badge path segment.
   * Shields uses:  _ → space,  __ → underscore,  -- → dash
   * We need the reverse: space → %20 or _, dash → --, underscore → __
   */
  function encodeShieldsPath(text) {
    return text
      .replace(/_/g, "__")    // literal underscore → __
      .replace(/-/g, "--")    // literal dash → --
      .replace(/ /g, "_");    // space → _
  }

  /**
   * Build a Shields.io badge URL from a config object.
   */
  function buildShieldsUrl(cfg) {
    const label = cfg.label || cfg.name || "badge";
    const color = (cfg.color || "blue").replace(/^#/, "");

    // Path: /badge/{label}-{color}
    const path = encodeShieldsPath(label) + "-" + color;

    const url = new URL("https://img.shields.io/badge/" + path);

    if (cfg.style)      url.searchParams.set("style", cfg.style);
    if (cfg.logo)       url.searchParams.set("logo", cfg.logo);
    if (cfg.logoColor)  url.searchParams.set("logoColor", cfg.logoColor);
    if (cfg.logoSize)   url.searchParams.set("logoSize", cfg.logoSize);
    if (cfg.labelColor) url.searchParams.set("labelColor", cfg.labelColor);

    return url.toString();
  }

  /**
   * Sanitize a name into a safe filename.
   */
  function sanitizeFilename(name) {
    return name
      .toLowerCase()
      .replace(/\./g, "")         // Next.js → Nextjs
      .replace(/\s+/g, "-")       // spaces → dash
      .replace(/[^a-z0-9\-]/g, "") // strip special
      .replace(/-+/g, "-")        // collapse dashes
      .replace(/^-|-$/g, "");     // trim dashes
  }

  /**
   * Validate that a string looks like SVG content.
   */
  function isValidSvg(text) {
    if (!text || text.trim().length === 0) return false;
    const t = text.trim();
    return t.startsWith("<svg") || t.startsWith("<?xml");
  }

  /**
   * Show a toast notification.
   */
  function toast(message, type = "info") {
    const icons = { success: "✓", error: "✗", info: "ℹ" };
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${message}</span>`;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.3s, transform 0.3s";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  /**
   * Sleep for ms.
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── URL builder from current form state ───────
  function getFormConfig() {
    return {
      name:       currentTech ? currentTech.name : fieldLabel.value,
      label:      fieldLabel.value,
      color:      fieldColor.value || "blue",
      logo:       fieldLogo.value || undefined,
      logoColor:  fieldLogoColor.value || undefined,
      style:      fieldStyle.value || "for-the-badge",
      labelColor: fieldLabelColor.value || undefined,
    };
  }

  function getCurrentUrl() {
    const cfg = getFormConfig();
    return buildShieldsUrl(cfg);
  }

  // ── Preview ───────────────────────────────────
  let previewDebounce = null;

  function updatePreview() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => {
      const url = getCurrentUrl();

      // Show preview section
      previewSection.style.display = "";

      // Update URL display
      urlDisplay.textContent = url;
      urlDisplay.classList.add("show");

      // Load badge image
      const img = document.createElement("img");
      img.alt = fieldLabel.value + " badge";
      img.src = url;
      img.className = "badge-scale-in";
      img.onload = () => {
        previewArea.innerHTML = "";
        previewArea.appendChild(img);
        previewArea.classList.add("has-badge");
      };
      img.onerror = () => {
        previewArea.innerHTML = '<div class="preview-placeholder">Failed to load badge preview</div>';
        previewArea.classList.remove("has-badge");
      };
    }, 250);
  }

  // ── Search / Suggestions ──────────────────────
  function filterTechs(query) {
    if (!query) return TECH_DB.slice(0, 12);
    const q = query.toLowerCase();
    return TECH_DB.filter(t =>
      t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    ).slice(0, 10);
  }

  function renderSuggestions(items) {
    if (items.length === 0) {
      dropdown.classList.remove("show");
      return;
    }
    dropdown.innerHTML = items.map((t, i) => `
      <div class="suggestion-item" data-index="${i}">
        <span class="suggestion-swatch" style="background:#${t.color}"></span>
        <span class="suggestion-name">${t.name}</span>
        <span class="suggestion-slug">${t.slug}</span>
      </div>
    `).join("");
    dropdown.classList.add("show");
    activeIdx = -1;
  }

  function selectTech(tech) {
    currentTech = tech;
    searchInput.value = tech.name;
    dropdown.classList.remove("show");

    // Populate form
    fieldLabel.value     = tech.name;
    fieldColor.value     = tech.color;
    fieldColorPicker.value = "#" + tech.color;
    fieldLogo.value      = tech.slug;
    fieldLogoColor.value = "white";

    // Show sections
    customSection.style.display = "";

    updatePreview();

    // Add to bulk queue
    addToBulk(tech);
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceId);
    searchHint.style.display = "none";
    debounceId = setTimeout(() => {
      const q = searchInput.value.trim();
      const matches = filterTechs(q);
      renderSuggestions(matches);
    }, 100);
  });

  searchInput.addEventListener("focus", () => {
    searchHint.style.display = "none";
    const q = searchInput.value.trim();
    const matches = filterTechs(q);
    renderSuggestions(matches);
  });

  searchInput.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".suggestion-item");
    if (!items.length) {
      // If Enter is pressed with no suggestions, treat the typed text as custom
      if (e.key === "Enter") {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q) {
          selectTech({
            name: q,
            slug: sanitizeFilename(q),
            color: "blue",
          });
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
      items[activeIdx]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
      items[activeIdx]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0) {
        const matches = filterTechs(searchInput.value.trim());
        if (matches[activeIdx]) selectTech(matches[activeIdx]);
      } else {
        // Select first match
        const matches = filterTechs(searchInput.value.trim());
        if (matches[0]) selectTech(matches[0]);
      }
    } else if (e.key === "Escape") {
      dropdown.classList.remove("show");
    }
  });

  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;
    const idx = parseInt(item.dataset.index, 10);
    const matches = filterTechs(searchInput.value.trim());
    if (matches[idx]) selectTech(matches[idx]);
  });

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      dropdown.classList.remove("show");
    }
  });

  // "/" hotkey to focus search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // ── Quick pick chips ──────────────────────────
  function renderChips() {
    chipsWrap.innerHTML = POPULAR_TECHS.map(name => {
      const tech = TECH_DB.find(t => t.name === name);
      if (!tech) return "";
      return `<button class="chip" data-slug="${tech.slug}">
        <span class="chip-dot" style="background:#${tech.color}"></span>
        ${tech.name}
      </button>`;
    }).join("");
  }

  chipsWrap.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const slug = chip.dataset.slug;
    const tech = TECH_DB.find(t => t.slug === slug);
    if (tech) selectTech(tech);
  });

  renderChips();

  // ── Form change → live preview ────────────────
  [fieldLabel, fieldColor, fieldLogo, fieldLogoColor, fieldStyle, fieldLabelColor].forEach(el => {
    el.addEventListener("input", updatePreview);
  });

  fieldColorPicker.addEventListener("input", () => {
    fieldColor.value = fieldColorPicker.value.replace("#", "");
    updatePreview();
  });

  fieldColor.addEventListener("input", () => {
    const v = fieldColor.value;
    if (/^[0-9a-fA-F]{6}$/.test(v)) {
      fieldColorPicker.value = "#" + v;
    }
  });

  // ── Download single badge ─────────────────────
  async function downloadSvg(url, filename) {
    try {
      const resp = await fetch(url);

      if (resp.status === 429) {
        toast("Rate limited by Shields.io. Wait a moment and try again.", "error");
        return false;
      }
      if (!resp.ok) {
        toast(`HTTP ${resp.status}: Failed to fetch badge`, "error");
        return false;
      }

      const svg = await resp.text();

      if (!isValidSvg(svg)) {
        toast("Response is not valid SVG", "error");
        return false;
      }

      // Trigger browser download
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      return true;
    } catch (err) {
      toast(`Network error: ${err.message}`, "error");
      return false;
    }
  }

  btnDownload.addEventListener("click", async () => {
    const url = getCurrentUrl();
    const cfg = getFormConfig();
    const filename = sanitizeFilename(cfg.name || cfg.label) + ".svg";

    btnDownload.disabled = true;
    btnDownload.innerHTML = '<span class="spinner"></span> Downloading…';

    const ok = await downloadSvg(url, filename);

    btnDownload.disabled = false;
    btnDownload.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download SVG`;

    if (ok) toast(`Downloaded ${filename}`, "success");
  });

  // ── Copy URL ──────────────────────────────────
  btnCopyUrl.addEventListener("click", async () => {
    const url = getCurrentUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast("URL copied to clipboard", "success");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("URL copied to clipboard", "success");
    }
  });

  // ── Bulk mode ─────────────────────────────────
  function addToBulk(tech) {
    // Don't add duplicates
    if (bulkQueue.find(t => t.slug === tech.slug && t.name === tech.name)) return;

    bulkQueue.push({
      name:      tech.name,
      slug:      tech.slug,
      color:     tech.color,
      label:     tech.name,
      logo:      tech.slug,
      logoColor: "white",
      style:     fieldStyle.value || "for-the-badge",
    });
    renderBulk();
  }

  function removeBulk(index) {
    bulkQueue.splice(index, 1);
    renderBulk();
  }

  function renderBulk() {
    if (bulkQueue.length === 0) {
      bulkSelected.innerHTML = '<span class="bulk-empty">Select technologies above to add them here</span>';
      bulkActions.style.display = "none";
      return;
    }

    bulkSelected.innerHTML = bulkQueue.map((t, i) => `
      <span class="bulk-tag">
        ${t.name}
        <span class="remove-tag" data-index="${i}">×</span>
      </span>
    `).join("");

    bulkCountEl.textContent = bulkQueue.length;
    bulkActions.style.display = "";
  }

  bulkSelected.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-tag");
    if (!btn) return;
    removeBulk(parseInt(btn.dataset.index, 10));
  });

  btnBulkClear.addEventListener("click", () => {
    bulkQueue = [];
    renderBulk();
  });

  btnBulkDownload.addEventListener("click", async () => {
    if (bulkQueue.length === 0) return;

    btnBulkDownload.disabled = true;
    const total = bulkQueue.length;
    let downloaded = 0;
    let failed = 0;

    // Add progress bar
    const progressWrap = document.createElement("div");
    progressWrap.className = "progress-bar-wrap";
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.style.width = "0%";
    progressWrap.appendChild(progressBar);
    bulkActions.parentElement.insertBefore(progressWrap, bulkActions);

    for (const tech of bulkQueue) {
      const cfg = {
        label:     tech.label,
        color:     tech.color,
        logo:      tech.logo,
        logoColor: tech.logoColor,
        style:     tech.style,
      };
      const url = buildShieldsUrl(cfg);
      const filename = sanitizeFilename(tech.name) + ".svg";

      const ok = await downloadSvg(url, filename);
      if (ok) downloaded++; else failed++;

      progressBar.style.width = ((downloaded + failed) / total * 100) + "%";

      // Polite delay between requests
      if (downloaded + failed < total) await sleep(400);
    }

    progressWrap.remove();
    btnBulkDownload.disabled = false;

    if (failed === 0) {
      toast(`All ${downloaded} badges downloaded!`, "success");
    } else {
      toast(`${downloaded} downloaded, ${failed} failed`, "error");
    }
  });

  renderBulk();

})();
