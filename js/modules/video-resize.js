/* Video Resize — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('vrs-drop-zone');
  const fileInput  = document.getElementById('vrs-file-input');
  const controlsEl = document.getElementById('vrs-controls');
  const videoEl    = document.getElementById('vrs-preview');
  const fileNameEl = document.getElementById('vrs-filename');
  const fileSizeEl = document.getElementById('vrs-filesize');
  const dimEl      = document.getElementById('vrs-dimensions');
  const applyBtn   = document.getElementById('vrs-apply-btn');
  const statusEl   = document.getElementById('vrs-status');
  const progressEl = document.getElementById('vrs-progress');
  const progressBar= document.getElementById('vrs-progress-bar');
  const logEl      = document.getElementById('vrs-log');
  const wInput     = document.getElementById('vrs-w');
  const hInput     = document.getElementById('vrs-h');
  const lockAR     = document.getElementById('vrs-lock-ar');

  let ffmpeg    = null;
  let isLoaded  = false;
  let currentFile = null;
  let vidW = 0, vidH = 0;
  let lockingAR = true;

  // — Status / progress helpers —
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vrs-status vrs-status--' + (type || 'idle');
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
      wInput.value = vidW;
      hInput.value = vidH;
      controlsEl.classList.remove('hidden');
      setStatus('Video loaded. Choose a target size and click Apply.', 'idle');
    };
  }

  // — Aspect ratio lock —
  lockAR.addEventListener('change', () => {
    lockingAR = lockAR.checked;
  });

  wInput.addEventListener('input', () => {
    if (!lockingAR || !vidW || !vidH) return;
    const newW = parseInt(wInput.value) || 0;
    if (newW > 0) {
      let newH = Math.round(newW * vidH / vidW);
      if (newH % 2 !== 0) newH++;
      hInput.value = newH;
    }
  });

  hInput.addEventListener('input', () => {
    if (!lockingAR || !vidW || !vidH) return;
    const newH = parseInt(hInput.value) || 0;
    if (newH > 0) {
      let newW = Math.round(newH * vidW / vidH);
      if (newW % 2 !== 0) newW++;
      wInput.value = newW;
    }
  });

  // — Preset buttons —
  document.getElementById('vrs-preset-grid').addEventListener('click', e => {
    const btn = e.target.closest('.vrs-preset-btn');
    if (!btn) return;
    document.querySelectorAll('.vrs-preset-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const preset = btn.dataset.preset;
    if (preset === 'original') {
      if (vidW) { wInput.value = vidW; hInput.value = vidH; }
      return;
    }

    const targetW = parseInt(preset);
    if (!targetW) return;

    if (vidW && vidH) {
      // Scale to target width, preserve AR
      let newH = Math.round(targetW * vidH / vidW);
      if (newH % 2 !== 0) newH++;
      wInput.value = targetW;
      hInput.value = newH;
    } else {
      wInput.value = targetW;
    }
  });

  // — Apply —
  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    let w = parseInt(wInput.value) || 0;
    let h = parseInt(hInput.value) || 0;

    // H.264 requires even dimensions
    if (w % 2 !== 0) w++;
    if (h % 2 !== 0) h++;

    if (w <= 0 || h <= 0) { setStatus('Please enter valid width and height.', 'error'); return; }

    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'output.mp4';

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));
      setStatus('Resizing video…', 'working');

      await ffmpeg.run(
        '-i', inputName,
        '-vf', 'scale=' + w + ':' + h,
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
      a.download = base + '_' + w + 'x' + h + '.mp4';
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
