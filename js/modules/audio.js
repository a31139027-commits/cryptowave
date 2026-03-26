/**
 * modules/audio.js — Audio Converter Module
 * Uses: FFmpeg.wasm (v0.12) for in-browser audio conversion
 * Supports: MP3, WAV, FLAC, AAC, OGG, OPUS, M4A, AIFF, WMA (input)
 *           MP3, WAV, FLAC, AAC, OGG, OPUS, M4A (output)
 * Also: Video → Audio extraction (MP4, MKV, MOV, AVI, WebM)
 *
 * NOTE: Requires Cross-Origin-Isolation headers for SharedArrayBuffer:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 * These must be set on the server serving this page.
 */

'use strict';

const AudioModule = (() => {

  let ffmpeg = null;
  let isLoaded = false;
  let isFfmpegAvailable = false;

  const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'm4a', 'aiff'];
  const VIDEO_FORMATS = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', '3gp'];
  const ALL_INPUT     = [...AUDIO_FORMATS, ...VIDEO_FORMATS];

  const FORMAT_FFMPEG_MAP = {
    mp3:  { codec: 'libmp3lame', ext: 'mp3',  mime: 'audio/mpeg' },
    wav:  { codec: 'pcm_s16le',  ext: 'wav',  mime: 'audio/wav'  },
    flac: { codec: 'flac',       ext: 'flac', mime: 'audio/flac' },
    aac:  { codec: 'aac',        ext: 'aac',  mime: 'audio/aac'  },
    ogg:  { codec: 'libvorbis',  ext: 'ogg',  mime: 'audio/ogg'  },
    opus: { codec: 'libopus',    ext: 'opus', mime: 'audio/opus' },
    m4a:  { codec: 'aac',        ext: 'm4a',  mime: 'audio/mp4'  },
    aiff: { codec: 'pcm_s16be',  ext: 'aiff', mime: 'audio/aiff' },
  };

  /* ── FFmpeg Load ──────────────────────────────────────── */

  async function loadFFmpeg() {
    if (isLoaded) return true;
    try {
      const { createFFmpeg, fetchFile } = window.FFmpeg || {};
      if (!createFFmpeg) {
        console.warn('FFmpeg.wasm not available — using fallback mode');
        isFfmpegAvailable = false;
        return false;
      }
      ffmpeg = createFFmpeg({
        log: false,
        progress: ({ ratio }) => updateProgress(Math.round(ratio * 100)),
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      await ffmpeg.load();
      window._fetchFile = fetchFile;
      isLoaded = true;
      isFfmpegAvailable = true;
      return true;
    } catch (err) {
      console.error('FFmpeg load error:', err);
      isFfmpegAvailable = false;
      return false;
    }
  }

  /* ── Conversion ───────────────────────────────────────── */

  async function convertAudio(file, outputFormat, options = {}) {
    const { bitrate = '192k', sampleRate = '44100', channels = '2' } = options;
    const fmt = FORMAT_FFMPEG_MAP[outputFormat];
    if (!fmt) throw new Error(`Unsupported output format: ${outputFormat}`);

    const loaded = await loadFFmpeg();
    if (!loaded) throw new Error('FFmpeg.wasm could not be loaded. Check that your server sends Cross-Origin-Isolation headers (COOP/COEP).');

    const inputName  = `input_${Date.now()}.${getExt(file.name)}`;
    const outputName = `output_${Date.now()}.${fmt.ext}`;

    ffmpeg.FS('writeFile', inputName, await window._fetchFile(file));

    const ffmpegArgs = ['-i', inputName];

    // Audio codec
    ffmpegArgs.push('-c:a', fmt.codec);

    // Bitrate (not for lossless)
    if (!['flac', 'wav', 'aiff'].includes(outputFormat) && bitrate) {
      ffmpegArgs.push('-b:a', bitrate);
    }

    // Sample rate
    if (sampleRate) ffmpegArgs.push('-ar', sampleRate);

    // Channels (1=mono, 2=stereo)
    if (channels) ffmpegArgs.push('-ac', channels);

    // Strip video stream (for video → audio extraction)
    ffmpegArgs.push('-vn');

    ffmpegArgs.push(outputName);

    await ffmpeg.run(...ffmpegArgs);

    const data = ffmpeg.FS('readFile', outputName);

    // Cleanup
    try { ffmpeg.FS('unlink', inputName);  } catch (_) {}
    try { ffmpeg.FS('unlink', outputName); } catch (_) {}

    return { data: data.buffer, mime: fmt.mime, ext: fmt.ext };
  }

  /* ── Helpers ──────────────────────────────────────────── */

  function getExt(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  function isSupported(filename) {
    return ALL_INPUT.includes(getExt(filename));
  }

  function updateProgress(pct) {
    const bar = document.getElementById('audio-progress-fill');
    const lbl = document.getElementById('audio-progress-label');
    if (bar) bar.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${pct}%`;
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    const dropZone   = document.getElementById('audio-drop-zone');
    if (!dropZone) return;

    const fileInput   = document.getElementById('audio-file-input');
    const browseBtn   = document.getElementById('audio-browse-btn');
    const fileList    = document.getElementById('audio-file-list');
    const convertBtn  = document.getElementById('audio-convert-btn');
    const outputFmt   = document.getElementById('audio-format');
    const bitrateEl   = document.getElementById('audio-bitrate');
    const srateEl     = document.getElementById('audio-samplerate');
    const chansEl     = document.getElementById('audio-channels');
    const progressWrap= document.getElementById('audio-progress-wrap');
    const resultList  = document.getElementById('audio-result-list');
    const statusEl    = document.getElementById('audio-status');

    let selectedFiles = [];

    // Show FFmpeg status
    checkFFmpegSupport(statusEl);

    // Drop zone
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });
    dropZone.addEventListener('click', () => fileInput.click());
    if (browseBtn) browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

    function handleFiles(files) {
      const valid = files.filter(f => isSupported(f.name));
      const invalid = files.filter(f => !isSupported(f.name));
      if (invalid.length) Utils.showToast(`⚠ ${invalid.length} unsupported file(s) skipped`);
      selectedFiles = [...selectedFiles, ...valid];
      renderFileList();
    }

    function renderFileList() {
      fileList.innerHTML = '';
      selectedFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item fade-in';
        item.innerHTML = `
          <span class="file-item__icon">${getFileIcon(file.name)}</span>
          <div class="file-item__info">
            <div class="file-item__name">${Utils.sanitize(file.name)}</div>
            <div class="file-item__size">${Utils.formatBytes(file.size)} · ${getExt(file.name).toUpperCase()}</div>
          </div>
          <button class="file-item__remove" data-idx="${idx}" title="Remove">✕</button>
        `;
        fileList.appendChild(item);
      });
      // Remove buttons
      fileList.querySelectorAll('.file-item__remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          selectedFiles.splice(parseInt(btn.dataset.idx), 1);
          renderFileList();
        });
      });
      convertBtn.disabled = selectedFiles.length === 0;
    }

    // Convert
    convertBtn.addEventListener('click', async () => {
      if (!selectedFiles.length) return;
      Utils.setLoading(convertBtn, true);
      resultList.innerHTML = '';
      if (progressWrap) progressWrap.classList.remove('hidden');

      const fmt     = outputFmt.value;
      const options = {
        bitrate:    bitrateEl?.value || '192k',
        sampleRate: srateEl?.value   || '44100',
        channels:   chansEl?.value   || '2',
      };

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        updateProgress(0);
        if (statusEl) statusEl.textContent = `Converting ${i + 1}/${selectedFiles.length}: ${file.name}`;

        try {
          const result = await convertAudio(file, fmt, options);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const outName  = `${baseName}.${result.ext}`;

          // Create download
          const blob   = new Blob([result.data], { type: result.mime });
          const url    = URL.createObjectURL(blob);
          const item   = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.innerHTML = `
            <span class="convert-result__icon">✓</span>
            <div class="convert-result__info">
              <div class="convert-result__name">${Utils.sanitize(outName)}</div>
              <div class="convert-result__meta">${Utils.formatBytes(result.data.byteLength)} · ${fmt.toUpperCase()}</div>
            </div>
            <a href="${url}" download="${outName}" class="btn btn--success btn--sm">⬇ Download</a>
          `;
          resultList.appendChild(item);
        } catch (err) {
          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.style.borderColor = 'var(--orange)';
          item.style.background  = 'var(--orange-dim)';
          item.innerHTML = `<span>✗</span><div class="convert-result__info"><div style="color:var(--orange)">${Utils.sanitize(file.name)}</div><div class="convert-result__meta">${Utils.sanitize(err.message)}</div></div>`;
          resultList.appendChild(item);
        }
      }

      updateProgress(100);
      if (statusEl) statusEl.textContent = `Done — ${selectedFiles.length} file(s) processed`;
      Utils.setLoading(convertBtn, false);
    });
  }

  function getFileIcon(name) {
    const ext = getExt(name);
    if (VIDEO_FORMATS.includes(ext)) return '🎬';
    if (['mp3', 'aac', 'm4a'].includes(ext)) return '🎵';
    if (['wav', 'aiff'].includes(ext)) return '🎙️';
    if (['flac'].includes(ext)) return '💿';
    return '🎶';
  }

  async function checkFFmpegSupport(el) {
    if (!el) return;
    const hasSharedBuffer = typeof SharedArrayBuffer !== 'undefined';
    if (!hasSharedBuffer) {
      el.className = 'alert alert--warning';
      el.innerHTML = '<span class="alert__icon">⚠</span><div><strong>Cross-Origin Isolation Required:</strong> Audio conversion requires <code>SharedArrayBuffer</code>. Please ensure your server sends <code>Cross-Origin-Opener-Policy: same-origin</code> and <code>Cross-Origin-Embedder-Policy: require-corp</code> headers. Local development: use <code>npx serve -C</code> or configure your server. The UI is ready — conversion will work once headers are set.</div>';
    } else {
      el.className = 'alert alert--success';
      el.innerHTML = '<span class="alert__icon">✓</span> Cross-Origin Isolation active — FFmpeg.wasm will load on first conversion.';
    }
  }

  return { init, convertAudio, loadFFmpeg, AUDIO_FORMATS, VIDEO_FORMATS };

})();

document.addEventListener('DOMContentLoaded', () => { AudioModule.init(); Utils.initNavbar(); });
window.AudioModule = AudioModule;
