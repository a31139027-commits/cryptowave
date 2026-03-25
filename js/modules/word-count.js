'use strict';

(function () {

  /* ── Helpers ──────────────────────────────────────────── */

  function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function countSentences(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const matches = trimmed.match(/[^.!?]*[.!?]+/g);
    return matches ? matches.length : (trimmed.length > 0 ? 1 : 0);
  }

  function countParagraphs(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\n\s*\n+/).filter(p => p.trim().length > 0).length;
  }

  function readingTime(words) {
    // Average reading speed: 238 wpm
    const mins = words / 238;
    if (mins < 1) return '< 1 min';
    const m = Math.round(mins);
    return m + ' min' + (m > 1 ? 's' : '');
  }

  function speakingTime(words) {
    // Average speaking speed: 130 wpm
    const mins = words / 130;
    if (mins < 1) return '< 1 min';
    const m = Math.round(mins);
    return m + ' min' + (m > 1 ? 's' : '');
  }

  function topWords(text, n = 5) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const words = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const STOP = new Set(['the','and','for','are','but','not','you','all','can','her','was','one','our','out','him','his','has','had','its','who','did','how','now','that','this','with','have','from','they','will','been','were','when','what','your','more','also','into','than','then','them','some','just','over','even','most','such','only','like','well','made','make','said','each','much','many','must','told','able','both','very','any','may','got','own','two','way','too','new','use','get','set','let','see','say','been']);

    const freq = {};
    for (const w of words) {
      if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  /* ── Render ───────────────────────────────────────────── */

  function update(text) {
    const chars        = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const words        = countWords(text);
    const sentences    = countSentences(text);
    const paragraphs   = countParagraphs(text);
    const lines        = text === '' ? 0 : text.split('\n').length;
    const rTime        = readingTime(words);
    const sTime        = speakingTime(words);

    // Stat cards
    document.getElementById('wc-chars').textContent        = chars.toLocaleString();
    document.getElementById('wc-chars-ns').textContent     = charsNoSpace.toLocaleString();
    document.getElementById('wc-words').textContent        = words.toLocaleString();
    document.getElementById('wc-sentences').textContent    = sentences.toLocaleString();
    document.getElementById('wc-paragraphs').textContent   = paragraphs.toLocaleString();
    document.getElementById('wc-lines').textContent        = lines.toLocaleString();

    // Reading / speaking time
    document.getElementById('wc-read-time').textContent  = rTime;
    document.getElementById('wc-speak-time').textContent = sTime;

    // Top words
    const top = topWords(text);
    const topEl = document.getElementById('wc-top-words');
    if (top.length === 0) {
      topEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">—</span>';
    } else {
      topEl.innerHTML = top.map(([w, c]) =>
        `<span class="wc-word-tag">${w} <span class="wc-word-count">${c}</span></span>`
      ).join('');
    }
  }

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const textarea  = document.getElementById('wc-input');
    const clearBtn  = document.getElementById('wc-clear-btn');
    const copyBtn   = document.getElementById('wc-copy-btn');

    textarea.addEventListener('input', () => update(textarea.value));

    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      update('');
      textarea.focus();
    });

    copyBtn.addEventListener('click', () => {
      if (!textarea.value) return;
      navigator.clipboard.writeText(textarea.value)
        .then(() => Utils.showToast('✅ Text copied!'))
        .catch(() => Utils.showToast('❌ Copy failed'));
    });

    update('');
  });

})();
