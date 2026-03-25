/* Video Merger — ffmpeg.wasm */
(function () {
  'use strict';

  const dropZone  = document.getElementById('vm-drop-zone');
  const fileInput = document.getElementById('vm-file-input');
  const listEl    = document.getElementById('vm-file-list');
  const countEl   = document.getElementById('vm-file-count');
  const mergeBtn  = document.getElementById('vm-merge-btn');
  const clearBtn  = document.getElementById('vm-clear-btn');
  const methodSel = document.getElementById('vm-method');
  const statusEl  = document.getElementById('vm-status');
  const progressEl= document.getElementById('vm-progress');
  const progressBar=document.getElementById('vm-progress-bar');
  const logEl     = document.getElementById('vm-log');

  let files  = [];   // [{ id, file }]
  let nextId = 0;
  let ffmpeg = null;
  let isLoaded = false;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'vm-status vm-status--' + (type || 'idle');
  }

  function setProgress(pct) {
    progressEl.style.display = pct >= 0 && pct < 100 ? 'block' : 'none';
    progressBar.style.width = pct + '%';
  }

  function fmtSize(b) {
    return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
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
    addFiles(Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  function addFiles(newFiles) {
    const videoFiles = newFiles.filter(f => f.type.startsWith('video/'));
    if (!videoFiles.length) { setStatus('Please add video files.', 'error'); return; }
    videoFiles.forEach(f => files.push({ id: nextId++, file: f }));
    renderList();
    setStatus(files.length + ' video(s) ready. Click Merge & Download.', 'idle');
  }

  function renderList() {
    countEl.textContent = files.length ? '(' + files.length + ')' : '';
    mergeBtn.disabled = files.length < 2;

    if (!files.length) {
      listEl.innerHTML = '<p class="placeholder-msg">No video files added yet.</p>';
      return;
    }
    listEl.innerHTML = '';
    files.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'vm-row';

      const num = document.createElement('div');
      num.className = 'vm-row__num';
      num.textContent = idx + 1;

      const info = document.createElement('div');
      info.className = 'vm-row__info';
      const name = document.createElement('div');
      name.className = 'vm-row__name';
      name.textContent = item.file.name;
      const meta = document.createElement('div');
      meta.className = 'vm-row__meta';
      meta.textContent = fmtSize(item.file.size);
      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'vm-row__actions';

      const upBtn = document.createElement('button');
      upBtn.className = 'vm-move-btn';
      upBtn.textContent = '↑';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', () => move(item.id, -1));

      const dnBtn = document.createElement('button');
      dnBtn.className = 'vm-move-btn';
      dnBtn.textContent = '↓';
      dnBtn.disabled = idx === files.length - 1;
      dnBtn.addEventListener('click', () => move(item.id, 1));

      const rmBtn = document.createElement('button');
      rmBtn.className = 'vm-remove-btn';
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', () => remove(item.id));

      actions.appendChild(upBtn);
      actions.appendChild(dnBtn);
      actions.appendChild(rmBtn);
      row.appendChild(num);
      row.appendChild(info);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  function move(id, dir) {
    const idx = files.findIndex(f => f.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= files.length) return;
    [files[idx], files[newIdx]] = [files[newIdx], files[idx]];
    renderList();
  }

  function remove(id) {
    files = files.filter(f => f.id !== id);
    renderList();
    if (!files.length) setStatus('All files removed.', 'idle');
  }

  clearBtn.addEventListener('click', () => {
    files = [];
    renderList();
    setStatus('Cleared.', 'idle');
  });

  mergeBtn.addEventListener('click', async () => {
    if (files.length < 2) return;
    if (!await loadFFmpeg()) return;

    mergeBtn.disabled = true;
    setProgress(0);
    setStatus('Writing files to FFmpeg…', 'working');

    const method = methodSel.value; // 'concat' (stream copy) or 'reencode'
    const names  = [];

    try {
      // Write all input files to ffmpeg FS
      for (let i = 0; i < files.length; i++) {
        const ext  = files[i].file.name.split('.').pop().toLowerCase() || 'mp4';
        const name = `input${i}.${ext}`;
        names.push(name);
        ffmpeg.FS('writeFile', name, await window._fetchFile(files[i].file));
        setStatus(`Loading file ${i + 1}/${files.length}…`, 'working');
      }

      let outputName;

      if (method === 'concat') {
        // Concat demuxer (fast, stream copy — requires same codec/format)
        const listContent = names.map(n => `file '${n}'`).join('\n');
        const listBytes   = new TextEncoder().encode(listContent);
        ffmpeg.FS('writeFile', 'filelist.txt', listBytes);
        outputName = 'merged.mp4';
        setStatus('Merging (stream copy)…', 'working');
        await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'filelist.txt', '-c', 'copy', outputName);
        try { ffmpeg.FS('unlink', 'filelist.txt'); } catch (_) {}
      } else {
        // Re-encode with concat filter — works across different formats
        const n      = files.length;
        const inputs = names.flatMap(name => ['-i', name]);
        const filter = names.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('') + `concat=n=${n}:v=1:a=1[v][a]`;
        outputName   = 'merged.mp4';
        setStatus('Merging (re-encoding)… This may take a while.', 'working');
        await ffmpeg.run(
          ...inputs,
          '-filter_complex', filter,
          '-map', '[v]', '-map', '[a]',
          '-c:v', 'libx264', '-preset', 'fast',
          '-c:a', 'aac',
          outputName
        );
      }

      const data = ffmpeg.FS('readFile', outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = 'merged_video.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Cleanup
      names.forEach(n => { try { ffmpeg.FS('unlink', n); } catch (_) {} });
      try { ffmpeg.FS('unlink', outputName); } catch (_) {}

      setProgress(100);
      setStatus('Downloaded: merged_video.mp4', 'done');
    } catch (e) {
      setStatus('Error: ' + e.message + (method === 'concat' ? ' — Try switching to Re-encode mode.' : ''), 'error');
    } finally {
      mergeBtn.disabled = false;
      setTimeout(() => setProgress(100), 500);
    }
  });

  renderList();
  setStatus('Add two or more video files to merge.', 'idle');
})();
