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

  const MAX_PREVIEW_ITEMS = 12;
  const LARGE_IMAGE_BATCH_BYTES = 40 * 1024 * 1024;
  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const JSPDF_INTEGRITY = 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk';
  let jsPdfPromise = null;

  async function loadImage(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close(),
        };
      } catch (_) {}
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload  = () => {
        URL.revokeObjectURL(url);
        resolve({
          source: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          close: () => {},
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  function closeImage(img) {
    try { img?.close?.(); } catch (_) {}
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode image')), mime, quality);
    });
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

  function getScaledSize(width, height, maxWidth, maxHeight) {
    if (width <= maxWidth && height <= maxHeight) return { width, height };
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function fillBackground(ctx, width, height, outputFormat) {
    if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawScaledImage(img, width, height, outputFormat, stepped = false) {
    let source = img.source;
    let sourceWidth = img.width;
    let sourceHeight = img.height;

    if (stepped) {
      while (sourceWidth > width * 2 || sourceHeight > height * 2) {
        const nextWidth = Math.max(width, Math.round(sourceWidth * 0.5));
        const nextHeight = Math.max(height, Math.round(sourceHeight * 0.5));
        const nextCanvas = makeCanvas(nextWidth, nextHeight);
        const nextCtx = nextCanvas.getContext('2d', { alpha: outputFormat !== 'jpg' && outputFormat !== 'jpeg' });
        fillBackground(nextCtx, nextWidth, nextHeight, outputFormat);
        nextCtx.imageSmoothingEnabled = true;
        nextCtx.imageSmoothingQuality = 'medium';
        nextCtx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, nextWidth, nextHeight);
        source = nextCanvas;
        sourceWidth = nextWidth;
        sourceHeight = nextHeight;
      }
    }

    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: outputFormat !== 'jpg' && outputFormat !== 'jpeg' });
    fillBackground(ctx, width, height, outputFormat);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    return canvas;
  }

  function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function getBatchSize(files) {
    return files.reduce((sum, file) => sum + file.size, 0);
  }

  function createStatusLine(text, type = 'info') {
    const el = document.createElement('div');
    el.className = `alert alert--${type}`;
    el.style.marginBottom = '12px';
    el.style.gridColumn = '1 / -1';
    el.textContent = text;
    return el;
  }

  function loadScriptOnce(src, integrity) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (window.jspdf?.jsPDF) resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      if (integrity) script.integrity = integrity;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load PDF engine'));
      document.head.appendChild(script);
    });
  }

  async function ensureJsPDF() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    jsPdfPromise = jsPdfPromise || loadScriptOnce(JSPDF_URL, JSPDF_INTEGRITY).then(() => {
      if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded');
      return window.jspdf.jsPDF;
    });
    return jsPdfPromise;
  }

  /* ── Image Compress ───────────────────────────────────── */

  async function compressImage(file, options = {}) {
    const {
      quality    = 0.8,
      maxWidth   = 1920,
      maxHeight  = 1920,
      outputFormat = 'jpg',
    } = options;

    const img = await loadImage(file);
    try {
      const { width, height } = getScaledSize(img.width, img.height, maxWidth, maxHeight);
      const canvas = drawScaledImage(img, width, height, outputFormat, true);
      const mime = getOutputMime(outputFormat);
      const blob = await canvasToBlob(canvas, mime, quality);
      canvas.width = 0;
      canvas.height = 0;
      return { blob, width, height, mime };
    } finally {
      closeImage(img);
    }
  }

  /* ── Image Format Convert ─────────────────────────────── */

  async function convertFormat(file, outputFormat, quality = 0.92) {
    const img = await loadImage(file);
    try {
      const canvas = drawScaledImage(img, img.width, img.height, outputFormat, false);
      const mime = getOutputMime(outputFormat);
      const blob = await canvasToBlob(canvas, mime, quality);
      const width = canvas.width;
      const height = canvas.height;
      canvas.width = 0;
      canvas.height = 0;
      return { blob, width, height, mime };
    } finally {
      closeImage(img);
    }
  }

  /* ── Image to PDF ─────────────────────────────────────── */

  async function imagesToPDF(files, options = {}) {
    const { pageSize = 'a4', orientation = 'auto', margin = 10 } = options;
    const jsPDF = await ensureJsPDF();
    let doc = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img = await loadImage(file);
      try {
        const iw = img.width;
        const ih = img.height;
        const orient = orientation === 'auto'
          ? (iw > ih ? 'landscape' : 'portrait')
          : orientation;

        if (!doc) {
          doc = new jsPDF({ orientation: orient, unit: 'mm', format: pageSize });
        } else {
          doc.addPage(pageSize, orient);
        }

        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const mw = pw - margin * 2;
        const mh = ph - margin * 2;
        const ratio = Math.min(mw / iw, mh / ih);
        const fw = iw * ratio;
        const fh = ih * ratio;
        const x = margin + (mw - fw) / 2;
        const y = margin + (mh - fh) / 2;
        const scaled = getScaledSize(iw, ih, 2200, 2200);
        const canvas = drawScaledImage(img, scaled.width, scaled.height, 'jpg', true);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        canvas.width = 0;
        canvas.height = 0;

        doc.addImage(dataUrl, 'JPEG', x, y, fw, fh);
      } finally {
        closeImage(img);
      }
      await yieldToBrowser();
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
      const batchSize = getBatchSize(selectedFiles);
      if (selectedFiles.length > 1 || batchSize >= LARGE_IMAGE_BATCH_BYTES) {
        const note = createStatusLine(
          `${selectedFiles.length} image(s), ${Utils.formatBytes(batchSize)} selected. Large batches run locally and may take longer; keep this tab open.`,
          batchSize >= LARGE_IMAGE_BATCH_BYTES ? 'warning' : 'info'
        );
        preview.appendChild(note);
      }
      selectedFiles.slice(0, MAX_PREVIEW_ITEMS).forEach(file => {
        const url = URL.createObjectURL(file);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;';
        const img = document.createElement('img');
        img.onload = () => URL.revokeObjectURL(url);
        img.src = url;
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:0.65rem;color:var(--text-muted);text-align:center;margin-top:4px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        lbl.textContent = Utils.formatBytes(file.size);
        wrap.appendChild(img); wrap.appendChild(lbl);
        preview.appendChild(wrap);
      });
      if (selectedFiles.length > MAX_PREVIEW_ITEMS) {
        const more = document.createElement('div');
        more.style.cssText = 'width:80px;height:80px;border-radius:8px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;text-align:center;font-size:0.72rem;color:var(--text-muted);padding:8px;';
        more.textContent = `+${selectedFiles.length - MAX_PREVIEW_ITEMS} more`;
        preview.appendChild(more);
      }
    }

    btn.addEventListener('click', async () => {
      if (!selectedFiles.length) return;
      Utils.setLoading(btn, true);
      results.innerHTML = '';
      const batchSize = getBatchSize(selectedFiles);
      const statusLine = createStatusLine(
        `Processing ${selectedFiles.length} image(s), ${Utils.formatBytes(batchSize)} total. Keep this tab open until downloads appear.`,
        batchSize >= LARGE_IMAGE_BATCH_BYTES ? 'warning' : 'info'
      );
      results.appendChild(statusLine);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          statusLine.textContent = `Compressing ${i + 1}/${selectedFiles.length}: ${file.name}`;
          btn.innerHTML = `<span class="spinner"></span> Processing ${i + 1}/${selectedFiles.length}…`;
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
          item.querySelector('a').addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 10000));
          results.appendChild(item);
        } catch (err) {
          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.style.cssText = 'border-color:var(--red-border);background:var(--red-dim);';
          item.innerHTML = `<span>✗</span><div class="convert-result__info"><div style="color:var(--red)">${Utils.sanitize(file.name)}</div><div class="convert-result__meta">${err.message}</div></div>`;
          results.appendChild(item);
        }
        await yieldToBrowser();
      }
      statusLine.className = 'alert alert--success';
      statusLine.textContent = `Done. ${selectedFiles.length} image(s) processed locally.`;
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
      const batchSize = getBatchSize(selectedFiles);
      const statusLine = createStatusLine(
        `Converting ${selectedFiles.length} image(s), ${Utils.formatBytes(batchSize)} total. Keep this tab open until downloads appear.`,
        batchSize >= LARGE_IMAGE_BATCH_BYTES ? 'warning' : 'info'
      );
      results.appendChild(statusLine);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          statusLine.textContent = `Converting ${i + 1}/${selectedFiles.length}: ${file.name}`;
          btn.innerHTML = `<span class="spinner"></span> Processing ${i + 1}/${selectedFiles.length}…`;
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
          item.querySelector('a').addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 10000));
          results.appendChild(item);
        } catch (err) {
          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.style.cssText = 'border-color:var(--red-border);background:var(--red-dim);';
          item.innerHTML = `<span>✗</span><div class="convert-result__info"><div style="color:var(--red)">${Utils.sanitize(file.name)}</div><div class="convert-result__meta">${err.message}</div></div>`;
          results.appendChild(item);
        }
        await yieldToBrowser();
      }
      statusLine.className = 'alert alert--success';
      statusLine.textContent = `Done. ${selectedFiles.length} image(s) converted locally.`;
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
        item.querySelector('a').addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 10000));
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
