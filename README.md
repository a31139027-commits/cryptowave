# CryptoWave — Deployment & Development Guide

## Project Overview

CryptoWave is a **fully client-side** web application combining:
- 🔐 **Cryptography Tools** (AES, RSA, Hashing, Encoding)
- 🎵 **Audio Converter** (FFmpeg.wasm in-browser)

All processing runs in the user's browser. **No data is ever sent to a server.**

---

## File Structure

```
cryptotools/
├── index.html              ← Main landing page
├── css/
│   └── styles.css          ← Global stylesheet (CSS variables, components)
├── js/
│   ├── utils.js            ← Shared utilities (copy, toast, download, etc.)
│   └── modules/
│       ├── aes.js          ← AES-GCM / CBC / CTR (Web Crypto API)
│       ├── rsa.js          ← RSA-OAEP / PKCS#1 + key generation
│       ├── hash.js         ← SHA-256/512, MD5, HMAC, Bcrypt
│       ├── encoding.js     ← Base64, Hex, URL, HTML entities, JWT decode
│       └── audio.js        ← FFmpeg.wasm audio/video converter
└── pages/
    ├── aes.html            ← AES tool page
    ├── rsa.html            ← RSA tool page
    ├── hash.html           ← Hash generator page
    ├── encoding.html       ← Encoding/decoding page
    └── audio.html          ← Audio converter page
```

---

## Architecture Decisions

### Why separate JS modules?
Each `pages/*.html` loads only the JS it needs:
- **Security**: Reduced attack surface per page
- **Performance**: No unnecessary code loaded
- **Maintainability**: Each feature is independently editable
- **Testability**: Modules export functions that can be unit-tested

### Dependencies (loaded via CDN)
| Library | Version | Used For | Page |
|---------|---------|----------|------|
| Web Crypto API | Browser native | AES, RSA, SHA, HMAC | All crypto |
| CryptoJS | 4.2.0 | MD5 hashing | hash.html |
| bcryptjs | 2.4.3 | Bcrypt password hashing | hash.html |
| JSEncrypt | 3.3.2 | RSA PKCS#1 padding | rsa.html |
| FFmpeg.wasm | 0.11.6 | Audio/video conversion | audio.html |

No npm, no build step required. Drop the folder on any web server.

---

## Deployment

### Option 1: Static File Server (Development)
```bash
# Python
python3 -m http.server 8080

# Node.js (with COOP/COEP headers for audio)
npx serve -C .

# Or with proper headers:
npx serve --cors -p 8080
```

### Option 2: Nginx
```nginx
server {
    listen 80;
    root /var/www/cryptowave;
    index index.html;

    # Required for FFmpeg.wasm (SharedArrayBuffer)
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";

    # Cache static assets
    location ~* \.(css|js|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Cross-Origin-Opener-Policy "same-origin";
        add_header Cross-Origin-Embedder-Policy "require-corp";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### Option 3: Apache (.htaccess)
```apache
<IfModule mod_headers.c>
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Embedder-Policy "require-corp"
</IfModule>
```

### Option 4: Vercel (vercel.json)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### Option 5: Netlify (_headers file)
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Option 6: Cloudflare Pages (also _headers file)
Same as Netlify above.

---

## Adding New Tools

1. Create `pages/your-tool.html` using existing pages as a template
2. Create `js/modules/your-tool.js` with an IIFE module pattern:
```js
const YourModule = (() => {
  function init() {
    // Query DOM elements, attach event listeners
  }
  return { init, /* exported functions */ };
})();
document.addEventListener('DOMContentLoaded', () => { YourModule.init(); Utils.initNavbar(); });
window.YourModule = YourModule;
```
3. Link from `index.html` and add to the navbar in all pages
4. Load only the dependencies your module needs in the HTML

---

## Security Notes

- **All crypto uses the Web Crypto API** — the browser's native implementation, which is FIPS-compliant and runs in a secure context
- **AES-GCM is default** — authenticated encryption; CBC/CTR available but labeled clearly
- **RSA keys are generated in-browser** — never transmitted
- **No localStorage usage** — nothing persists between sessions
- **No analytics, no tracking, no cookies**
- XSS prevention: all user-provided text inserted via `textContent`, never `innerHTML`
- The `Utils.sanitize()` function is available for HTML contexts

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Crypto API | ✓ 37+ | ✓ 34+ | ✓ 7+ | ✓ 12+ |
| FFmpeg.wasm (SharedArrayBuffer) | ✓ 92+ | ✓ 79+ | ✓ 15.2+ | ✓ 92+ |
| WebAssembly | ✓ 57+ | ✓ 52+ | ✓ 11+ | ✓ 16+ |

**Note**: SharedArrayBuffer requires Cross-Origin-Isolation (COOP + COEP headers).

---

## Extending the Audio Converter

The `audio.js` module uses FFmpeg.wasm v0.11.x for maximum compatibility.
To upgrade to v0.12+ (which uses ESM imports):

```html
<!-- Replace the script tag in audio.html with: -->
<script type="module">
  import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
  import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';
  window.FFmpegLib = { FFmpeg, fetchFile, toBlobURL };
</script>
```
Then update `audio.js` to use the new API.
