/* Audio Merger — Web Audio API */
(function () {
  'use strict';

  const dropZone   = document.getElementById('am-drop-zone');
  const fileInput  = document.getElementById('am-file-input');
  const listEl     = document.getElementById('am-file-list');
  const countEl    = document.getElementById('am-file-count');
  const mergeBtn   = document.getElementById('am-merge-btn');
  const clearBtn   = document.getElementById('am-clear-btn');
  const gapInput   = document.getElementById('am-gap');
  const statusEl   = document.getElementById('am-status');

  let files = [];   // [{ id, file, buffer }]
  let nextId = 0;
  let audioCtx = null;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'am-status am-status--' + (type || 'idle');
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(1).padStart(4, '0');
    return m + ':' + sec;
  }

  function fmtSize(b) {
    return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
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

  async function addFiles(newFiles) {
    const audioFiles = newFiles.filter(f => f.type.startsWith('audio/'));
    if (!audioFiles.length) { setStatus('Please add audio files.', 'error'); return; }
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    setStatus('Decoding ' + audioFiles.length + ' file(s)…', 'working');
    for (const f of audioFiles) {
      try {
        const ab = await f.arrayBuffer();
        const buffer = await audioCtx.decodeAudioData(ab);
        files.push({ id: nextId++, file: f, buffer });
      } catch (e) {
        setStatus('Could not decode: ' + f.name, 'error');
      }
    }
    renderList();
    setStatus(files.length + ' file(s) ready. Click Merge & Download.', 'idle');
  }

  function renderList() {
    countEl.textContent = files.length ? '(' + files.length + ')' : '';
    mergeBtn.disabled = files.length < 2;

    if (!files.length) {
      listEl.innerHTML = '<p class="placeholder-msg">No audio files added yet.</p>';
      return;
    }

    listEl.innerHTML = '';
    files.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'am-row';

      const num = document.createElement('div');
      num.className = 'am-row__num';
      num.textContent = idx + 1;

      const info = document.createElement('div');
      info.className = 'am-row__info';
      const name = document.createElement('div');
      name.className = 'am-row__name';
      name.textContent = item.file.name;
      const meta = document.createElement('div');
      meta.className = 'am-row__meta';
      meta.textContent = fmtSize(item.file.size) + ' · ' + fmt(item.buffer.duration);
      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'am-row__actions';

      const upBtn = document.createElement('button');
      upBtn.className = 'am-move-btn';
      upBtn.textContent = '↑';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', () => move(item.id, -1));

      const dnBtn = document.createElement('button');
      dnBtn.className = 'am-move-btn';
      dnBtn.textContent = '↓';
      dnBtn.disabled = idx === files.length - 1;
      dnBtn.addEventListener('click', () => move(item.id, 1));

      const rmBtn = document.createElement('button');
      rmBtn.className = 'am-remove-btn';
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

  mergeBtn.addEventListener('click', () => {
    if (files.length < 2) return;
    const gap = Math.max(0, parseFloat(gapInput.value) || 0);
    const sr  = files[0].buffer.sampleRate;
    const ch  = Math.max(...files.map(f => f.buffer.numberOfChannels));
    const gapSamples = Math.floor(gap * sr);
    const totalSamples = files.reduce((sum, f) => sum + f.buffer.length, 0) + gapSamples * (files.length - 1);

    setStatus('Merging…', 'working');
    mergeBtn.disabled = true;

    const offCtx = new OfflineAudioContext(ch, totalSamples, sr);
    let offset = 0;
    for (const item of files) {
      const src = offCtx.createBufferSource();
      src.buffer = item.buffer;
      src.connect(offCtx.destination);
      src.start(offset / sr);
      offset += item.buffer.length + gapSamples;
    }

    offCtx.startRendering().then(merged => {
      const wav = encodeWav(merged);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged_audio.wav';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      mergeBtn.disabled = false;
      setStatus('Downloaded: merged_audio.wav (' + fmt(merged.duration) + ' total)', 'done');
    }).catch(err => {
      mergeBtn.disabled = false;
      setStatus('Error: ' + err.message, 'error');
    });
  });

  function encodeWav(buffer) {
    const numCh = buffer.numberOfChannels;
    const sr    = buffer.sampleRate;
    const len   = buffer.length;
    const bps   = 16;
    const blockAlign = numCh * (bps / 8);
    const byteRate   = sr * blockAlign;
    const dataSize   = len * blockAlign;
    const ab   = new ArrayBuffer(44 + dataSize);
    const view = new DataView(ab);
    const w    = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
    w(8, 'WAVE'); w(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
    view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
    view.setUint16(34, bps, true); w(36, 'data');
    view.setUint32(40, dataSize, true);
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return ab;
  }

  renderList();
  setStatus('Add two or more audio files to merge.', 'idle');
})();
