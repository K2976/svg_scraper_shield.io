# Shields SVG Downloader

A simple, browser-based web application to download exact, high-quality SVG badges from [Shields.io](https://shields.io/) with automatic sanitization for perfect compatibility with Canva.

## Features
- **No Build Step**: Pure HTML, CSS, and JS. Just serve the directory.
- **Canva Sanitizer**: Automatically converts embedded Base64 `image` tags (often found in Shields.io Simple Icons) into proper native SVG `<g>` vector tags, bypassing Canva's "corrupted file" errors while preserving exact visual layout and colors.
- **Search & Autocomplete**: Preloaded database of over 100+ popular technologies (including custom entries like Jetpack Compose, Material Design, and Hilt).
- **Live Preview**: See the exact badge layout before downloading.
- **Bulk Download**: Add multiple badges to your queue and download them all at once.

## How to Run

Because this app fetches badges directly from `img.shields.io` and modifies SVGs using browser APIs, you need to run it through a local HTTP server to avoid CORS/local file restrictions.

You can use any standard static server.

### Option 1: Using `npx serve` (Node.js)
```bash
npx serve .
```

### Option 2: Using Python
```bash
python3 -m http.server 3000
```
*(Or `python -m SimpleHTTPServer 3000` for older Python 2 versions)*

### Option 3: Using VS Code
1. Install the **Live Server** extension.
2. Open `index.html`.
3. Click "Go Live" in the bottom right corner.

Once the server is running, navigate to `http://localhost:3000` (or whichever port your server assigns) in your browser.

## Tech Stack
- Vanilla HTML5 / CSS3 (Glassmorphism design)
- Vanilla JavaScript (ES6+)
- Shields.io & Simple Icons APIs

## License
MIT
