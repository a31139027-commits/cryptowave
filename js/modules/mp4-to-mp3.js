'use strict';

(function () {

  let ffmpeg = null;
  let isLoaded = false;

  const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', '3gp', 'wmv', 'm4v', 'ts'];

  function getExt(name) { return name.split('.').pop().toLowerCase(); }

  async function loadFFmpeg() {
    if (isLoaded) return true;
    try {
      const { createFFmpeg, fetchFile } = window.FFmpeg || {};
      if (!createFFmpeg) return false;
      ffmpeg = createFFmpeg({
        log: false,
        progress: ({ ratio }) => {
          const pct = Math.round(ratio * 100);
          const bar = document.getElementById('m2m-progress-fill');
          const lbl = document.getElementById('m2m-progress-label');
          if (bar) bar.style.width = pct + '%';
          if (lbl) lbl.textContent = pct + '%';
        },
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      await ffmpeg.load();
      window._fetchFile = fetchFile;
      isLoaded = true;
      return true;
    } catch (err) {
      console.error('FFmpeg load error:', err);
      return false;
    }
  }

  async function convert(file, bitrate) {
    const loaded = await loadFFmpeg();
    if (!loaded) throw new Error('FFmpeg.wasm could not load. Ensure your server sends Cross-Origin-Isolation headers.');

    const inputName  = 'input_' + Date.now() + '.' + getExt(file.name);
    const outputName = 'output_' + Date.now() + '.mp3';

    ffmpeg.FS('writeFile', inputName, await window._fetchFile(file));
    await ffmpeg.run('-i', inputName, '-vn', '-c:a', 'libmp3lame', '-b:a', bitrate, '-ar', '44100', '-ac', '2', outputName);

    const data = ffmpeg.FS('readFile', outputName);
    try { ffmpeg.FS('unlink', inputName); } catch (_) {}
    try { ffmpeg.FS('unlink', outputName); } catch (_) {}

    return data.buffer;
  }

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const dropZone   = document.getElementById('m2m-drop-zone');
    const fileInput  = document.getElementById('m2m-file-input');
    const fileInfo   = document.getElementById('m2m-file-info');
    const convertBtn = document.getElementById('m2m-convert-btn');
    const bitrateEl  = document.getElementById('m2m-bitrate');
    const progressWrap = document.getElementById('m2m-progress-wrap');
    const resultEl   = document.getElementById('m2m-result');
    const statusEl   = document.getElementById('m2m-status');

    let selectedFile = null;

    // FFmpeg check
    if (typeof SharedArrayBuffer !== 'undefined') {
      statusEl.className = 'alert alert--success';
      statusEl.innerHTML = '<span class="alert__icon">✓</span> Ready — FFmpeg.wasm will load on first conversion.';
    } else {
      statusEl.className = 'alert alert--warning';
      statusEl.innerHTML = '<span class="alert__icon">⚠</span><div><strong>Cross-Origin Isolation Required:</strong> Your server must send <code>Cross-Origin-Opener-Policy: same-origin</code> and <code>Cross-Origin-Embedder-Policy: require-corp</code> headers.</div>';
    }

    function setFile(file) {
      if (!VIDEO_EXTS.includes(getExt(file.name))) {
        Utils.showToast('⚠ Please upload a video file (MP4, MKV, MOV, AVI, WebM…)');
        return;
      }
      selectedFile = file;
      fileInfo.innerHTML = `
        <div class="file-item fade-in">
          <span class="file-item__icon">🎬</span>
          <div class="file-item__info">
            <div class="file-item__name">${Utils.sanitize(file.name)}</div>
            <div class="file-item__size">${Utils.formatBytes(file.size)} · ${getExt(file.name).toUpperCase()}</div>
          </div>
          <button class="file-item__remove" id="m2m-remove">✕</button>
        </div>`;
      document.getElementById('m2m-remove').addEventListener('click', () => {
        selectedFile = null;
        fileInfo.innerHTML = '';
        convertBtn.disabled = true;
        resultEl.innerHTML = '';
      });
      convertBtn.disabled = false;
      resultEl.innerHTML = '';
    }

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); fileInput.value = ''; });

    convertBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      Utils.setLoading(convertBtn, true);
      progressWrap.classList.remove('hidden');
      resultEl.innerHTML = '';

      try {
        const bitrate = bitrateEl.value;
        const buf = await convert(selectedFile, bitrate);
        const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
        const outName  = baseName + '.mp3';
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        const url  = URL.createObjectURL(blob);

        resultEl.innerHTML = `
          <div class="convert-result fade-in">
            <span class="convert-result__icon">✓</span>
            <div class="convert-result__info">
              <div class="convert-result__name">${Utils.sanitize(outName)}</div>
              <div class="convert-result__meta">${Utils.formatBytes(buf.byteLength)} · MP3 · ${bitrate}</div>
            </div>
            <a href="${url}" download="${outName}" class="btn btn--success btn--sm">⬇ Download MP3</a>
          </div>`;
        Utils.showToast('✅ Conversion complete!');
      } catch (err) {
        resultEl.innerHTML = `<div class="alert alert--warning"><span class="alert__icon">✗</span> ${Utils.sanitize(err.message)}</div>`;
      } finally {
        Utils.setLoading(convertBtn, false);
      }
    });
  });

})();
