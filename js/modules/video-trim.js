/* Video Trimmer — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('vt-drop-zone');
  const fileInput  = document.getElementById('vt-file-input');
  const controlsEl = document.getElementById('vt-controls');
  const videoEl    = document.getElementById('vt-preview');
  const fileNameEl = document.getElementById('vt-filename');
  const fileSizeEl = document.getElementById('vt-filesize');
  const durationEl = document.getElementById('vt-duration');
  const startInput = document.getElementById('vt-start');
  const endInput   = document.getElementById('vt-end');
  const setStartBtn= document.getElementById('vt-set-start');
  const setEndBtn  = document.getElementById('vt-set-end');
  const trimBtn    = document.getElementById('vt-trim-btn');
  const statusEl   = document.getElementById('vt-status');
  const progressEl = document.getElementById('vt-progress');
  const progressBar= document.getElementById('vt-progress-bar');
  const logEl      = document.getElementById('vt-log');

  let ffmpeg = null;
  let currentFile = null;
  let isLoaded = false;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vt-status vt-status--' + (type || 'idle');
  }

  function setProgress(pct) {
    progressEl.style.display = pct >= 0 && pct < 100 ? 'block' : 'none';
    progressBar.style.width = pct + '%';
  }

  function toHMS(s) {
    s = Math.max(0, parseFloat(s) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(3).padStart(6, '0');
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + sec;
  }

  function fmtDisp(s) {
    s = parseFloat(s) || 0;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1).padStart(4,'0');
    return m + ':' + sec;
  }

  async function loadFFmpeg() {
    if (isLoaded) return true;
    const { createFFmpeg, fetchFile } = window.FFmpeg || {};
    if (!createFFmpeg) { setStatus('FFmpeg failed to load. Please refresh.', 'error'); return false; }
    ffmpeg = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      progress: ({ ratio }) => {
        if (ratio > 0) setProgress(Math.round(ratio * 100));
      },
      logger: ({ message }) => {
        if (logEl) logEl.textContent = message;
      }
    });
    setStatus('Loading FFmpeg engine…', 'working');
    try {
      await ffmpeg.load();
      window._fetchFile = fetchFile;
      isLoaded = true;
      return true;
    } catch (e) {
      setStatus('FFmpeg load failed: ' + e.message, 'error');
      return false;
    }
  }

  // Drop zone
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-zone--over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

  function loadFile(file) {
    if (!file.type.startsWith('video/')) { setStatus('Please select a video file.', 'error'); return; }
    currentFile = file;
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoEl.onloadedmetadata = () => {
      const dur = videoEl.duration;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
      durationEl.textContent = fmtDisp(dur);
      startInput.value = '0';
      startInput.max = dur.toFixed(2);
      endInput.value = dur.toFixed(2);
      endInput.max = dur.toFixed(2);
      controlsEl.classList.remove('hidden');
      setStatus('Video loaded. Set start/end times, then click Trim.', 'idle');
    };
  }

  setStartBtn.addEventListener('click', () => {
    startInput.value = videoEl.currentTime.toFixed(2);
  });
  setEndBtn.addEventListener('click', () => {
    endInput.value = videoEl.currentTime.toFixed(2);
  });

  trimBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    const dur = videoEl.duration;
    let start = Math.max(0, parseFloat(startInput.value) || 0);
    let end   = Math.min(dur, parseFloat(endInput.value) || dur);
    if (end <= start) { setStatus('End time must be after start time.', 'error'); return; }

    if (!await loadFFmpeg()) return;

    const ext  = currentFile.name.split('.').pop().toLowerCase() || 'mp4';
    const inputName  = 'input.' + ext;
    const outputName = 'output.' + ext;
    const duration   = (end - start).toFixed(3);

    trimBtn.disabled = true;
    setStatus('Trimming…', 'working');
    setProgress(0);

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));
      // -ss before -i for fast seek; -t for duration; -c copy for speed (keyframe-accurate)
      await ffmpeg.run(
        '-ss', toHMS(start),
        '-i', inputName,
        '-t', duration,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        outputName
      );
      const data = ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: currentFile.type || 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const baseName = currentFile.name.replace(/\.[^.]+$/, '');
      a.href = url;
      a.download = baseName + '_trimmed.' + ext;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      try { ffmpeg.FS('unlink', inputName);  } catch (_) {}
      try { ffmpeg.FS('unlink', outputName); } catch (_) {}
      setProgress(100);
      setStatus('Downloaded: ' + a.download, 'done');
    } catch (e) {
      setStatus('Error: ' + e.message, 'error');
    } finally {
      trimBtn.disabled = false;
      setTimeout(() => setProgress(100), 500);
    }
  });

  setStatus('Upload a video to get started.', 'idle');
})();
