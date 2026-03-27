# CryptoWave

**Free, browser-based developer tools. No uploads. No accounts. No data leaves your device.**

🌐 [cryptowaveapp.com](https://cryptowaveapp.com)

---

## Tools

### 🔐 Encryption
| Tool | Description |
|------|-------------|
| AES Cipher | AES-GCM / CBC / CTR with 128/192/256-bit keys |
| RSA Cipher | RSA-OAEP / PKCS#1, key pairs up to 4096-bit |
| DES | Legacy DES encryption |
| Triple DES | Legacy 3DES encryption |

### # Hashing
| Tool | Description |
|------|-------------|
| Hash Generator | SHA-256, SHA-512, SHA-384, MD5 |
| HMAC | HMAC with any hash algorithm |
| Bcrypt | Adaptive password hashing, rounds 4–12 |

### ⇄ Encoding
| Tool | Description |
|------|-------------|
| Base64 | Encode / decode (standard + URL-safe) |
| Hex | Text ↔ hexadecimal |
| URL Encode | Percent-encoding (RFC 3986) |
| HTML Entities | Escape / unescape HTML |
| JWT Decoder | Inspect header, payload, expiry |

### 🎵 Audio
| Tool | Description |
|------|-------------|
| Audio Converter | MP3, WAV, FLAC, AAC, OGG, OPUS, M4A (FFmpeg.wasm) |
| Audio Cutter | Trim to exact time range |
| Audio Merger | Combine multiple tracks |
| Audio Volume | Boost or reduce 0–200% |
| Audio Reverse | Reverse any audio file |
| Audio Pitch | Shift pitch without changing speed |
| MP4 to MP3 | Extract MP3 from any video file |

### 🎬 Video
| Tool | Description |
|------|-------------|
| Video Converter | MP4, MKV, MOV, AVI, WebM, FLV (FFmpeg.wasm) |
| Video Trimmer | Cut to exact time range |
| Video Merger | Combine multiple clips |
| Video Rotate/Flip | 90°/180° rotate + horizontal/vertical flip |
| Video Speed | 0.25× slow motion to 4× fast forward |
| Video Loop | Repeat 2–20 times |
| Video Volume | Adjust audio track 0–200% |
| Video Crop | Crop to aspect ratio or custom dimensions |

### 🖼️ Image
| Tool | Description |
|------|-------------|
| Image Compressor | Compress JPG, PNG, WebP |
| Image Converter | Convert between JPG, PNG, WebP |
| Image to WebP | Batch convert to WebP with quality control |
| Image to PDF | Combine images into a single PDF |

### 📄 PDF
| Tool | Description |
|------|-------------|
| PDF Merger | Merge multiple PDFs (supports encrypted files) |
| PDF Splitter | Extract pages from a PDF |
| PDF to Images | Export each page as an image |

### 🔧 Tools
| Tool | Description |
|------|-------------|
| Password Generator | Cryptographically secure, custom rules |
| QR Code | Generate and scan QR codes |
| Date Difference | Calculate days between two dates |
| Age Calculator | Calculate exact age |
| Word Counter | Count words, characters, sentences |
| Number Base Converter | Binary, octal, decimal, hex |
| Color Converter | HEX, RGB, HSL, HSV |
| Text to Speech | Browser-native TTS |

---

## File Structure

```
cryptotools/
├── index.html              ← Landing page with tool grid
├── favicon.svg             ← Default favicon (🔐)
├── favicon-media.svg       ← Audio pages favicon (🎵)
├── favicon-video.svg       ← Video pages favicon (🎬)
├── robots.txt
├── sitemap.xml
├── _headers                ← Cloudflare: COOP/COEP/CSP headers
├── css/
│   └── styles.css          ← Design system (CSS variables, all components)
├── js/
│   ├── utils.js            ← Shared utilities (toast, copy, download, navbar, back-to-top)
│   ├── theme.js            ← Multi-theme picker (6 themes)
│   └── modules/
│       ├── aes.js
│       ├── rsa.js
│       ├── des.js
│       ├── tripledes.js
│       ├── hash.js
│       ├── encoding.js
│       ├── audio.js
│       ├── video.js
│       ├── video-trim.js
│       ├── video-merge.js
│       ├── video-rotate.js
│       ├── video-speed.js
│       ├── video-loop.js
│       ├── video-volume.js
│       ├── video-crop.js
│       ├── mp4-to-mp3.js
│       ├── image.js
│       ├── image-webp.js
│       ├── pdf-merge.js
│       ├── pdf-split.js
│       ├── pdf-images.js
│       ├── password.js
│       ├── qrcode.js
│       ├── tts.js
│       ├── audio-cut.js
│       ├── audio-merge.js
│       ├── audio-volume.js
│       ├── audio-reverse.js
│       ├── audio-pitch.js
│       ├── date-diff.js
│       ├── age.js
│       ├── word-count.js
│       ├── base-convert.js
│       └── color-convert.js
└── pages/
    └── *.html              ← One HTML file per tool
```

---

## Dependencies (CDN, no npm/build step)

| Library | Version | Used For |
|---------|---------|----------|
| Web Crypto API | Browser native | AES, RSA, SHA, HMAC |
| CryptoJS | 4.2.0 | MD5 hashing |
| bcryptjs | 2.4.3 | Bcrypt |
| JSEncrypt | 3.3.2 | RSA PKCS#1 |
| FFmpeg.wasm | 0.11.6 | Audio/video conversion |
| pdf-lib | 1.17.1 | PDF merge/split |
| PDF.js | 3.11.174 | PDF to images |
| QRCode.js | — | QR code generation |
| html5-qrcode | — | QR code scanning |

---

## Deployment

Hosted on **Cloudflare Workers** (static assets). The `_headers` file sets the required Cross-Origin Isolation headers for FFmpeg.wasm.

### Local development
```bash
# Requires COOP/COEP headers for FFmpeg.wasm (SharedArrayBuffer)
npx serve -C .
```

### _headers (Cloudflare Workers / Netlify)
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Nginx
```nginx
add_header Cross-Origin-Opener-Policy "same-origin";
add_header Cross-Origin-Embedder-Policy "require-corp";
```

### Apache
```apache
Header always set Cross-Origin-Opener-Policy "same-origin"
Header always set Cross-Origin-Embedder-Policy "require-corp"
```

---

## Themes

6 built-in themes, persisted in `localStorage`:

| Key | Label |
|-----|-------|
| `light` | ☀️ Light (default) |
| `dark` | 🌙 Dark |
| `ocean` | 🌊 Ocean |
| `ocean-light` | 🏖️ Ocean Light |
| `forest` | 🌿 Forest |
| `forest-light` | 🌱 Forest Light |

---

## Security Notes

- All crypto uses the **Web Crypto API** (browser-native, FIPS-compliant)
- AES-GCM is the default mode (authenticated encryption)
- RSA keys are generated in-browser, never transmitted
- `Utils.sanitize()` used for all user content inserted into the DOM
- No server-side processing of any kind
