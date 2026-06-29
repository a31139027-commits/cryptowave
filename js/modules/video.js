/**
 * modules/video.js — Video Converter Module
 * Uses: FFmpeg.wasm (v0.11) for in-browser video conversion
 *
 * Supports Input:  MP4, MKV, MOV, AVI, WebM, FLV, 3GP, WMV, TS, M4V
 * Supports Output: MP4, MKV, MOV, AVI, WebM, FLV, 3GP, GIF
 *
 * NOTE: Requires Cross-Origin-Isolation headers:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 */

'use strict';

const VideoModule = (() => {

  let ffmpeg = null;
  let isLoaded = false;
  let loadPromise = null;

  const INPUT_FORMATS  = ['mp4','mkv','mov','avi','webm','flv','3gp','wmv','ts','m4v','ogv'];
  const OUTPUT_FORMATS = {
    mp4:  { ext: 'mp4',  mime: 'video/mp4',       label: 'MP4 (H.264)'  },
    mkv:  { ext: 'mkv',  mime: 'video/x-matroska', label: 'MKV'         },
    mov:  { ext: 'mov',  mime: 'video/quicktime',  label: 'MOV (QuickTime)' },
    avi:  { ext: 'avi',  mime: 'video/x-msvideo',  label: 'AVI'         },
    webm: { ext: 'webm', mime: 'video/webm',        label: 'WebM (VP9)'  },
    flv:  { ext: 'flv',  mime: 'video/x-flv',       label: 'FLV'        },
    '3gp':{ ext: '3gp',  mime: 'video/3gpp',        label: '3GP (Mobile)'},
    gif:  { ext: 'gif',  mime: 'image/gif',          label: 'GIF (Animated)'},
  };

  const QUALITY_PRESETS = {
    low:    { crf: '30', preset: 'ultrafast', label: 'Low'    },
    medium: { crf: '25', preset: 'veryfast',  label: 'Medium' },
    high:   { crf: '21', preset: 'fast',      label: 'High'   },
    best:   { crf: '18', preset: 'medium',    label: 'Best'   },
  };

  const RESOLUTION_PRESETS = {
    original: { scale: null,         label: 'Original'  },
    '1080p':  { scale: '1920:1080',  label: '1080p FHD' },
    '720p':   { scale: '1280:720',   label: '720p HD'   },
    '480p':   { scale: '854:480',    label: '480p SD'   },
    '360p':   { scale: '640:360',    label: '360p'      },
  };

  /* ── FFmpeg Load ──────────────────────────────────────── */

  async function loadFFmpeg() {
    if (isLoaded) return true;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
    try {
      const { createFFmpeg, fetchFile } = window.FFmpeg || {};
      if (!createFFmpeg) { return false; }
      ffmpeg = createFFmpeg({
        log: false,
        progress: ({ ratio }) => updateProgress(Math.round(ratio * 100)),
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      await ffmpeg.load();
      window._fetchFile = fetchFile;
      isLoaded = true;
      return true;
    } catch (err) {
      console.error('FFmpeg load error:', err);
      loadPromise = null;
      return false;
    }
    })();
    return loadPromise;
  }

  /* ── Video Conversion ─────────────────────────────────── */

  async function convertVideo(file, outputFormat, options = {}) {
    const {
      quality    = 'medium',
      resolution = 'original',
      fps        = '',
      noAudio    = false,
    } = options;

    const fmt = OUTPUT_FORMATS[outputFormat];
    if (!fmt) throw new Error(`Unsupported output format: ${outputFormat}`);

    const loaded = await loadFFmpeg();
    if (!loaded) throw new Error('FFmpeg.wasm could not load. Ensure your server sends Cross-Origin-Isolation headers (COOP + COEP).');

    const inputName  = `in_${Date.now()}.${getExt(file.name)}`;
    const outputName = `out_${Date.now()}.${fmt.ext}`;

    ffmpeg.FS('writeFile', inputName, await window._fetchFile(file));

    const args = ['-i', inputName];
    const inputExt = getExt(file.name);
    const canFastCopy = shouldUseStreamCopy(inputExt, outputFormat, { resolution, fps, noAudio });

    if (outputFormat === 'gif') {
      // GIF special handling — palette for quality
      const palette = `palette_${Date.now()}.png`;
      const res = RESOLUTION_PRESETS[resolution];
      const scaleFilter = res?.scale ? `scale=${res.scale}:flags=lanczos` : 'scale=480:-1:flags=lanczos';
      const fpsFilter = fps ? `fps=${fps}` : 'fps=10';

      // Step 1: generate palette
      await ffmpeg.run('-i', inputName, '-vf', `${fpsFilter},${scaleFilter},palettegen`, palette);
      // Step 2: use palette
      await ffmpeg.run('-i', inputName, '-i', palette, '-lavfi',
        `${fpsFilter},${scaleFilter}[x];[x][1:v]paletteuse`, outputName);
      try { ffmpeg.FS('unlink', palette); } catch(_) {}

    } else if (canFastCopy) {
      args.push('-c', 'copy');
      if (outputFormat === 'mp4' || outputFormat === 'mov') {
        args.push('-movflags', '+faststart');
      }
      args.push(outputName);
      await ffmpeg.run(...args);

    } else {
      // Video codec selection
      if (outputFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9');
        const q = QUALITY_PRESETS[quality];
        args.push('-crf', q?.crf || '25', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '8');
      } else if (outputFormat === 'avi') {
        args.push('-c:v', 'mpeg4');
        args.push('-q:v', '5');
      } else if (outputFormat === 'flv') {
        args.push('-c:v', 'flv1');
      } else if (outputFormat === '3gp') {
        args.push('-c:v', 'h263');
        args.push('-s', '176x144');
      } else {
        // MP4, MKV, MOV — use H.264
        args.push('-c:v', 'libx264');
        const q = QUALITY_PRESETS[quality];
        args.push('-crf', q?.crf || '23');
        args.push('-preset', q?.preset || 'medium');
      }

      // Resolution scaling
      const res = RESOLUTION_PRESETS[resolution];
      if (res?.scale) {
        args.push('-vf', `scale=${res.scale}`);
      }

      // FPS
      if (fps && fps !== 'original') {
        args.push('-r', fps);
      }

      // Audio
      if (noAudio) {
        args.push('-an');
      } else {
        args.push('-c:a', 'aac', '-b:a', '128k');
      }

      // Fast start for MP4 (better streaming)
      if (outputFormat === 'mp4' || outputFormat === 'mov') {
        args.push('-movflags', '+faststart');
      }

      args.push(outputName);
      await ffmpeg.run(...args);
    }

    const data = ffmpeg.FS('readFile', outputName);
    try { ffmpeg.FS('unlink', inputName);  } catch(_) {}
    try { ffmpeg.FS('unlink', outputName); } catch(_) {}

    return { data: data.buffer, mime: fmt.mime, ext: fmt.ext };
  }

  /* ── Helpers ──────────────────────────────────────────── */

  function getExt(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  function isSupported(filename) {
    return INPUT_FORMATS.includes(getExt(filename));
  }

  function shouldUseStreamCopy(inputExt, outputFormat, options) {
    if (outputFormat === 'gif') return false;
    if (options.noAudio) return false;
    if (options.resolution && options.resolution !== 'original') return false;
    if (options.fps && options.fps !== 'original') return false;

    if (inputExt === outputFormat) return true;

    const remuxableToMp4 = ['mp4', 'm4v', 'mov'];
    const remuxableToMov = ['mp4', 'm4v', 'mov'];
    const remuxableToMkv = ['mp4', 'm4v', 'mov', 'mkv', 'webm'];

    if (outputFormat === 'mp4') return remuxableToMp4.includes(inputExt);
    if (outputFormat === 'mov') return remuxableToMov.includes(inputExt);
    if (outputFormat === 'mkv') return remuxableToMkv.includes(inputExt);

    return false;
  }

  function updateProgress(pct) {
    const bar = document.getElementById('video-progress-fill');
    const lbl = document.getElementById('video-progress-label');
    if (bar) bar.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${pct}%`;
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    const dropZone  = document.getElementById('video-drop-zone');
    if (!dropZone) return;

    const fileInput  = document.getElementById('video-file-input');
    const fileList   = document.getElementById('video-file-list');
    const convertBtn = document.getElementById('video-convert-btn');
    const outputFmt  = document.getElementById('video-format');
    const qualityEl  = document.getElementById('video-quality');
    const resEl      = document.getElementById('video-resolution');
    const fpsEl      = document.getElementById('video-fps');
    const noAudioEl  = document.getElementById('video-no-audio');
    const progressWrap = document.getElementById('video-progress-wrap');
    const resultList = document.getElementById('video-result-list');
    const statusEl   = document.getElementById('video-status');
    const sizeHintEl = document.getElementById('video-size-hint');
    const cloudRequestBtn = document.getElementById('video-cloud-request');

    let selectedFiles = [];

    checkSupport(statusEl);

    // Hide quality for GIF and some formats
    if (outputFmt) {
      outputFmt.addEventListener('change', () => {
        const isGif = outputFmt.value === 'gif';
        const qualityGroup = document.getElementById('video-quality-group');
        const audioGroup   = document.getElementById('video-audio-group');
        if (qualityGroup) qualityGroup.style.opacity = isGif ? '0.4' : '1';
        if (audioGroup)   audioGroup.style.opacity   = isGif ? '0.4' : '1';
      });
    }

    // Drop zone
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

    function handleFiles(files) {
      const valid   = files.filter(f => isSupported(f.name));
      const invalid = files.filter(f => !isSupported(f.name));
      if (invalid.length) Utils.showToast(`⚠ ${invalid.length} unsupported file(s) skipped`);
      selectedFiles = [...selectedFiles, ...valid];
      renderFileList();
      updateFileSizeHint();
      if (valid.length) warmFFmpeg();
    }

    function warmFFmpeg() {
      const warm = () => loadFFmpeg().catch(() => false);
      if ('requestIdleCallback' in window) {
        requestIdleCallback(warm, { timeout: 1500 });
      } else {
        setTimeout(warm, 250);
      }
    }

    function renderFileList() {
      fileList.innerHTML = '';
      selectedFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item fade-in';
        item.innerHTML = `
          <span class="file-item__icon">🎬</span>
          <div class="file-item__info">
            <div class="file-item__name">${Utils.sanitize(file.name)}</div>
            <div class="file-item__size">${Utils.formatBytes(file.size)} · ${getExt(file.name).toUpperCase()}</div>
          </div>
          <button class="file-item__remove" data-idx="${idx}" title="Remove">✕</button>
        `;
        fileList.appendChild(item);
      });
      fileList.querySelectorAll('.file-item__remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          selectedFiles.splice(parseInt(btn.dataset.idx), 1);
          renderFileList();
          updateFileSizeHint();
        });
      });
      convertBtn.disabled = selectedFiles.length === 0;
    }

    function updateFileSizeHint() {
      if (!sizeHintEl) return;
      if (!selectedFiles.length) {
        sizeHintEl.className = 'alert alert--info hidden';
        sizeHintEl.textContent = '';
        return;
      }

      const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      const largestBytes = Math.max(...selectedFiles.map(file => file.size));
      const largestMb = largestBytes / 1048576;
      const totalLabel = Utils.formatBytes(totalBytes);

      let level = 'info';
      let message = `Local conversion selected: ${selectedFiles.length} file(s), ${totalLabel} total. Small files and same-container remuxes are usually fastest.`;

      if (largestMb >= 500) {
        level = 'warning';
        message = `Large local job: ${selectedFiles.length} file(s), ${totalLabel} total. Browser conversion may take several minutes and depends on your CPU and memory.`;
      } else if (largestMb >= 100) {
        level = 'warning';
        message = `Medium local job: ${selectedFiles.length} file(s), ${totalLabel} total. Keep the resolution and FPS unchanged for the fastest result.`;
      }

      sizeHintEl.className = `alert alert--${level}`;
      sizeHintEl.textContent = message;
    }

    if (cloudRequestBtn) {
      cloudRequestBtn.addEventListener('click', () => {
        try {
          localStorage.setItem('cw-video-cloud-requested', String(Date.now()));
          if (typeof gtag === 'function') {
            gtag('event', 'video_cloud_mode_request', {
              event_category: 'engagement',
              event_label: 'video_converter'
            });
          }
        } catch (_) {}
        Utils.showToast('Request noted');
      });
    }

    // Convert
    convertBtn.addEventListener('click', async () => {
      if (!selectedFiles.length) return;
      Utils.setLoading(convertBtn, true);
      resultList.innerHTML = '';
      if (progressWrap) progressWrap.classList.remove('hidden');

      const fmt     = outputFmt.value;
      const options = {
        quality:    qualityEl?.value    || 'medium',
        resolution: resEl?.value        || 'original',
        fps:        fpsEl?.value        || '',
        noAudio:    noAudioEl?.checked  || false,
      };

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        updateProgress(0);
        if (statusEl) statusEl.textContent = `Converting ${i + 1}/${selectedFiles.length}: ${file.name}`;

        try {
          const result  = await convertVideo(file, fmt, options);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const outName  = `${baseName}.${result.ext}`;
          const blob     = new Blob([result.data], { type: result.mime });
          const url      = URL.createObjectURL(blob);

          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.innerHTML = `
            <span class="convert-result__icon">✓</span>
            <div class="convert-result__info">
              <div class="convert-result__name">${Utils.sanitize(outName)}</div>
              <div class="convert-result__meta">${Utils.formatBytes(result.data.byteLength)} · ${fmt.toUpperCase()}</div>
            </div>
            <a href="${url}" download="${outName}" class="btn btn--success btn--sm">⬇ Download</a>
          `;
          item.querySelector('a').addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 10000));
          resultList.appendChild(item);
        } catch (err) {
          const item = document.createElement('div');
          item.className = 'convert-result fade-in';
          item.style.cssText = 'border-color:var(--red-border);background:var(--red-dim);';
          item.innerHTML = `<span>✗</span><div class="convert-result__info"><div style="color:var(--red)">${Utils.sanitize(file.name)}</div><div class="convert-result__meta">${Utils.sanitize(err.message)}</div></div>`;
          resultList.appendChild(item);
        }
      }

      updateProgress(100);
      if (statusEl) statusEl.textContent = `Done — ${selectedFiles.length} file(s) processed`;
      Utils.setLoading(convertBtn, false);
    });
  }

  async function checkSupport(el) {
    if (!el) return;
    const ok = typeof SharedArrayBuffer !== 'undefined';
    el.className = ok ? 'alert alert--success' : 'alert alert--warning';
    el.innerHTML = ok
      ? '<span class="alert__icon">✓</span> Cross-Origin Isolation active — FFmpeg.wasm ready.'
      : '<span class="alert__icon">⚠</span><div><strong>Cross-Origin Isolation Required:</strong> Your server must send <code>Cross-Origin-Opener-Policy: same-origin</code> and <code>Cross-Origin-Embedder-Policy: require-corp</code> headers.</div>';
  }

  return { init, convertVideo, INPUT_FORMATS, OUTPUT_FORMATS };

})();

document.addEventListener('DOMContentLoaded', () => { VideoModule.init(); Utils.initNavbar(); });
window.VideoModule = VideoModule;
