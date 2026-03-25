/* Video Speed Changer — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('vs-drop-zone');
  const fileInput  = document.getElementById('vs-file-input');
  const controlsEl = document.getElementById('vs-controls');
  const videoEl    = document.getElementById('vs-preview');
  const fileNameEl = document.getElementById('vs-filename');
  const fileSizeEl = document.getElementById('vs-filesize');
  const durationEl = document.getElementById('vs-duration');
  const speedGrid  = document.getElementById('vs-speed-grid');
  const slider     = document.getElementById('vs-custom-slider');
  const sliderVal  = document.getElementById('vs-custom-val');
  const applyBtn   = document.getElementById('vs-apply-btn');
  const statusEl   = document.getElementById('vs-status');
  const progressEl = document.getElementById('vs-progress');
  const progressBar= document.getElementById('vs-progress-bar');
  const logEl      = document.getElementById('vs-log');

  let ffmpeg      = null;
  let isLoaded    = false;
  let currentFile = null;
  let selectedSpeed = 1;

  // — Preset speed buttons —
  speedGrid.addEventListener('click', e => {
    const btn = e.target.closest('.vs-speed-btn');
    if (!btn) return;
    setSpeed(parseFloat(btn.dataset.speed));
  });

  function setSpeed(val) {
    selectedSpeed = val;
    // Update preset highlight
    speedGrid.querySelectorAll('.vs-speed-btn').forEach(b => {
      b.classList.toggle('selected', parseFloat(b.dataset.speed) === val);
    });
    // Sync slider (clamp to its range)
    slider.value = Math.max(0.25, Math.min(4, val));
    sliderVal.textContent = val + '×';
  }

  // — Custom slider —
  slider.addEventListener('input', () => {
    const val = parseFloat(parseFloat(slider.value).toFixed(2));
    selectedSpeed = val;
    sliderVal.textContent = val + '×';
    // Deselect presets that don't match
    speedGrid.querySelectorAll('.vs-speed-btn').forEach(b => {
      b.classList.toggle('selected', parseFloat(b.dataset.speed) === val);
    });
  });

  // — Helpers —
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vs-status vs-status--' + (type || 'idle');
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
      setStatus('Video loaded. Choose a speed and click Apply.', 'idle');
    };
  }

  // — Build atempo filter chain (atempo only handles 0.5–2, chain for extremes) —
  function buildAtempoFilter(speed) {
    // atempo range: 0.5–2.0 per filter; chain multiple for out-of-range
    if (speed >= 0.5 && speed <= 2.0) {
      return 'atempo=' + speed;
    } else if (speed < 0.5) {
      // e.g. 0.25 = atempo=0.5,atempo=0.5
      return 'atempo=0.5,atempo=' + (speed / 0.5).toFixed(4);
    } else {
      // speed > 2: chain as needed
      const filters = [];
      let s = speed;
      while (s > 2.0) { filters.push('atempo=2.0'); s /= 2.0; }
      if (s > 1) filters.push('atempo=' + s.toFixed(4));
      return filters.join(',');
    }
  }

  // — Apply button —
  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    if (selectedSpeed === 1) { setStatus('Speed is already 1× — choose a different speed.', 'error'); return; }
    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'output.mp4';
    const pts        = (1 / selectedSpeed).toFixed(6);
    const vFilter    = 'setpts=' + pts + '*PTS';
    const aFilter    = buildAtempoFilter(selectedSpeed);

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));
      setStatus('Changing speed to ' + selectedSpeed + '×…', 'working');

      await ffmpeg.run(
        '-i', inputName,
        '-filter:v', vFilter,
        '-filter:a', aFilter,
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
      a.download = base + '_' + selectedSpeed + 'x.mp4';
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
