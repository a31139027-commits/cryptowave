/* Video Crop — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('vc-drop-zone');
  const fileInput  = document.getElementById('vc-file-input');
  const controlsEl = document.getElementById('vc-controls');
  const videoEl    = document.getElementById('vc-preview');
  const fileNameEl = document.getElementById('vc-filename');
  const fileSizeEl = document.getElementById('vc-filesize');
  const dimEl      = document.getElementById('vc-dimensions');
  const applyBtn   = document.getElementById('vc-apply-btn');
  const statusEl   = document.getElementById('vc-status');
  const progressEl = document.getElementById('vc-progress');
  const progressBar= document.getElementById('vc-progress-bar');
  const logEl      = document.getElementById('vc-log');

  const xInput  = document.getElementById('vc-x');
  const yInput  = document.getElementById('vc-y');
  const wInput  = document.getElementById('vc-w');
  const hInput  = document.getElementById('vc-h');
  const wLabel  = document.getElementById('vc-w-label');
  const hLabel  = document.getElementById('vc-h-label');

  let ffmpeg    = null;
  let isLoaded  = false;
  let currentFile = null;
  let vidW = 0, vidH = 0;

  // — Status / progress helpers —
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vc-status vc-status--' + (type || 'idle');
  }

  function setProgress(pct) {
    progressEl.style.display = pct >= 0 && pct < 100 ? 'flex' : 'none';
    progressBar.style.width = pct + '%';
    progressEl.dataset.pct = Math.round(pct) + '%';
  }

  function fmtDur(s) {
    s = parseFloat(s) || 0;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1).padStart(4, '0');
    return m + ':' + sec;
  }

  // — FFmpeg loader —
  async function loadFFmpeg() {
    if (isLoaded) return true;
    const { createFFmpeg, fetchFile } = window.FFmpeg || {};
    if (!createFFmpeg) { setStatus('FFmpeg failed to load. Please refresh.', 'error'); return false; }
    ffmpeg = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      progress: ({ ratio }) => { if (ratio > 0) setProgress(Math.round(ratio * 100)); },
      logger: ({ message }) => { if (logEl) logEl.textContent = message; }
    });
    setStatus('Loading FFmpeg engine…', 'working');
    try {
      await ffmpeg.load();
      window._fetchFile = window._fetchFile || fetchFile;
      isLoaded = true;
      return true;
    } catch (e) {
      setStatus('FFmpeg load failed: ' + e.message, 'error');
      return false;
    }
  }

  // — Drop zone —
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-zone--over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });

  function loadFile(file) {
    if (!file.type.startsWith('video/')) { setStatus('Please select a video file.', 'error'); return; }
    currentFile = file;
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoEl.onloadedmetadata = () => {
      vidW = videoEl.videoWidth;
      vidH = videoEl.videoHeight;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
      dimEl.textContent = vidW + ' × ' + vidH + ' px';

      // Default: full frame
      xInput.max = vidW; xInput.value = 0;
      yInput.max = vidH; yInput.value = 0;
      wInput.max = vidW; wInput.value = vidW;
      hInput.max = vidH; hInput.value = vidH;

      syncLabels();
      controlsEl.classList.remove('hidden');
      setStatus('Video loaded. Adjust crop area and click Apply.', 'idle');
    };
  }

  function syncLabels() {
    if (wLabel) wLabel.textContent = wInput.value + ' px';
    if (hLabel) hLabel.textContent = hInput.value + ' px';
  }

  // — Input sync —
  [xInput, yInput, wInput, hInput].forEach(inp => {
    inp.addEventListener('input', syncLabels);
  });

  // — Preset buttons —
  document.getElementById('vc-preset-grid').addEventListener('click', e => {
    const btn = e.target.closest('.vc-preset-btn');
    if (!btn || !vidW) return;
    document.querySelectorAll('.vc-preset-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const preset = btn.dataset.preset;
    let x, y, w, h;

    if (preset === 'full') {
      x = 0; y = 0; w = vidW; h = vidH;
    } else if (preset === 'square') {
      const side = Math.min(vidW, vidH);
      x = Math.floor((vidW - side) / 2);
      y = Math.floor((vidH - side) / 2);
      w = side; h = side;
    } else if (preset === '16:9') {
      // crop to 16:9 from center
      const targetH = Math.round(vidW * 9 / 16);
      if (targetH <= vidH) {
        x = 0; w = vidW;
        h = targetH; y = Math.floor((vidH - h) / 2);
      } else {
        y = 0; h = vidH;
        w = Math.round(vidH * 16 / 9); x = Math.floor((vidW - w) / 2);
      }
    } else if (preset === '4:3') {
      const targetH = Math.round(vidW * 3 / 4);
      if (targetH <= vidH) {
        x = 0; w = vidW;
        h = targetH; y = Math.floor((vidH - h) / 2);
      } else {
        y = 0; h = vidH;
        w = Math.round(vidH * 4 / 3); x = Math.floor((vidW - w) / 2);
      }
    } else if (preset === '9:16') {
      const targetW = Math.round(vidH * 9 / 16);
      if (targetW <= vidW) {
        y = 0; h = vidH;
        w = targetW; x = Math.floor((vidW - w) / 2);
      } else {
        x = 0; w = vidW;
        h = Math.round(vidW * 16 / 9); y = Math.floor((vidH - h) / 2);
      }
    }

    // Clamp
    x = Math.max(0, Math.min(x, vidW - 2));
    y = Math.max(0, Math.min(y, vidH - 2));
    w = Math.max(2, Math.min(w, vidW - x));
    h = Math.max(2, Math.min(h, vidH - y));

    xInput.value = x; yInput.value = y;
    wInput.value = w; hInput.value = h;
    syncLabels();
  });

  // — Apply —
  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    let x = parseInt(xInput.value) || 0;
    let y = parseInt(yInput.value) || 0;
    let w = parseInt(wInput.value) || vidW;
    let h = parseInt(hInput.value) || vidH;

    // H.264 requires even dimensions
    w = w % 2 === 0 ? w : w - 1;
    h = h % 2 === 0 ? h : h - 1;

    if (w <= 0 || h <= 0) { setStatus('Width and height must be positive.', 'error'); return; }
    if (x + w > vidW || y + h > vidH) { setStatus('Crop area exceeds video dimensions.', 'error'); return; }

    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'output.mp4';

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));
      setStatus('Cropping video…', 'working');

      const cropFilter = 'crop=' + w + ':' + h + ':' + x + ':' + y;

      await ffmpeg.run(
        '-i', inputName,
        '-vf', cropFilter,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac',
        outputName
      );

      const data = ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const base = currentFile.name.replace(/\.[^.]+$/, '');
      a.href     = url;
      a.download = base + '_cropped.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      try { ffmpeg.FS('unlink', inputName);  } catch (_) {}
      try { ffmpeg.FS('unlink', outputName); } catch (_) {}

      setProgress(100);
      setStatus('Downloaded: ' + a.download, 'done');
    } catch (e) {
      setStatus('Error: ' + e.message, 'error');
    } finally {
      applyBtn.disabled = false;
      setTimeout(() => setProgress(100), 500);
    }
  });

  setStatus('Upload a video to get started.', 'idle');
})();
