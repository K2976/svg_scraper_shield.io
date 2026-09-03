/**
 * Shields SVG Downloader — Canva Compatibility Sanitizer
 * 
 * Provides logic to recursively detect and transform embedded Base64 SVGs 
 * inside <image> tags into proper vector <g> tags.
 */

function decodeBase64Utf8(b64) {
  const binString = atob(b64);
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
  return new TextDecoder().decode(bytes);
}

function sanitizeSvgForCanva(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");

  // 1. Validate parsed XML
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid SVG/XML: " + parseError.textContent);
  }

  if (doc.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("Root element is not <svg>");
  }

  // 2. Recursive sanitization
  function processNode(node) {
    const images = Array.from(node.querySelectorAll("image"));
    
    for (const img of images) {
      const href = img.getAttribute("href") || img.getAttribute("xlink:href");
      if (!href) continue;

      let innerSvgString = null;

      // 3. Detect embedded SVG data URIs
      if (href.startsWith("data:image/svg+xml;base64,")) {
        const b64 = href.split(",")[1];
        try {
          innerSvgString = decodeBase64Utf8(b64);
        } catch (e) {
          console.warn("Failed to decode base64 SVG", e);
          continue;
        }
      } else if (href.startsWith("data:image/svg+xml,")) {
        const encoded = href.split(",").slice(1).join(",");
        try {
          innerSvgString = decodeURIComponent(encoded);
        } catch (e) {
          console.warn("Failed to decode URI-encoded SVG", e);
          continue;
        }
      } else {
        // Not an embedded SVG (raster or external). Leave untouched.
        continue;
      }

      if (innerSvgString) {
        // 4 & 5. Decode and Parse embedded SVG
        const innerDoc = parser.parseFromString(innerSvgString, "image/svg+xml");
        if (innerDoc.querySelector("parsererror")) continue;

        const innerSvgEl = innerDoc.documentElement;
        if (innerSvgEl.tagName.toLowerCase() !== "svg") continue;

        // 9. Handle nested embedded SVGs recursively
        processNode(innerSvgEl);

        // 6 & 8. Replace <image> with actual vector content and preserve sizing
        const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Mark it so we know we sanitized it (useful for debugging/tests)
        g.setAttribute("data-sanitized", "true");

        const imgX = parseFloat(img.getAttribute("x")) || 0;
        const imgY = parseFloat(img.getAttribute("y")) || 0;
        const imgWidth = parseFloat(img.getAttribute("width"));
        const imgHeight = parseFloat(img.getAttribute("height"));

        let svgWidth = null;
        let svgHeight = null;
        
        const viewBox = innerSvgEl.getAttribute("viewBox");
        if (viewBox) {
          const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
          if (parts.length === 4) {
             svgWidth = parts[2];
             svgHeight = parts[3];
          }
        }
        
        if (svgWidth === null || svgHeight === null) {
          svgWidth = parseFloat(innerSvgEl.getAttribute("width"));
          svgHeight = parseFloat(innerSvgEl.getAttribute("height"));
        }

        let scaleX = 1;
        let scaleY = 1;
        
        if (!isNaN(imgWidth) && svgWidth && svgWidth > 0) {
          scaleX = imgWidth / svgWidth;
        }
        if (!isNaN(imgHeight) && svgHeight && svgHeight > 0) {
          scaleY = imgHeight / svgHeight;
        }

        // Apply transformations
        const transforms = [];
        if (imgX !== 0 || imgY !== 0) {
          transforms.push(`translate(${imgX}, ${imgY})`);
        }
        if (scaleX !== 1 || scaleY !== 1) {
          transforms.push(`scale(${scaleX}, ${scaleY})`);
        }
        if (transforms.length > 0) {
          g.setAttribute("transform", transforms.join(" "));
        }

        // Copy stylistic attributes from the inner <svg> root to the new <g> wrapper
        const allowedAttrs = ["fill", "stroke", "fill-rule", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "role", "aria-label"];
        for (const attr of allowedAttrs) {
          const val = innerSvgEl.getAttribute(attr);
          if (val) g.setAttribute(attr, val);
        }

        // Move all children
        while (innerSvgEl.firstChild) {
          g.appendChild(doc.adoptNode(innerSvgEl.firstChild));
        }

        // Replace original <image> with <g>
        img.parentNode.replaceChild(g, img);
      }
    }
  }

  processNode(doc.documentElement);

  // 11. Serialize back to a valid self-contained SVG string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
}

// Export for tests if running in Node.js (via JSDOM or similar)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { sanitizeSvgForCanva, decodeBase64Utf8 };
}
