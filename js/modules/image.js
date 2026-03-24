/**
 * modules/image.js — Image Tools Module
 * Features:
 *   1. Image Compressor (Canvas API)
 *   2. Image Format Converter (Canvas API) — JPG, PNG, WebP, GIF
 *   3. Image to PDF (jsPDF)
 * 100% client-side — no uploads, no servers
 */

'use strict';

const ImageModule = (() => {

  /* ── Helpers ──────────────────────────────────────────── */

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload  = () => { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, mime, quality));
  }

  function getOutputMime(format) {
    const map = {
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      png:  'image/png',
      webp: 'image/webp',
      gif:  'image/gif',
      bmp:  'image/bmp',
    };
    return map[format] || 'image/jpeg';
  }

  /* ── Image Compress ───────────────────────────────────── */

  async function compressImage(file, options = {}) {
    const {
      quality    = 0.8,
      maxWidth   = 1920,
      maxHeight  = 1920,
      outputFormat = 'jpg',
    } = options;

    const img    = await loadImage(file);
    let { width, height } = img;

    // Scale down if needed
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // White background for JPG (transparent → white)
    if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const mime = getOutputMime(outputFormat);
    const blob = await canvasToBlob(canvas, mime, quality);
    return { blob, width, height, mime };
  }

  /* ── Image Format Convert ─────────────────────────────── */

  async function convertFormat(file, outputFormat, quality = 0.92) {
    const img    = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');

    if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    const mime = getOutputMime(outputFormat);
    const blob = await canvasToBlob(canvas, mime, quality);
    return { blob, width: canvas.width, height: canvas.height, mime };
  }

  /* ── Image to PDF ─────────────────────────────────────── */

  async function imagesToPDF(files, options = {}) {
    if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded');
    const { pageSize = 'a4', orientation = 'auto', margin = 10 } = options;
    const { jsPDF } = window.jspdf;

    let doc = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img  = await loadImage(file);
      const iw   = img.naturalWidth;
      const ih   = img.naturalHeight;

      // Determine orientation for this image
      const orient = orientation === 'auto'
        ? (iw > ih ? 'landscape' : 'portrait')
        : orientation;

      if (!doc) {
        doc = new jsPDF({ orientation: orient, unit: 'mm', format: pageSize });
      } else {
        doc.addPage(pageSize, orient);
      }

      // Page dimensions in mm
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      // Fit image within page with margin
      const mw = pw - margin * 2;
      const mh = ph - margin * 2;
      const ratio = Math.min(mw / iw, mh / ih);
      const fw = iw * ratio;
      const fh = ih * ratio;
      const x  = margin + (mw - fw) / 2;
      const y  = margin + (mh - fh) / 2;

      // Convert to base64
      const canvas = document.createElement('canvas');
      canvas.width  = iw; canvas.height = ih;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      doc.addImage(dataUrl, 'JPEG', x, y, fw, fh);
    }

    return doc.output('blob');
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('img-drop-zone')) return;
    Utils.initTabs(document.querySelector('.tabs-container') || document.body);
    initCompress();
    initConvert();
    initToPDF();
  }

  /* ── Compress UI ──────────────────────────────────────── */

  function initCompress() {
    const drop    = document.getElementById('img-drop-zone');
    const input   = document.getElementById('img-file-input');
    const quality = document.getElementById('img-quality');
    const qualVal = document.getElementById('img-quality-val');
    const maxW    = document.getElementById('img-max-width');
    const fmt     = document.getElementById('img-output-format');
    const btn     = document.getElementById('img-compress-btn');
    const results = document.getElementById('img-results');
    const preview = document.getElementById('img-preview');

    let selectedFiles = [];

    if (quality && qualVal) {
      quality.addEventListener('input', () => {
        qualVal.textContent = Math.round(quality.value * 100) + '%';
      });
    }

    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()=> drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(Array.from(input.files)));

    function handleFiles(files) {
      const valid = files.filter(f => f.type.startsWith('image/'));
      if (!valid.length) { Utils.showToast('⚠ Please select image files'); return; }
      selectedFiles = valid;
      renderPreviews();
      btn.disabled = false;
    }

    function renderPreviews() {
      if (!preview) return;
      preview.innerHTML = '';
      selectedFiles.forEach(file => {
        const url = URL.createObjectURL(file);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;';
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:0.65rem;color:var(--text-muted);text-align:center;margin-top:4px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        lbl.textContent = Utils.formatBytes(file.size);
        wrap.appendChild(img); wrap.appendChild(lbl);
        preview.appendChild(wrap);
      });
    }

    btn.addEventListener('click', async () => {
      if (!selectedFiles.length) return;
      Utils.setLoading(btn, true);
      results.innerHTML = '';

      for (const file of selectedFiles) {
        try {
          const opts = {
            quality:      parseFloat(quality?.value || 0.8),
            maxWidth:     parseInt(maxW?.value || 1920),
            maxHeight:    parseInt(maxW?.value || 1920),
            outputFormat: fmt?.value || 'jpg',
          };
          const result = await compressImage(file, opts);
          const saved  = ((1 - result.blob.size / file.size) * 100).toFixed(1);
          const outName = file.name.replace(/\.[^.]+$/, '') + '.' + (fmt?.value || 'jpg');
          const url = URL.createObjectURL(result.blob);

          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.innerHTML = `
            <span class="convert-result__icon">🖼️</span>
            <div class="convert-result__info">
              <div class="convert-result__name">${Utils.sanitize(outName)}</div>
              <div class="convert-result__meta">
                ${Utils.formatBytes(file.size)} → ${Utils.formatBytes(result.blob.size)}
                <span style="color:var(--green-text);margin-left:8px;">↓ ${saved}% smaller</span>
                · ${result.width}×${result.height}px
              </div>
            </div>
            <a href="${url}" download="${outName}" class="btn btn--success btn--sm">⬇ Download</a>
          `;
          results.appendChild(item);
        } catch (err) {
          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.style.cssText = 'border-color:var(--red-border);background:var(--red-dim);';
          item.innerHTML = `<span>✗</span><div class="convert-result__info"><div style="color:var(--red)">${Utils.sanitize(file.name)}</div><div class="convert-result__meta">${err.message}</div></div>`;
          results.appendChild(item);
        }
      }
      Utils.setLoading(btn, false);
    });
  }

  /* ── Convert UI ───────────────────────────────────────── */

  function initConvert() {
    const drop    = document.getElementById('conv-drop-zone');
    if (!drop) return;
    const input   = document.getElementById('conv-file-input');
    const fmt     = document.getElementById('conv-format');
    const quality = document.getElementById('conv-quality');
    const qualVal = document.getElementById('conv-quality-val');
    const btn     = document.getElementById('conv-btn');
    const results = document.getElementById('conv-results');

    let selectedFiles = [];

    if (quality && qualVal) {
      quality.addEventListener('input', () => {
        qualVal.textContent = Math.round(quality.value * 100) + '%';
        const lossless = ['png', 'gif', 'bmp'].includes(fmt?.value);
        quality.disabled = lossless;
        qualVal.style.opacity = lossless ? '0.4' : '1';
      });
    }
    if (fmt) fmt.addEventListener('change', () => quality?.dispatchEvent(new Event('input')));

    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()=> drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(Array.from(input.files)));

    function handleFiles(files) {
      const valid = files.filter(f => f.type.startsWith('image/'));
      if (!valid.length) { Utils.showToast('⚠ Please select image files'); return; }
      selectedFiles = valid;
      btn.disabled = false;
      Utils.showToast(`✓ ${valid.length} image(s) selected`);
    }

    btn.addEventListener('click', async () => {
      if (!selectedFiles.length) return;
      Utils.setLoading(btn, true);
      results.innerHTML = '';

      for (const file of selectedFiles) {
        try {
          const outFmt  = fmt?.value || 'jpg';
          const q       = parseFloat(quality?.value || 0.92);
          const result  = await convertFormat(file, outFmt, q);
          const outName = file.name.replace(/\.[^.]+$/, '') + '.' + outFmt;
          const url     = URL.createObjectURL(result.blob);

          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.innerHTML = `
            <span class="convert-result__icon">🖼️</span>
            <div class="convert-result__info">
              <div class="convert-result__name">${Utils.sanitize(outName)}</div>
              <div class="convert-result__meta">${result.width}×${result.height}px · ${Utils.formatBytes(result.blob.size)} · ${outFmt.toUpperCase()}</div>
            </div>
            <a href="${url}" download="${outName}" class="btn btn--success btn--sm">⬇ Download</a>
          `;
          results.appendChild(item);
        } catch (err) {
          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.style.cssText = 'border-color:var(--red-border);background:var(--red-dim);';
          item.innerHTML = `<span>✗</span><div class="convert-result__info"><div style="color:var(--red)">${Utils.sanitize(file.name)}</div><div class="convert-result__meta">${err.message}</div></div>`;
          results.appendChild(item);
        }
      }
      Utils.setLoading(btn, false);
    });
  }

  /* ── PDF UI ───────────────────────────────────────────── */

  function initToPDF() {
    const drop    = document.getElementById('pdf-drop-zone');
    if (!drop) return;
    const input   = document.getElementById('pdf-file-input');
    const btn     = document.getElementById('pdf-btn');
    const results = document.getElementById('pdf-results');
    const fileList= document.getElementById('pdf-file-list');
    const pageSize= document.getElementById('pdf-page-size');
    const orient  = document.getElementById('pdf-orientation');
    const margin  = document.getElementById('pdf-margin');

    let selectedFiles = [];

    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()=> drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(Array.from(input.files)));

    function handleFiles(files) {
      const valid = files.filter(f => f.type.startsWith('image/'));
      if (!valid.length) { Utils.showToast('⚠ Please select image files'); return; }
      selectedFiles = [...selectedFiles, ...valid];
      renderList();
      btn.disabled = false;
    }

    function renderList() {
      if (!fileList) return;
      fileList.innerHTML = '';
      selectedFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item fade-in';
        item.innerHTML = `
          <span class="file-item__icon">🖼️</span>
          <div class="file-item__info">
            <div class="file-item__name">${Utils.sanitize(file.name)}</div>
            <div class="file-item__size">${Utils.formatBytes(file.size)}</div>
          </div>
          <button class="file-item__remove" data-idx="${idx}">✕</button>
        `;
        fileList.appendChild(item);
      });
      fileList.querySelectorAll('.file-item__remove').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          selectedFiles.splice(parseInt(b.dataset.idx), 1);
          renderList();
          btn.disabled = selectedFiles.length === 0;
        });
      });
    }

    btn.addEventListener('click', async () => {
      if (!selectedFiles.length) return;
      Utils.setLoading(btn, true);
      results.innerHTML = '';
      try {
        const blob = await imagesToPDF(selectedFiles, {
          pageSize:    pageSize?.value || 'a4',
          orientation: orient?.value  || 'auto',
          margin:      parseInt(margin?.value || 10),
        });
        const url  = URL.createObjectURL(blob);
        const name = 'images-cryptowave.pdf';
        const item = document.createElement('div');
        item.className = 'convert-result fade-in';
        item.innerHTML = `
          <span class="convert-result__icon">📄</span>
          <div class="convert-result__info">
            <div class="convert-result__name">${name}</div>
            <div class="convert-result__meta">${selectedFiles.length} page(s) · ${Utils.formatBytes(blob.size)}</div>
          </div>
          <a href="${url}" download="${name}" class="btn btn--success btn--sm">⬇ Download PDF</a>
        `;
        results.appendChild(item);
      } catch (err) {
        Utils.showToast(`✗ ${err.message}`);
      }
      Utils.setLoading(btn, false);
    });
  }

  return { init, compressImage, convertFormat, imagesToPDF };

})();

document.addEventListener('DOMContentLoaded', () => { ImageModule.init(); Utils.initNavbar(); });
window.ImageModule = ImageModule;
