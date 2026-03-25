/* Text to Speech — Web Speech API */
(function () {
  'use strict';

  const textEl     = document.getElementById('tts-text');
  const speakBtn   = document.getElementById('tts-speak-btn');
  const stopBtn    = document.getElementById('tts-stop-btn');
  const pauseBtn   = document.getElementById('tts-pause-btn');
  const resumeBtn  = document.getElementById('tts-resume-btn');
  const voiceSelect= document.getElementById('tts-voice');
  const rateRange  = document.getElementById('tts-rate');
  const pitchRange = document.getElementById('tts-pitch');
  const volRange   = document.getElementById('tts-volume');
  const rateVal    = document.getElementById('tts-rate-val');
  const pitchVal   = document.getElementById('tts-pitch-val');
  const volVal     = document.getElementById('tts-volume-val');
  const statusEl   = document.getElementById('tts-status');
  const charCount  = document.getElementById('tts-char-count');
  const progressBar= document.getElementById('tts-progress');

  const synth = window.speechSynthesis;
  let voices = [];
  let utterance = null;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'tts-status tts-status--' + (type || 'idle');
  }

  function loadVoices() {
    voices = synth.getVoices();
    const saved = localStorage.getItem('cw-tts-voice');
    voiceSelect.innerHTML = '';
    voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = v.name + ' (' + v.lang + ')';
      if (saved === v.name) opt.selected = true;
      voiceSelect.appendChild(opt);
    });
  }

  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Range display
  rateRange.addEventListener('input', () => { rateVal.textContent = parseFloat(rateRange.value).toFixed(1) + 'x'; });
  pitchRange.addEventListener('input', () => { pitchVal.textContent = parseFloat(pitchRange.value).toFixed(1); });
  volRange.addEventListener('input', () => { volVal.textContent = Math.round(volRange.value * 100) + '%'; });

  textEl.addEventListener('input', () => {
    charCount.textContent = textEl.value.length + ' chars';
    if (progressBar) progressBar.style.width = '0%';
  });

  function setBtns(speaking) {
    speakBtn.disabled  =  speaking;
    stopBtn.disabled   = !speaking;
    pauseBtn.disabled  = !speaking;
    resumeBtn.disabled = !speaking;
  }

  speakBtn.addEventListener('click', () => {
    const text = textEl.value.trim();
    if (!text) { setStatus('Please enter some text first.', 'error'); return; }
    if (synth.speaking) synth.cancel();

    utterance = new SpeechSynthesisUtterance(text);
    const v = voices[voiceSelect.value];
    if (v) utterance.voice = v;
    utterance.rate   = parseFloat(rateRange.value);
    utterance.pitch  = parseFloat(pitchRange.value);
    utterance.volume = parseFloat(volRange.value);

    const totalLen = text.length;
    utterance.onboundary = (e) => {
      if (e.name === 'word' && progressBar) {
        const pct = Math.min(100, Math.round((e.charIndex / totalLen) * 100));
        progressBar.style.width = pct + '%';
      }
    };

    utterance.onstart = () => {
      setBtns(true);
      setStatus('Speaking…', 'speaking');
      localStorage.setItem('cw-tts-voice', voices[voiceSelect.value]?.name || '');
    };
    utterance.onend = () => {
      setBtns(false);
      setStatus('Done.', 'done');
      if (progressBar) progressBar.style.width = '100%';
      setTimeout(() => { if (progressBar) progressBar.style.width = '0%'; }, 1000);
    };
    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      setBtns(false);
      setStatus('Error: ' + e.error, 'error');
    };

    synth.speak(utterance);
  });

  stopBtn.addEventListener('click', () => {
    synth.cancel();
    setBtns(false);
    setStatus('Stopped.', 'idle');
    if (progressBar) progressBar.style.width = '0%';
  });

  pauseBtn.addEventListener('click', () => {
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setStatus('Paused.', 'paused');
    }
  });

  resumeBtn.addEventListener('click', () => {
    if (synth.paused) {
      synth.resume();
      setStatus('Speaking…', 'speaking');
    }
  });

  // Init
  setStatus('Ready. Enter text and press Speak.', 'idle');
  setBtns(false);

  // Check support
  if (!('speechSynthesis' in window)) {
    speakBtn.disabled = true;
    setStatus('⚠️ Your browser does not support the Web Speech API.', 'error');
  }
})();
