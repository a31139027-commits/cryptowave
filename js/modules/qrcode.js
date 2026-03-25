/**
 * modules/qrcode.js — QR Code Generator & Scanner Module
 * Generator: qrcode.js (via CDN)
 * Scanner:   jsQR (via CDN)
 */

'use strict';

const QRModule = (() => {

  /* ── Generator ────────────────────────────────────────── */

  function generate(text, options = {}) {
    const {
      size       = 256,
      colorDark  = '#000000',
      colorLight = '#ffffff',
      errorLevel = 'H',
    } = options;

    return new Promise((resolve, reject) => {
      if (!window.QRCode) { reject(new Error('QRCode library not loaded')); return; }
      if (!text || !text.trim()) { reject(new Error('Text cannot be empty')); return; }

      // Container must be visible for canvas to render correctly
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + size + 'px;';
      document.body.appendChild(container);

      let qr;
      try {
        qr = new window.QRCode(container, {
          text:         text,
          width:        size,
          height:       size,
          colorDark:    colorDark,
          colorLight:   colorLight,
          correctLevel: window.QRCode.CorrectLevel[errorLevel] || window.QRCode.CorrectLevel.H,
        });
      } catch (err) {
        document.body.removeChild(container);
        reject(err);
        return;
      }

      // Poll until canvas/img is ready (max 3s)
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        const canvas = container.querySelector('canvas');
        const img    = container.querySelector('img');
        let dataUrl  = null;

        if (canvas && canvas.width > 0) {
          try { dataUrl = canvas.toDataURL('image/png'); } catch(_) {}
        } else if (img && img.src && img.complete && img.naturalWidth > 0) {
          dataUrl = img.src;
        }

        if (dataUrl) {
          clearInterval(poll);
          document.body.removeChild(container);
          resolve(dataUrl);
        } else if (attempts > 60) { // 3s timeout
          clearInterval(poll);
          document.body.removeChild(container);
          reject(new Error('QR Code generation timed out. Please try again.'));
        }
      }, 50);
    });
  }

  /* ── Scanner ──────────────────────────────────────────── */

  function scanFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!window.jsQR) { reject(new Error('jsQR library not loaded')); return; }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width  = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (result) resolve(result.data);
          else reject(new Error('No QR Code detected. Try a clearer, higher-contrast image.'));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /* ── WiFi String Builder ──────────────────────────────── */

  function buildWifiString(ssid, password, type = 'WPA', hidden = false) {
    return `WIFI:T:${type};S:${ssid};P:${password};H:${hidden ? 'true' : 'false'};;`;
  }

  /* ── vCard Builder ────────────────────────────────────── */

  function buildVCard({ name, phone, email, org, url, address }) {
    let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
    if (name)    vcard += `FN:${name}\nN:${name};;;;\n`;
    if (org)     vcard += `ORG:${org}\n`;
    if (phone)   vcard += `TEL;TYPE=CELL:${phone}\n`;
    if (email)   vcard += `EMAIL:${email}\n`;
    if (url)     vcard += `URL:${url}\n`;
    if (address) vcard += `ADR:;;${address};;;;\n`;
    vcard += 'END:VCARD';
    return vcard;
  }

  /* ── Shared result renderer ───────────────────────────── */

  function showResult(previewEl, dataUrl, dlBtn, filename) {
    previewEl.src = dataUrl;
    previewEl.style.display = 'block';
    if (dlBtn) {
      dlBtn.disabled = false;
      dlBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = filename; a.click();
      };
    }
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('qr-generate-btn')) return;
    Utils.initTabs(document.querySelector('.tabs-container') || document.body);
    initGenerator();
    initScanner();
    initWifi();
    initVCard();
  }

  /* ── Generator Tab ────────────────────────────────────── */

  function initGenerator() {
    const genBtn    = document.getElementById('qr-generate-btn');
    const inputEl   = document.getElementById('qr-input');
    const preview   = document.getElementById('qr-preview');
    const dlBtn     = document.getElementById('qr-download-btn');
    const sizeEl    = document.getElementById('qr-size');
    const fgEl      = document.getElementById('qr-fg');
    const bgEl      = document.getElementById('qr-bg');
    const errEl     = document.getElementById('qr-error-level');
    const charCount = document.getElementById('qr-char-count');
    const placeholder = document.getElementById('qr-placeholder');
    const copyImgBtn  = document.getElementById('qr-copy-img');

    if (charCount) Utils.bindCharCounter(inputEl, charCount, 900);

    let lastDataUrl = null;

    async function doGenerate() {
      const text = inputEl.value.trim();
      if (!text) { Utils.showToast('⚠ Please enter some content'); return; }
      if (text.length > 900) { Utils.showToast('⚠ Content too long for QR Code'); return; }

      Utils.setLoading(genBtn, true);
      try {
        const dataUrl = await generate(text, {
          size:       parseInt(sizeEl?.value) || 256,
          colorDark:  fgEl?.value  || '#000000',
          colorLight: bgEl?.value  || '#ffffff',
          errorLevel: errEl?.value || 'H',
        });
        lastDataUrl = dataUrl;
        preview.src = dataUrl;
        preview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (dlBtn) dlBtn.disabled = false;
      } catch (err) {
        Utils.showToast(`✗ ${err.message}`);
      }
      Utils.setLoading(genBtn, false);
    }

    genBtn.addEventListener('click', doGenerate);
    inputEl.addEventListener('input', Utils.debounce(() => {
      if (inputEl.value.trim()) doGenerate();
    }, 700));

    if (dlBtn) dlBtn.addEventListener('click', () => {
      if (lastDataUrl) { const a = document.createElement('a'); a.href = lastDataUrl; a.download = 'qrcode.png'; a.click(); }
    });

    if (copyImgBtn) copyImgBtn.addEventListener('click', async () => {
      if (!lastDataUrl) return;
      try {
        const res  = await fetch(lastDataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        Utils.showToast('✓ QR Code copied!');
      } catch (_) {
        Utils.showToast('⚠ Copy not supported — use Download instead');
      }
    });
  }

  /* ── Scanner Tab ──────────────────────────────────────── */

  function initScanner() {
    const scanDrop   = document.getElementById('qr-scan-drop');
    if (!scanDrop) return;
    const scanInput  = document.getElementById('qr-scan-input');
    const scanResult = document.getElementById('qr-scan-result');
    const scanPreview= document.getElementById('qr-scan-preview');
    const copyScanBtn= document.getElementById('qr-scan-copy');

    async function processFile(file) {
      if (!file.type.startsWith('image/')) { Utils.showToast('⚠ Please upload an image file'); return; }
      const url = URL.createObjectURL(file);
      scanPreview.src = url;
      scanPreview.style.display = 'block';
      scanResult.className = 'output-box output-box--large';
      scanResult.textContent = 'Scanning…';

      try {
        const data = await scanFromFile(file);
        scanResult.classList.add('output-box--success');
        scanResult.textContent = data;
        if (/^https?:\/\//i.test(data)) {
          const openBtn = document.createElement('a');
          openBtn.href = data; openBtn.target = '_blank'; openBtn.rel = 'noopener noreferrer';
          openBtn.className = 'btn btn--sm btn--ghost mt-3';
          openBtn.style.display = 'inline-flex';
          openBtn.textContent = '🔗 Open URL';
          scanResult.appendChild(document.createElement('br'));
          scanResult.appendChild(openBtn);
        }
      } catch (err) {
        scanResult.classList.add('output-box--error');
        scanResult.textContent = err.message;
      }
    }

    scanDrop.addEventListener('click',    () => scanInput.click());
    scanDrop.addEventListener('dragover', e => { e.preventDefault(); scanDrop.classList.add('drag-over'); });
    scanDrop.addEventListener('dragleave',  () => scanDrop.classList.remove('drag-over'));
    scanDrop.addEventListener('drop', e => {
      e.preventDefault(); scanDrop.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
    scanInput.addEventListener('change', () => {
      if (scanInput.files[0]) processFile(scanInput.files[0]);
    });

    if (copyScanBtn) copyScanBtn.addEventListener('click', () => {
      const t = scanResult.textContent.trim();
      if (t && t !== 'Scanning…') Utils.copyToClipboard(t, 'Result copied!');
    });
  }

  /* ── WiFi Tab ─────────────────────────────────────────── */

  function initWifi() {
    const genBtn = document.getElementById('wifi-generate-btn');
    if (!genBtn) return;

    genBtn.addEventListener('click', async () => {
      const ssid     = document.getElementById('wifi-ssid')?.value.trim();
      const password = document.getElementById('wifi-password')?.value || '';
      const type     = document.getElementById('wifi-type')?.value || 'WPA';
      const hidden   = document.getElementById('wifi-hidden')?.checked || false;

      if (!ssid) { Utils.showToast('⚠ Network name (SSID) is required'); return; }

      Utils.setLoading(genBtn, true);
      try {
        const text    = buildWifiString(ssid, password, type, hidden);
        const dataUrl = await generate(text, { size: 256, errorLevel: 'M' });
        const preview = document.getElementById('wifi-preview');
        const dlBtn   = document.getElementById('wifi-download');
        if (preview) showResult(preview, dataUrl, dlBtn, `wifi-${ssid}.png`);
        Utils.showToast('✓ WiFi QR Code generated!');
      } catch (err) {
        Utils.showToast(`✗ ${err.message}`);
      }
      Utils.setLoading(genBtn, false);
    });
  }

  /* ── vCard Tab ────────────────────────────────────────── */

  function initVCard() {
    const genBtn = document.getElementById('vcard-generate-btn');
    if (!genBtn) return;

    genBtn.addEventListener('click', async () => {
      const name    = (document.getElementById('vcard-name')?.value    || '').trim();
      const phone   = (document.getElementById('vcard-phone')?.value   || '').trim();
      const email   = (document.getElementById('vcard-email')?.value   || '').trim();
      const org     = (document.getElementById('vcard-org')?.value     || '').trim();
      const url     = (document.getElementById('vcard-url')?.value     || '').trim();
      const address = (document.getElementById('vcard-address')?.value || '').trim();

      if (!name && !phone && !email) {
        Utils.showToast('⚠ Please fill in at least Name, Phone, or Email');
        return;
      }

      Utils.setLoading(genBtn, true);
      try {
        const text    = buildVCard({ name, phone, email, org, url, address });
        const dataUrl = await generate(text, { size: 256, errorLevel: 'M' });

        // Show preview — force display even if panel was hidden
        const preview = document.getElementById('vcard-preview');
        const dlBtn   = document.getElementById('vcard-download');
        const placeholder = document.getElementById('vcard-placeholder');

        if (preview) {
          preview.src = dataUrl;
          preview.style.cssText = 'display:block;max-width:200px;border-radius:8px;margin:16px auto;image-rendering:pixelated;';
        }
        if (placeholder) placeholder.style.display = 'none';
        if (dlBtn) {
          dlBtn.disabled = false;
          dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `vcard-${name || 'contact'}.png`;
            a.click();
          };
        }
        Utils.showToast('✓ Contact QR Code generated!');
      } catch (err) {
        Utils.showToast(`✗ ${err.message}`);
        console.error('vCard QR error:', err);
      }
      Utils.setLoading(genBtn, false);
    });
  }

  return { init, generate, scanFromFile, buildWifiString, buildVCard };

})();

document.addEventListener('DOMContentLoaded', () => { QRModule.init(); Utils.initNavbar(); });
window.QRModule = QRModule;
