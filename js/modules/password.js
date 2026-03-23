/**
 * modules/password.js — Password Generator Module
 * Uses: Web Crypto API (crypto.getRandomValues) — cryptographically secure
 * Features: length, charset options, strength meter, bulk generate, history
 */

'use strict';

const PasswordModule = (() => {

  const CHARSETS = {
    upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower:   'abcdefghijklmnopqrstuvwxyz',
    digits:  '0123456789',
    symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
    similar: 'iIlL1oO0',
    ambiguous: '{}[]()/\\\'"`~,;:.<>',
  };

  /* ── Core Generator ───────────────────────────────────── */

  function generate(options = {}) {
    const {
      length      = 16,
      upper       = true,
      lower       = true,
      digits      = true,
      symbols     = true,
      excludeSimilar    = false,
      excludeAmbiguous  = false,
      mustIncludeEach   = true,
    } = options;

    let pool = '';
    const required = [];

    if (upper)   { pool += CHARSETS.upper;   if (mustIncludeEach) required.push(pickOne(CHARSETS.upper)); }
    if (lower)   { pool += CHARSETS.lower;   if (mustIncludeEach) required.push(pickOne(CHARSETS.lower)); }
    if (digits)  { pool += CHARSETS.digits;  if (mustIncludeEach) required.push(pickOne(CHARSETS.digits)); }
    if (symbols) { pool += CHARSETS.symbols; if (mustIncludeEach) required.push(pickOne(CHARSETS.symbols)); }

    if (!pool) throw new Error('Please select at least one character type.');
    if (length < required.length) throw new Error(`Length must be at least ${required.length} when "include each type" is on.`);

    if (excludeSimilar)   pool = [...pool].filter(c => !CHARSETS.similar.includes(c)).join('');
    if (excludeAmbiguous) pool = [...pool].filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    if (!pool) throw new Error('Character pool is empty after exclusions.');

    // Fill remaining slots with random pool chars
    const remaining = length - required.length;
    const chars = [...required];
    for (let i = 0; i < remaining; i++) chars.push(pickOne(pool));

    // Shuffle using Fisher-Yates with crypto random
    for (let i = chars.length - 1; i > 0; i--) {
      const j = cryptoRandInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  function generateBulk(count, options) {
    const results = [];
    for (let i = 0; i < count; i++) results.push(generate(options));
    return results;
  }

  /* ── Strength Meter ───────────────────────────────────── */

  function strength(password) {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    const len = password.length;

    // Length score
    if (len >= 8)  score += 1;
    if (len >= 12) score += 1;
    if (len >= 16) score += 1;
    if (len >= 20) score += 1;

    // Charset diversity
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 2;

    // Penalize patterns
    if (/(.)\1{2,}/.test(password)) score -= 1; // repeated chars
    if (/^[a-zA-Z]+$/.test(password)) score -= 1; // letters only

    score = Math.max(0, Math.min(score, 9));

    const levels = [
      { min: 0, label: 'Very Weak',  color: '#ef4444', pct: 10  },
      { min: 2, label: 'Weak',       color: '#f97316', pct: 25  },
      { min: 4, label: 'Fair',       color: '#eab308', pct: 50  },
      { min: 6, label: 'Strong',     color: '#22c55e', pct: 75  },
      { min: 8, label: 'Very Strong',color: '#4ade80', pct: 100 },
    ];

    const level = [...levels].reverse().find(l => score >= l.min) || levels[0];
    return { score, ...level };
  }

  /* ── Crypto Helpers ───────────────────────────────────── */

  function cryptoRandInt(max) {
    const arr = new Uint32Array(1);
    // Rejection sampling to avoid modulo bias
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    let val;
    do { crypto.getRandomValues(arr); val = arr[0]; } while (val >= limit);
    return val % max;
  }

  function pickOne(str) {
    return str[cryptoRandInt(str.length)];
  }

  /* ── Passphrase Generator ─────────────────────────────── */

  const WORDS = [
    'apple','brave','cloud','dance','eagle','flame','grace','honey',
    'ivory','jewel','karma','lemon','mango','noble','ocean','piano',
    'queen','river','stone','tiger','ultra','vivid','water','xenon',
    'yacht','zebra','alpha','beta','gamma','delta','sigma','omega',
    'swift','frost','blaze','crisp','dusk','echo','forge','glow',
    'halo','iron','jade','keen','lunar','mist','nova','orbit',
    'peak','quest','ridge','spark','trek','unity','vault','wave',
  ];

  function generatePassphrase(wordCount = 4, separator = '-', capitalize = true) {
    const words = [];
    for (let i = 0; i < wordCount; i++) {
      let word = WORDS[cryptoRandInt(WORDS.length)];
      if (capitalize) word = word[0].toUpperCase() + word.slice(1);
      words.push(word);
    }
    // Add a random number at end for extra entropy
    const num = cryptoRandInt(9999).toString().padStart(2, '0');
    words.push(num);
    return words.join(separator);
  }

  /* ── UI Init ──────────────────────────────────────────── */

  const history = [];

  function init() {
    const generateBtn  = document.getElementById('pwd-generate-btn');
    if (!generateBtn) return;

    const output       = document.getElementById('pwd-output');
    const copyBtn      = document.getElementById('pwd-copy-btn');
    const refreshBtn   = document.getElementById('pwd-refresh-btn');
    const lengthEl     = document.getElementById('pwd-length');
    const lengthVal    = document.getElementById('pwd-length-val');
    const strengthBar  = document.getElementById('pwd-strength-bar');
    const strengthLbl  = document.getElementById('pwd-strength-label');
    const bulkBtn      = document.getElementById('pwd-bulk-btn');
    const bulkCount    = document.getElementById('pwd-bulk-count');
    const bulkOutput   = document.getElementById('pwd-bulk-output');
    const bulkCopy     = document.getElementById('pwd-bulk-copy');
    const historyList  = document.getElementById('pwd-history');

    // Passphrase
    const phraseBtn    = document.getElementById('phrase-generate-btn');
    const phraseOutput = document.getElementById('phrase-output');
    const phraseCopy   = document.getElementById('phrase-copy-btn');
    const wordCount    = document.getElementById('phrase-words');
    const separator    = document.getElementById('phrase-separator');

    Utils.initTabs(document.querySelector('.tabs-container') || document.body);

    // Sync length slider display
    if (lengthEl) {
      lengthEl.addEventListener('input', () => {
        lengthVal.textContent = lengthEl.value;
      });
    }

    function getOptions() {
      return {
        length:           parseInt(lengthEl?.value) || 16,
        upper:            document.getElementById('pwd-upper')?.checked ?? true,
        lower:            document.getElementById('pwd-lower')?.checked ?? true,
        digits:           document.getElementById('pwd-digits')?.checked ?? true,
        symbols:          document.getElementById('pwd-symbols')?.checked ?? true,
        excludeSimilar:   document.getElementById('pwd-no-similar')?.checked ?? false,
        excludeAmbiguous: document.getElementById('pwd-no-ambiguous')?.checked ?? false,
        mustIncludeEach:  document.getElementById('pwd-must-each')?.checked ?? true,
      };
    }

    function updateStrength(pwd) {
      const s = strength(pwd);
      if (strengthBar) {
        strengthBar.style.width = `${s.pct}%`;
        strengthBar.style.background = s.color;
      }
      if (strengthLbl) {
        strengthLbl.textContent = s.label;
        strengthLbl.style.color = s.color;
      }
    }

    function doGenerate() {
      try {
        const opts = getOptions();
        const pwd  = generate(opts);
        output.value = pwd;
        updateStrength(pwd);
        // Add to history (max 10)
        history.unshift(pwd);
        if (history.length > 10) history.pop();
        renderHistory();
      } catch (err) {
        Utils.showToast(`⚠ ${err.message}`);
      }
    }

    generateBtn.addEventListener('click', doGenerate);
    if (refreshBtn) refreshBtn.addEventListener('click', doGenerate);

    // Auto-generate on load
    doGenerate();

    // Strength on manual edit
    if (output) output.addEventListener('input', () => updateStrength(output.value));

    // Copy
    if (copyBtn) copyBtn.addEventListener('click', () => {
      if (output.value) Utils.copyToClipboard(output.value, 'Password copied!');
    });

    // Bulk generate
    if (bulkBtn) {
      bulkBtn.addEventListener('click', () => {
        try {
          const count = Math.min(parseInt(bulkCount?.value) || 10, 100);
          const opts  = getOptions();
          const list  = generateBulk(count, opts);
          bulkOutput.value = list.join('\n');
        } catch (err) {
          Utils.showToast(`⚠ ${err.message}`);
        }
      });
    }

    if (bulkCopy) bulkCopy.addEventListener('click', () => {
      if (bulkOutput.value) Utils.copyToClipboard(bulkOutput.value, `${bulkOutput.value.split('\n').length} passwords copied!`);
    });

    // Passphrase
    if (phraseBtn) {
      phraseBtn.addEventListener('click', () => {
        const count = parseInt(wordCount?.value) || 4;
        const sep   = separator?.value || '-';
        const cap   = document.getElementById('phrase-capitalize')?.checked ?? true;
        phraseOutput.value = generatePassphrase(count, sep, cap);
      });
      phraseBtn.click(); // auto-generate
    }

    if (phraseCopy) phraseCopy.addEventListener('click', () => {
      if (phraseOutput.value) Utils.copyToClipboard(phraseOutput.value, 'Passphrase copied!');
    });

    function renderHistory() {
      if (!historyList) return;
      historyList.innerHTML = history.map((p, i) => `
        <div class="hist-item">
          <span class="hist-item__pwd">${Utils.sanitize(p)}</span>
          <button class="btn btn--sm btn--icon" onclick="Utils.copyToClipboard('${Utils.sanitize(p)}', 'Copied!')">⎘</button>
        </div>
      `).join('');
    }
  }

  return { init, generate, generateBulk, generatePassphrase, strength };

})();

document.addEventListener('DOMContentLoaded', () => { PasswordModule.init(); Utils.initNavbar(); });
window.PasswordModule = PasswordModule;
