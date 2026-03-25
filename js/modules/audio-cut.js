/* Audio Cutter — Web Audio API */
(function () {
  'use strict';

  const dropZone    = document.getElementById('ac-drop-zone');
  const fileInput   = document.getElementById('ac-file-input');
  const controlsEl  = document.getElementById('ac-controls');
  const fileNameEl  = document.getElementById('ac-filename');
  const fileSizeEl  = document.getElementById('ac-filesize');
  const durationEl  = document.getElementById('ac-duration');
  const startInput  = document.getElementById('ac-start');
  const endInput    = document.getElementById('ac-end');
  const previewBtn  = document.getElementById('ac-preview-btn');
  const stopBtn     = document.getElementById('ac-stop-btn');
  const cutBtn      = document.getElementById('ac-cut-btn');
  const formatSel   = document.getElementById('ac-format');
  const statusEl    = document.getElementById('ac-status');
  const waveCanvas  = document.getElementById('ac-waveform');
  const waveCtx     = waveCanvas ? waveCanvas.getContext('2d') : null;

  let audioCtx = null;
  let audioBuffer = null;
  let sourceNode = null;
  let originalFile = null;
  let originalExt = 'mp3';

  function fmt(s) {
    s = parseFloat(s) || 0;
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(2).padStart(5, '0');
    return m + ':' + sec;
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'ac-status ac-status--' + (type || 'idle');
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

  function drawWaveform(buffer) {
    if (!waveCtx) return;
    const W = waveCanvas.offsetWidth || 600;
    const H = 80;
    waveCanvas.width = W;
    waveCanvas.height = H;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / W);
    const amp = H / 2;
    waveCtx.clearRect(0, 0, W, H);
    waveCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--input-bg') || '#1e1e2e';
    waveCtx.fillRect(0, 0, W, H);
    waveCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#6366f1';
    waveCtx.lineWidth = 1;
    waveCtx.beginPath();
    for (let i = 0; i < W; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const v = data[i * step + j] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      waveCtx.moveTo(i, (1 + min) * amp);
      waveCtx.lineTo(i, (1 + max) * amp);
    }
    waveCtx.stroke();
  }

  function loadFile(file) {
    if (!file.type.startsWith('audio/')) {
      setStatus('Please select an audio file.', 'error');
      return;
    }
    originalFile = file;
    originalExt = file.name.split('.').pop().toLowerCase() || 'mp3';
    setStatus('Decoding audio…', 'working');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioBuffer = await audioCtx.decodeAudioData(e.target.result);

        const dur = audioBuffer.duration;
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        durationEl.textContent = fmt(dur);
        startInput.value = '0';
        startInput.max = dur.toFixed(2);
        endInput.value = dur.toFixed(2);
        endInput.max = dur.toFixed(2);

        drawWaveform(audioBuffer);
        controlsEl.classList.remove('hidden');
        setStatus('Ready. Set start and end times, then cut.', 'idle');
      } catch (err) {
        setStatus('Failed to decode audio: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function getRange() {
    const dur = audioBuffer.duration;
    let start = parseFloat(startInput.value) || 0;
    let end   = parseFloat(endInput.value)   || dur;
    start = Math.max(0, Math.min(start, dur));
    end   = Math.max(start + 0.01, Math.min(end, dur));
    return { start, end };
  }

  previewBtn.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (sourceNode) { sourceNode.stop(); sourceNode = null; }
    const { start, end } = getRange();
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioCtx.destination);
    sourceNode.start(0, start, end - start);
    stopBtn.disabled = false;
    sourceNode.onended = () => {
      sourceNode = null;
      stopBtn.disabled = true;
      setStatus('Preview finished.', 'idle');
    };
    setStatus('Previewing ' + fmt(start) + ' → ' + fmt(end) + '…', 'working');
  });

  stopBtn.addEventListener('click', () => {
    if (sourceNode) { sourceNode.stop(); sourceNode = null; }
    stopBtn.disabled = true;
    setStatus('Stopped.', 'idle');
  });

  cutBtn.addEventListener('click', () => {
    if (!audioBuffer) return;
    const { start, end } = getRange();
    const sr = audioBuffer.sampleRate;
    const ch = audioBuffer.numberOfChannels;
    const startSample = Math.floor(start * sr);
    const endSample   = Math.floor(end   * sr);
    const len = endSample - startSample;

    const offCtx = new OfflineAudioContext(ch, len, sr);
    const newBuf = offCtx.createBuffer(ch, len, sr);
    for (let c = 0; c < ch; c++) {
      newBuf.copyToChannel(audioBuffer.getChannelData(c).slice(startSample, endSample), c);
    }

    const outFormat = formatSel.value; // 'wav' or 'mp3-wav'
    setStatus('Encoding…', 'working');

    // Encode to WAV (universal, no extra lib needed)
    const wav = encodeWav(newBuf);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    const ext  = 'wav';
    const baseName = (originalFile.name.replace(/\.[^.]+$/, '') || 'cut');
    const a = document.createElement('a');
    a.href = url;
    a.download = baseName + '_cut.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus('Downloaded: ' + a.download, 'done');
  });

  function encodeWav(buffer) {
    const numCh  = buffer.numberOfChannels;
    const sr     = buffer.sampleRate;
    const len    = buffer.length;
    const bps    = 16; // bits per sample
    const blockAlign = numCh * (bps / 8);
    const byteRate   = sr * blockAlign;
    const dataSize   = len * blockAlign;
    const ab = new ArrayBuffer(44 + dataSize);
    const view = new DataView(ab);

    function write(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    write(0,  'RIFF');
    view.setUint32(4,  36 + dataSize, true);
    write(8,  'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1,  true);   // PCM
    view.setUint16(22, numCh, true);
    view.setUint32(24, sr,    true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bps, true);
    write(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return ab;
  }
})();
