/* Video Rotate/Flip — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('vr-drop-zone');
  const fileInput  = document.getElementById('vr-file-input');
  const controlsEl = document.getElementById('vr-controls');
  const videoEl    = document.getElementById('vr-preview');
  const fileNameEl = document.getElementById('vr-filename');
  const fileSizeEl = document.getElementById('vr-filesize');
  const durationEl = document.getElementById('vr-duration');
  const applyBtn   = document.getElementById('vr-apply-btn');
  const statusEl   = document.getElementById('vr-status');
  const progressEl = document.getElementById('vr-progress');
  const progressBar= document.getElementById('vr-progress-bar');
  const logEl      = document.getElementById('vr-log');

  let ffmpeg    = null;
  let isLoaded  = false;
  let currentFile = null;
  let selectedRotation = 'none';
  let selectedFlip     = 'none';

  // — Option pickers —
  document.getElementById('vr-rotation-grid').addEventListener('click', e => {
    const opt = e.target.closest('.vr-option');
    if (!opt) return;
    document.querySelectorAll('#vr-rotation-grid .vr-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedRotation = opt.dataset.value;
  });

  document.getElementById('vr-flip-grid').addEventListener('click', e => {
    const opt = e.target.closest('.vr-option');
    if (!opt) return;
    document.querySelectorAll('#vr-flip-grid .vr-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedFlip = opt.dataset.value;
  });

  // — Status / progress helpers —
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vr-status vr-status--' + (type || 'idle');
  }

  function setProgress(pct) {
    progressEl.style.display = pct >= 0 && pct < 100 ? 'block' : 'none';
    progressBar.style.width = pct + '%';
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
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
      durationEl.textContent = fmtDur(videoEl.duration);
      controlsEl.classList.remove('hidden');
      setStatus('Video loaded. Choose a transform and click Apply.', 'idle');
    };
  }

  // — Build ffmpeg vf filter string —
  function buildFilter(rotation, flip) {
    const parts = [];

    // transpose: 1=CW90, 2=CCW90, clock+vflip=180
    if (rotation === 'cw90')  parts.push('transpose=1');
    if (rotation === 'ccw90') parts.push('transpose=2');
    if (rotation === '180')   parts.push('transpose=2,transpose=2');

    if (flip === 'hflip') parts.push('hflip');
    if (flip === 'vflip') parts.push('vflip');

    return parts.join(',');
  }

  // — Apply button —
  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const filter = buildFilter(selectedRotation, selectedFlip);
    if (!filter) {
      setStatus('Please select at least one rotation or flip.', 'error');
      return;
    }

    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'output.mp4';

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));
      setStatus('Processing…', 'working');

      await ffmpeg.run(
        '-i', inputName,
        '-vf', filter,
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
      a.download = base + '_rotated.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

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
