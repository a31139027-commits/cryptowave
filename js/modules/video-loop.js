/* Video Loop Maker — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone    = document.getElementById('vl-drop-zone');
  const fileInput   = document.getElementById('vl-file-input');
  const controlsEl  = document.getElementById('vl-controls');
  const videoEl     = document.getElementById('vl-preview');
  const fileNameEl  = document.getElementById('vl-filename');
  const fileSizeEl  = document.getElementById('vl-filesize');
  const durationEl  = document.getElementById('vl-duration');
  const loopGrid    = document.getElementById('vl-loop-grid');
  const customInput = document.getElementById('vl-custom-input');
  const totalDurEl  = document.getElementById('vl-total-dur');
  const estSizeEl   = document.getElementById('vl-est-size');
  const applyBtn    = document.getElementById('vl-apply-btn');
  const statusEl    = document.getElementById('vl-status');
  const progressEl  = document.getElementById('vl-progress');
  const progressBar = document.getElementById('vl-progress-bar');
  const logEl       = document.getElementById('vl-log');

  let ffmpeg      = null;
  let isLoaded    = false;
  let currentFile = null;
  let selectedLoops = 3;

  // — Preset loop buttons —
  loopGrid.addEventListener('click', e => {
    const btn = e.target.closest('.vl-loop-btn');
    if (!btn) return;
    setLoops(parseInt(btn.dataset.loops));
  });

  function setLoops(n) {
    n = Math.max(2, Math.min(20, n || 2));
    selectedLoops = n;
    loopGrid.querySelectorAll('.vl-loop-btn').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.loops) === n);
    });
    customInput.value = n;
    updateInfo();
  }

  customInput.addEventListener('input', () => {
    const n = parseInt(customInput.value);
    if (!isNaN(n) && n >= 2 && n <= 20) {
      selectedLoops = n;
      loopGrid.querySelectorAll('.vl-loop-btn').forEach(b => {
        b.classList.toggle('selected', parseInt(b.dataset.loops) === n);
      });
    }
    updateInfo();
  });

  customInput.addEventListener('blur', () => {
    let n = parseInt(customInput.value);
    if (isNaN(n) || n < 2) n = 2;
    if (n > 20) n = 20;
    setLoops(n);
  });

  function updateInfo() {
    if (!currentFile || !videoEl.duration) return;
    const n = parseInt(customInput.value) || selectedLoops;
    const totalSec = videoEl.duration * n;
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toFixed(1).padStart(4, '0');
    totalDurEl.textContent = m + ':' + s;
    const estBytes = currentFile.size * n;
    estSizeEl.textContent = estBytes > 1048576
      ? (estBytes / 1048576).toFixed(1) + ' MB'
      : (estBytes / 1024).toFixed(0) + ' KB';
  }

  // — Helpers —
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vl-status vl-status--' + (type || 'idle');
  }

  function setProgress(pct) {
    progressEl.style.display = pct >= 0 && pct < 100 ? 'block' : 'none';
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
      corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
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
      updateInfo();
      controlsEl.classList.remove('hidden');
      setStatus('Video loaded. Choose loop count and click Create Loop.', 'idle');
    };
  }

  // — Apply button —
  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    const n = Math.max(2, Math.min(20, parseInt(customInput.value) || selectedLoops));
    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'looped.mp4';

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));

      // Build filelist.txt: repeat the same file N times
      const listContent = Array.from({ length: n }, () => `file '${inputName}'`).join('\n');
      ffmpeg.FS('writeFile', 'filelist.txt', new TextEncoder().encode(listContent));

      setStatus(`Creating ${n}× loop… (stream copy)`, 'working');

      await ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'filelist.txt',
        '-c', 'copy',
        outputName
      );

      const data = ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const base = currentFile.name.replace(/\.[^.]+$/, '');
      a.href     = url;
      a.download = base + '_loop' + n + '.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      try { ffmpeg.FS('unlink', inputName);     } catch (_) {}
      try { ffmpeg.FS('unlink', 'filelist.txt'); } catch (_) {}
      try { ffmpeg.FS('unlink', outputName);     } catch (_) {}

      setProgress(100);
      setStatus('Downloaded: ' + a.download, 'done');
    } catch (e) {
      setStatus('Error: ' + e.message + ' — Try a smaller loop count or different format.', 'error');
    } finally {
      applyBtn.disabled = false;
      setTimeout(() => setProgress(100), 500);
    }
  });

  setStatus('Upload a video to get started.', 'idle');
})();
