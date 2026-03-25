/* PDF to Images — pdf.js */
(function () {
  'use strict';

  const dropZone   = document.getElementById('pi-drop-zone');
  const fileInput  = document.getElementById('pi-file-input');
  const controlsEl = document.getElementById('pi-controls');
  const fileNameEl = document.getElementById('pi-filename');
  const pageCount  = document.getElementById('pi-page-count');
  const scaleSelect= document.getElementById('pi-scale');
  const fmtSelect  = document.getElementById('pi-format');
  const renderBtn  = document.getElementById('pi-render-btn');
  const dlAllBtn   = document.getElementById('pi-dl-all-btn');
  const gallery    = document.getElementById('pi-gallery');
  const statusEl   = document.getElementById('pi-status');
  const progressEl = document.getElementById('pi-progress');
  const progressBar= document.getElementById('pi-progress-bar');

  let pdfDoc = null;
  let renderedPages = []; // { canvas, pageNum }
  let currentFileName = 'document';

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'pi-status pi-status--' + (type || 'idle');
  }

  function setProgress(pct) {
    progressEl.style.display = pct >= 0 && pct < 100 ? 'block' : 'none';
    progressBar.style.width = pct + '%';
  }

  // Drop zone
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-zone--over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    const f = e.dataTransfer.files[0];
    if (f) loadPDF(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadPDF(fileInput.files[0]); });

  async function loadPDF(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('Please select a PDF file.', 'error'); return;
    }
    currentFileName = file.name.replace(/\.pdf$/i, '') || 'document';
    fileNameEl.textContent = file.name;
    setStatus('Loading PDF…', 'working');
    gallery.innerHTML = '';
    renderedPages = [];
    dlAllBtn.disabled = true;

    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pageCount.textContent = pdfDoc.numPages + ' page' + (pdfDoc.numPages > 1 ? 's' : '');
    controlsEl.classList.remove('hidden');
    setStatus('PDF loaded. Click Render Pages to convert.', 'idle');
  }

  renderBtn.addEventListener('click', async () => {
    if (!pdfDoc) return;
    gallery.innerHTML = '';
    renderedPages = [];
    dlAllBtn.disabled = true;
    const scale = parseFloat(scaleSelect.value) || 1.5;
    const fmt   = fmtSelect.value || 'image/png';
    const ext   = fmt === 'image/jpeg' ? 'jpg' : 'png';
    const n     = pdfDoc.numPages;

    renderBtn.disabled = true;
    setProgress(0);
    setStatus('Rendering pages…', 'working');

    for (let i = 1; i <= n; i++) {
      const page = await pdfDoc.getPage(i);
      const vp   = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      renderedPages.push({ canvas, pageNum: i, ext });

      // Gallery card
      const card = document.createElement('div');
      card.className = 'pi-card';
      const thumb = document.createElement('canvas');
      thumb.className = 'pi-thumb';
      const maxW = 240, ratio = maxW / canvas.width;
      thumb.width  = maxW;
      thumb.height = Math.round(canvas.height * ratio);
      thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
      const label = document.createElement('div');
      label.className = 'pi-card__label';
      label.textContent = 'Page ' + i;
      const btn = document.createElement('button');
      btn.className = 'btn btn--ghost btn--sm';
      btn.textContent = '⬇ Download';
      btn.addEventListener('click', () => downloadPage(i - 1));
      card.appendChild(thumb);
      card.appendChild(label);
      card.appendChild(btn);
      gallery.appendChild(card);

      setProgress(Math.round((i / n) * 100));
    }

    renderBtn.disabled = false;
    dlAllBtn.disabled = false;
    setProgress(100);
    setStatus('Done! ' + n + ' page' + (n > 1 ? 's' : '') + ' rendered.', 'done');
    setTimeout(() => setProgress(100), 800);
  });

  function downloadPage(idx) {
    const { canvas, pageNum, ext } = renderedPages[idx];
    const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFileName + '_page' + pageNum + '.' + ext;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, mime, 0.92);
  }

  dlAllBtn.addEventListener('click', async () => {
    if (!renderedPages.length) return;
    if (typeof JSZip === 'undefined') {
      // Fallback: download one by one
      renderedPages.forEach((_, i) => setTimeout(() => downloadPage(i), i * 300));
      return;
    }
    setStatus('Zipping all pages…', 'working');
    dlAllBtn.disabled = true;
    const zip = new JSZip();
    for (const { canvas, pageNum, ext } of renderedPages) {
      const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise(res => canvas.toBlob(res, mime, 0.92));
      const buf  = await blob.arrayBuffer();
      zip.file(currentFileName + '_page' + pageNum + '.' + ext, buf);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName + '_pages.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    dlAllBtn.disabled = false;
    setStatus('ZIP downloaded.', 'done');
  });

  setStatus('Upload a PDF to get started.', 'idle');
})();
