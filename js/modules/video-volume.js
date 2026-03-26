/* Video Volume Changer — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('vv-drop-zone');
  const fileInput  = document.getElementById('vv-file-input');
  const controlsEl = document.getElementById('vv-controls');
  const videoEl    = document.getElementById('vv-preview');
  const fileNameEl = document.getElementById('vv-filename');
  const fileSizeEl = document.getElementById('vv-filesize');
  const durationEl = document.getElementById('vv-duration');
  const volGrid    = document.getElementById('vv-vol-grid');
  const slider     = document.getElementById('vv-custom-slider');
  const sliderVal  = document.getElementById('vv-custom-val');
  const applyBtn   = document.getElementById('vv-apply-btn');
  const statusEl   = document.getElementById('vv-status');
  const progressEl = document.getElementById('vv-progress');
  const progressBar= document.getElementById('vv-progress-bar');
  const logEl      = document.getElementById('vv-log');

  let ffmpeg      = null;
  let isLoaded    = false;
  let currentFile = null;
  let selectedVol = 1;

  volGrid.addEventListener('click', e => {
    const btn = e.target.closest('.vv-vol-btn');
    if (!btn) return;
    setVol(parseFloat(btn.dataset.vol));
  });

  function setVol(v) {
    v = Math.max(0.05, Math.min(2, v));
    selectedVol = v;
    volGrid.querySelectorAll('.vv-vol-btn').forEach(b => {
      b.classList.toggle('selected', parseFloat(b.dataset.vol) === v);
    });
    slider.value = v;
    sliderVal.textContent = Math.round(v * 100) + '%';
  }

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    selectedVol = v;
    sliderVal.textContent = Math.round(v * 100) + '%';
    volGrid.querySelectorAll('.vv-vol-btn').forEach(b => {
      b.classList.toggle('selected', parseFloat(b.dataset.vol) === v);
    });
  });

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vv-status vv-status--' + (type || 'idle');
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
      fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
      durationEl.textContent = fmtDur(videoEl.duration);
      controlsEl.classList.remove('hidden');
      setStatus('Video loaded. Choose a volume level and click Apply.', 'idle');
    };
  }

  applyBtn.addEventListener('click', async () => {
    if (!currentFile || applyBtn.disabled) return;
    const vol = Math.max(0.05, Math.min(2, parseFloat(slider.value) || selectedVol));
    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'output.mp4';

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));

      setStatus('Adjusting volume to ' + Math.round(vol * 100) + '%…', 'working');

      await ffmpeg.run(
        '-i', inputName,
        '-af', 'volume=' + vol.toFixed(4),
        '-c:v', 'copy',
        '-c:a', 'aac',
        outputName
      );

      const data = ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const base = currentFile.name.replace(/\.[^.]+$/, '');
      a.href     = url;
      a.download = base + '_vol' + Math.round(vol * 100) + '.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

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

  setStatus('Upload a video file to get started.', 'idle');
})();
