'use strict';

(function () {

  let files = [];
  let idCounter = 0;

  /* ── Helpers ──────────────────────────────────────────── */

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function addFiles(newFiles) {
    let skipped = 0;
    for (const f of newFiles) {
      if (f.type === 'application/pdf') {
        files.push({ id: idCounter++, file: f });
      } else {
        skipped++;
      }
    }
    if (skipped) Utils.showToast(`⚠ ${skipped} non-PDF file${skipped > 1 ? 's' : ''} skipped`);
    renderList();
  }

  function removeFile(id) {
    files = files.filter(f => f.id !== id);
    renderList();
  }

  function moveFile(id, dir) {
    const idx = files.findIndex(f => f.id === id);
    const to = idx + dir;
    if (to < 0 || to >= files.length) return;
    [files[idx], files[to]] = [files[to], files[idx]];
    renderList();
  }

  function renderList() {
    const listEl  = document.getElementById('pdf-file-list');
    const mergeBtn = document.getElementById('pdf-merge-btn');
    const counter  = document.getElementById('pdf-file-count');

    counter.textContent = files.length ? `${files.length} file${files.length > 1 ? 's' : ''} added` : '';

    if (files.length === 0) {
      listEl.innerHTML = '<p class="placeholder-msg">No PDF files added yet. Drop files above or click to browse.</p>';
      mergeBtn.disabled = true;
      return;
    }

    mergeBtn.disabled = files.length < 2;
    if (files.length === 1) mergeBtn.title = 'Add at least 2 PDFs to merge';

    listEl.innerHTML = files.map((item, idx) => `
      <div class="pdf-row">
        <div class="pdf-row__num">${idx + 1}</div>
        <div class="pdf-row__icon">📄</div>
        <div class="pdf-row__info">
          <div class="pdf-row__name">${escapeHtml(item.file.name)}</div>
          <div class="pdf-row__size">${formatSize(item.file.size)}</div>
        </div>
        <div class="pdf-row__actions">
          <button class="pdf-move-btn" onclick="window.__pdfMerge.move(${item.id},-1)" ${idx === 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button class="pdf-move-btn" onclick="window.__pdfMerge.move(${item.id},1)"  ${idx === files.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
          <button class="pdf-remove-btn" onclick="window.__pdfMerge.remove(${item.id})" title="Remove">✕</button>
        </div>
      </div>
    `).join('');
  }

  async function merge() {
    if (files.length < 2) return;

    const mergeBtn = document.getElementById('pdf-merge-btn');
    mergeBtn.disabled = true;
    mergeBtn.textContent = '⏳ Merging…';

    try {
      const { PDFDocument } = PDFLib;
      const merged = await PDFDocument.create();

      for (const item of files) {
        const buf = await item.file.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }

      const bytes = await merged.save();
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href     = url;
      a.download = 'merged.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Utils.showToast('✅ PDF merged and downloaded!');
    } catch (err) {
      Utils.showToast('❌ Error: ' + err.message);
      console.error(err);
    } finally {
      mergeBtn.disabled = files.length < 2;
      mergeBtn.textContent = '🔗 Merge & Download PDF';
    }
  }

  /* ── Expose for inline onclick ─────────────────────────── */
  window.__pdfMerge = { move: moveFile, remove: removeFile };

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const dropZone  = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('pdf-file-input');
    const mergeBtn  = document.getElementById('pdf-merge-btn');
    const clearBtn  = document.getElementById('pdf-clear-btn');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drop-zone--active');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--active'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone--active');
      addFiles([...e.dataTransfer.files]);
    });

    fileInput.addEventListener('change', () => {
      addFiles([...fileInput.files]);
      fileInput.value = '';
    });

    mergeBtn.addEventListener('click', merge);

    clearBtn.addEventListener('click', () => {
      files = [];
      renderList();
    });

    renderList();
  });

})();
