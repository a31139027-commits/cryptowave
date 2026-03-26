/* Audio Reverser — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('ar-drop-zone');
  const fileInput  = document.getElementById('ar-file-input');
  const controlsEl = document.getElementById('ar-controls');
  const audioEl    = document.getElementById('ar-preview');
  const fileNameEl = document.getElementById('ar-filename');
  const fileSizeEl = document.getElementById('ar-filesize');
  const durationEl = document.getElementById('ar-duration');
  const applyBtn   = document.getElementById('ar-apply-btn');
  const statusEl   = document.getElementById('ar-status');
  const progressEl = document.getElementById('ar-progress');
  const progressBar= document.getElementById('ar-progress-bar');
  const logEl      = document.getElementById('ar-log');

  let ffmpeg      = null;
  let isLoaded    = false;
  let currentFile = null;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'ar-status ar-status--' + (type || 'idle');
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
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });

  function loadFile(file) {
    if (!file.type.startsWith('audio/')) { setStatus('Please select an audio file.', 'error'); return; }
    currentFile = file;
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    audioEl.onloadedmetadata = () => {
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
      durationEl.textContent = fmtDur(audioEl.duration);
      controlsEl.classList.remove('hidden');
      setStatus('Audio loaded. Click Reverse & Download to process.', 'idle');
    };
  }

  applyBtn.addEventListener('click', async () => {
    if (!currentFile || applyBtn.disabled) return;
    if (!await loadFFmpeg()) return;

    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp3';
    const inputName  = 'input.' + ext;
    const outputName = 'output.' + ext;

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));

      setStatus('Reversing audio…', 'working');

      await ffmpeg.run(
        '-i', inputName,
        '-af', 'areverse',
        '-c:a', ext === 'mp3' ? 'libmp3lame' : ext === 'ogg' ? 'libvorbis' : 'aac',
        outputName
      );

      const data = ffmpeg.FS('readFile', outputName);
      const mime = currentFile.type || 'audio/mpeg';
      const blob = new Blob([data.buffer], { type: mime });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const base = currentFile.name.replace(/\.[^.]+$/, '');
      a.href     = url;
      a.download = base + '_reversed.' + ext;
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

  setStatus('Upload an audio file to get started.', 'idle');
})();
