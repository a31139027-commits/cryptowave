/* Audio Pitch Changer — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone   = document.getElementById('ap-drop-zone');
  const fileInput  = document.getElementById('ap-file-input');
  const controlsEl = document.getElementById('ap-controls');
  const audioEl    = document.getElementById('ap-preview');
  const fileNameEl = document.getElementById('ap-filename');
  const fileSizeEl = document.getElementById('ap-filesize');
  const durationEl = document.getElementById('ap-duration');
  const semiGrid   = document.getElementById('ap-semi-grid');
  const slider     = document.getElementById('ap-custom-slider');
  const sliderVal  = document.getElementById('ap-custom-val');
  const applyBtn   = document.getElementById('ap-apply-btn');
  const statusEl   = document.getElementById('ap-status');
  const progressEl = document.getElementById('ap-progress');
  const progressBar= document.getElementById('ap-progress-bar');
  const logEl      = document.getElementById('ap-log');

  let ffmpeg       = null;
  let isLoaded     = false;
  let currentFile  = null;
  let selectedSemi = 0;

  const BASE_RATE = 44100;

  // semitones → frequency ratio
  function semiToRatio(semi) {
    return Math.pow(2, semi / 12);
  }

  // Build the FFmpeg filter chain for pitch shift without speed change
  // asetrate changes both pitch and speed; atempo counter-corrects speed
  function buildFilter(semi) {
    if (semi === 0) return null;
    const ratio    = semiToRatio(semi);
    const newRate  = Math.round(BASE_RATE * ratio);
    // atempo must be in 0.5–2.0; counter-factor = 1/ratio
    const tempo    = (1 / ratio).toFixed(6);
    return 'asetrate=' + newRate + ',aresample=' + BASE_RATE + ',atempo=' + tempo;
  }

  semiGrid.addEventListener('click', e => {
    const btn = e.target.closest('.ap-semi-btn');
    if (!btn) return;
    setSemi(parseInt(btn.dataset.semi, 10));
  });

  function setSemi(s) {
    s = Math.max(-12, Math.min(12, s));
    selectedSemi = s;
    semiGrid.querySelectorAll('.ap-semi-btn').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.semi, 10) === s);
    });
    slider.value = s;
    sliderVal.textContent = (s > 0 ? '+' : '') + s + ' st';
  }

  slider.addEventListener('input', () => {
    setSemi(parseInt(slider.value, 10));
  });

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'ap-status ap-status--' + (type || 'idle');
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
    if (!file.type.startsWith('audio/')) { setStatus('Please select an audio file.', 'error'); return; }
    currentFile = file;
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    audioEl.onloadedmetadata = () => {
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
      durationEl.textContent = fmtDur(audioEl.duration);
      controlsEl.classList.remove('hidden');
      setStatus('Audio loaded. Choose a pitch shift and click Apply.', 'idle');
    };
  }

  applyBtn.addEventListener('click', async () => {
    if (!currentFile || applyBtn.disabled) return;
    if (selectedSemi === 0) { setStatus('Pitch is already at 0 — select a different value.', 'error'); return; }
    if (!await loadFFmpeg()) return;

    const filter     = buildFilter(selectedSemi);
    const ext        = currentFile.name.split('.').pop().toLowerCase() || 'mp3';
    const inputName  = 'input.' + ext;
    const outputName = 'output.' + ext;

    applyBtn.disabled = true;
    setProgress(0);
    setStatus('Writing file to FFmpeg…', 'working');

    try {
      ffmpeg.FS('writeFile', inputName, await window._fetchFile(currentFile));

      const label = (selectedSemi > 0 ? '+' : '') + selectedSemi + 'st';
      setStatus('Shifting pitch by ' + label + '…', 'working');

      await ffmpeg.run(
        '-i', inputName,
        '-af', filter,
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
      a.download = base + '_pitch' + (selectedSemi > 0 ? '+' : '') + selectedSemi + '.' + ext;
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
