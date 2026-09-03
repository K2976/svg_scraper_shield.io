const resultsDiv = document.getElementById("results");
const summaryDiv = document.getElementById("summary");
let passed = 0;
let total = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runTest(name, fn) {
  total++;
  const div = document.createElement("div");
  div.className = "test";
  try {
    fn();
    div.classList.add("pass");
    div.textContent = `✓ ${name}`;
    passed++;
  } catch (err) {
    div.classList.add("fail");
    div.innerHTML = `✗ ${name}<br><pre>${err.message}\n${err.stack}</pre>`;
  }
  resultsDiv.appendChild(div);
}

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const FIXTURE_NORMAL = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10 10 H 90 V 90 H 10 Z" fill="red" />
</svg>`;

const FIXTURE_BASE64 = `
<svg xmlns="http://www.w3.org/2000/svg">
  <image x="10" y="20" width="50" height="50" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIvPjwvc3ZnPg==" />
</svg>`;

const FIXTURE_URI_ENCODED = `
<svg xmlns="http://www.w3.org/2000/svg">
  <image x="5" y="5" width="20" height="20" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2010%2010%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%2F%3E%3C%2Fsvg%3E" />
</svg>`;

const FIXTURE_NESTED = `
<svg xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjppbWFnZSBocmVmPSJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBITjJaeUI0Yld4dWN6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNakF3TUM5emRtY2lQajxjaXJjbGUgcj0iNSIvPjwvc3ZnPiIgLz48L3N2Zz4=" />
</svg>`;

const FIXTURE_RASTER = `
<svg xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" />
</svg>`;

const FIXTURE_TRANSFORMS = `
<svg xmlns="http://www.w3.org/2000/svg">
  <image x="10" y="10" width="10" height="10" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMTAiLz48L3N2Zz4=" />
</svg>`;

const FIXTURE_KOTLIN = `
<svg xmlns="http://www.w3.org/2000/svg" width="94.5" height="28" role="img" aria-label="KOTLIN">
  <title>KOTLIN</title>
  <g shape-rendering="crispEdges">
    <rect width="94.5" height="28" fill="#7f52ff"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100">
    <image x="9" y="7" width="14" height="14" href="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPktvdGxpbjwvdGl0bGU+PHBhdGggZD0iTTI0IDI0SDBWMGgyNEwxMiAxMloiLz48L3N2Zz4="/>
    <text transform="scale(.1)" x="572.5" y="175" textLength="505" font-weight="bold">KOTLIN</text>
  </g>
</svg>`;

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

setTimeout(() => {
  runTest("TEST 1: Normal SVG with only paths", () => {
    const out = sanitizeSvgForCanva(FIXTURE_NORMAL);
    assert(out.includes("<path d="), "Path should be preserved");
    assert(!out.includes("<g data-sanitized"), "Should not modify normal SVG");
  });

  runTest("TEST 2: SVG containing Base64 image", () => {
    const out = sanitizeSvgForCanva(FIXTURE_BASE64);
    assert(!out.includes("<image"), "Image tag should be removed");
    assert(out.includes("<g data-sanitized"), "Should contain sanitized group");
    assert(out.includes('transform="translate(10, 20) scale(2.0833'), "Should apply translation and scaling based on width=50 vs viewBox=24");
    assert(out.includes('<path d="M0 0h24v24H0z"'), "Should contain extracted path");
  });

  runTest("TEST 3: URL-encoded embedded SVG", () => {
    const out = sanitizeSvgForCanva(FIXTURE_URI_ENCODED);
    assert(!out.includes("<image"), "Image tag should be removed");
    assert(out.includes("<g data-sanitized"), "Should contain sanitized group");
    assert(out.includes("<circle cx=\"5\""), "Should extract decoded elements");
    assert(out.includes('transform="translate(5, 5) scale(2, 2)"'), "Should scale 20x20 over 10x10 viewBox");
  });

  runTest("TEST 4: Nested embedded SVG", () => {
    const out = sanitizeSvgForCanva(FIXTURE_NESTED);
    assert(!out.includes("<image"), "All image tags should be removed");
    // Outer image replaced by g, inner image replaced by g
    const match = out.match(/<g data-sanitized="true"/g);
    assert(match && match.length === 2, "Should have two nested sanitized groups");
    assert(out.includes("<circle r=\"5\""), "Deepest embedded element should be extracted");
  });

  runTest("TEST 5: Raster image", () => {
    const out = sanitizeSvgForCanva(FIXTURE_RASTER);
    assert(out.includes("<image"), "Raster image should be preserved");
    assert(out.includes("data:image/png;base64"), "Raster data should remain");
    assert(!out.includes("<g data-sanitized"), "Should not process raster as SVG");
  });

  runTest("TEST 6 & 7: SVG with transforms and dimensions", () => {
    const out = sanitizeSvgForCanva(FIXTURE_TRANSFORMS);
    assert(out.includes('transform="translate(10, 10) scale(0.5, 0.5)"'), "Should compute correct transform from x/y/width/height mapping");
    assert(out.includes("<circle"), "Inner content remains");
  });

  runTest("TEST 8: Actual downloaded Shields.io SVG fixture (Kotlin)", () => {
    const out = sanitizeSvgForCanva(FIXTURE_KOTLIN);
    assert(!out.includes("<image"), "Image tag should be removed");
    assert(out.includes("<g data-sanitized"), "Should contain sanitized group");
    assert(out.includes("translate(9, 7)"), "Should preserve x=9 y=7 position");
    assert(out.includes('scale(0.5833'), "Should scale 14/24 correctly");
    assert(out.includes('fill="white"'), "Should preserve fill styling on group from embedded SVG");
    assert(out.includes("KOTLIN"), "Text should be preserved intact");
    assert(out.includes("<rect"), "Background rect should be preserved");
  });

  summaryDiv.textContent = `Completed: ${passed} / ${total} tests passed.`;
  summaryDiv.style.color = passed === total ? "#34d399" : "#f87171";
}, 100);
