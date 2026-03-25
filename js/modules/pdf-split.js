'use strict';

(function () {

  let loadedPdf = null;   // PDFDocument (pdf-lib)
  let totalPages = 0;

  /* ── Helpers ──────────────────────────────────────────── */

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function parseRanges(str, max) {
    // Parses "1,3,5-8,10" into an array of 0-based page indices
    const pages = new Set();
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        if (isNaN(a) || isNaN(b)) return null;
        for (let i = a; i <= b; i++) {
          if (i >= 1 && i <= max) pages.add(i - 1);
        }
      } else {
        const n = Number(part);
        if (isNaN(n)) return null;
        if (n >= 1 && n <= max) pages.add(n - 1);
      }
    }
    return [...pages].sort((a, b) => a - b);
  }

  async function extractPages(sourceDoc, pageIndices) {
    const { PDFDocument } = PDFLib;
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(sourceDoc, pageIndices);
    copied.forEach(p => newDoc.addPage(p));
    return newDoc.save();
  }

  function triggerDownload(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Load PDF ─────────────────────────────────────────── */

  async function loadFile(file) {
    const statusEl = document.getElementById('ps-status');
    const infoEl   = document.getElementById('ps-info');
    statusEl.textContent = 'Loading…';

    try {
      const { PDFDocument } = PDFLib;
      const buf = await file.arrayBuffer();
      loadedPdf  = await PDFDocument.load(buf);
      totalPages = loadedPdf.getPageCount();

      infoEl.innerHTML = `
        <div class="breakdown-row">
          <span class="breakdown-row__label">File</span>
          <span class="breakdown-row__value">${file.name}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Size</span>
          <span class="breakdown-row__value">${formatSize(file.size)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Pages</span>
          <span class="breakdown-row__value">${totalPages}</span>
        </div>
      `;
      document.getElementById('ps-range-hint').textContent = `Enter page numbers 1–${totalPages}, e.g. "1-3, 5, 7-${totalPages}"`;
      document.getElementById('ps-controls').classList.remove('hidden');
      statusEl.textContent = `✅ Loaded — ${totalPages} page${totalPages > 1 ? 's' : ''}`;
    } catch (err) {
      statusEl.textContent = '❌ Failed to load PDF: ' + err.message;
    }
  }

  /* ── Split Actions ────────────────────────────────────── */

  async function splitAll() {
    if (!loadedPdf) return;
    const btn = document.getElementById('ps-split-all-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Splitting…';
    const baseName = document.getElementById('ps-file-input').files[0]?.name.replace(/\.pdf$/i, '') || 'page';

    try {
      for (let i = 0; i < totalPages; i++) {
        const bytes = await extractPages(loadedPdf, [i]);
        triggerDownload(bytes, `${baseName}_page${i + 1}.pdf`);
        // small delay to avoid browser blocking multiple downloads
        await new Promise(r => setTimeout(r, 300));
      }
      Utils.showToast(`✅ Downloaded ${totalPages} pages`);
    } catch (err) {
      Utils.showToast('❌ ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '📄 Split Into Individual Pages';
    }
  }

  async function extractRange() {
    if (!loadedPdf) return;
    const rangeStr = document.getElementById('ps-range-input').value.trim();
    if (!rangeStr) { Utils.showToast('⚠ Enter page numbers first'); return; }

    const indices = parseRanges(rangeStr, totalPages);
    if (!indices || indices.length === 0) {
      Utils.showToast('⚠ Invalid page range'); return;
    }

    const btn = document.getElementById('ps-extract-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Extracting…';
    const baseName = document.getElementById('ps-file-input').files[0]?.name.replace(/\.pdf$/i, '') || 'extracted';

    try {
      const bytes = await extractPages(loadedPdf, indices);
      triggerDownload(bytes, `${baseName}_pages_${rangeStr.replace(/\s/g,'')}.pdf`);
      Utils.showToast(`✅ Extracted ${indices.length} page${indices.length > 1 ? 's' : ''}`);
    } catch (err) {
      Utils.showToast('❌ ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✂️ Extract Selected Pages';
    }
  }

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const dropZone  = document.getElementById('ps-drop-zone');
    const fileInput = document.getElementById('ps-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-zone--active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--active'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drop-zone--active');
      const f = e.dataTransfer.files[0];
      if (f?.type === 'application/pdf') loadFile(f);
      else Utils.showToast('⚠ Please drop a PDF file');
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) loadFile(fileInput.files[0]);
    });

    document.getElementById('ps-split-all-btn').addEventListener('click', splitAll);
    document.getElementById('ps-extract-btn').addEventListener('click', extractRange);
  });

})();
