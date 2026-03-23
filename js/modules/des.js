/**
 * modules/des.js — DES / Triple DES Encryption & Decryption
 * Uses: CryptoJS (via CDN) — Web Crypto API does not support DES
 *
 * ⚠️ Security Note:
 * DES (56-bit key) is considered BROKEN — vulnerable to brute force.
 * Triple DES (3DES) is deprecated by NIST as of 2023.
 * These tools are provided for LEGACY COMPATIBILITY only.
 * Use AES-256 for any new implementation.
 */

'use strict';

const DESModule = (() => {

  function requireCryptoJS() {
    if (!window.CryptoJS) throw new Error('CryptoJS not loaded');
  }

  function parseKey(keyStr, algorithm) {
    // CryptoJS accepts UTF-8 string keys directly
    return window.CryptoJS.enc.Utf8.parse(keyStr);
  }

  function parseIV(ivStr) {
    if (!ivStr || !ivStr.trim()) return window.CryptoJS.lib.WordArray.random(8);
    return window.CryptoJS.enc.Utf8.parse(ivStr);
  }

  function getMode(modeStr) {
    const modes = {
      CBC: window.CryptoJS.mode.CBC,
      ECB: window.CryptoJS.mode.ECB,
      CFB: window.CryptoJS.mode.CFB,
      OFB: window.CryptoJS.mode.OFB,
    };
    return modes[modeStr] || window.CryptoJS.mode.CBC;
  }

  /* ── DES ─────────────────────────────────────────────── */

  function desEncrypt(plaintext, keyStr, options = {}) {
    requireCryptoJS();
    const { mode = 'CBC', outputFormat = 'Base64', iv: ivStr = '' } = options;
    const key  = parseKey(keyStr, 'DES');
    const iv   = mode === 'ECB' ? undefined : parseIV(ivStr);

    const cfg = {
      mode:    getMode(mode),
      padding: window.CryptoJS.pad.Pkcs7,
    };
    if (iv) cfg.iv = iv;

    const encrypted = window.CryptoJS.DES.encrypt(plaintext, key, cfg);

    if (outputFormat === 'HEX') return encrypted.ciphertext.toString(window.CryptoJS.enc.Hex);
    return encrypted.toString(); // Base64
  }

  function desDecrypt(ciphertext, keyStr, options = {}) {
    requireCryptoJS();
    const { mode = 'CBC', inputFormat = 'Base64', iv: ivStr = '' } = options;
    const key = parseKey(keyStr, 'DES');
    const iv  = mode === 'ECB' ? undefined : parseIV(ivStr);

    let cipherParams;
    if (inputFormat === 'HEX') {
      const wordArray = window.CryptoJS.enc.Hex.parse(ciphertext);
      cipherParams = window.CryptoJS.lib.CipherParams.create({ ciphertext: wordArray });
    } else {
      cipherParams = ciphertext;
    }

    const cfg = {
      mode:    getMode(mode),
      padding: window.CryptoJS.pad.Pkcs7,
    };
    if (iv) cfg.iv = iv;

    const decrypted = window.CryptoJS.DES.decrypt(cipherParams, key, cfg);
    return decrypted.toString(window.CryptoJS.enc.Utf8);
  }

  /* ── Triple DES (3DES) ───────────────────────────────── */

  function tripleDesEncrypt(plaintext, keyStr, options = {}) {
    requireCryptoJS();
    const { mode = 'CBC', outputFormat = 'Base64', iv: ivStr = '' } = options;
    const key = parseKey(keyStr, '3DES');
    const iv  = mode === 'ECB' ? undefined : parseIV(ivStr);

    const cfg = {
      mode:    getMode(mode),
      padding: window.CryptoJS.pad.Pkcs7,
    };
    if (iv) cfg.iv = iv;

    const encrypted = window.CryptoJS.TripleDES.encrypt(plaintext, key, cfg);
    if (outputFormat === 'HEX') return encrypted.ciphertext.toString(window.CryptoJS.enc.Hex);
    return encrypted.toString();
  }

  function tripleDesDecrypt(ciphertext, keyStr, options = {}) {
    requireCryptoJS();
    const { mode = 'CBC', inputFormat = 'Base64', iv: ivStr = '' } = options;
    const key = parseKey(keyStr, '3DES');
    const iv  = mode === 'ECB' ? undefined : parseIV(ivStr);

    let cipherParams;
    if (inputFormat === 'HEX') {
      const wordArray = window.CryptoJS.enc.Hex.parse(ciphertext);
      cipherParams = window.CryptoJS.lib.CipherParams.create({ ciphertext: wordArray });
    } else {
      cipherParams = ciphertext;
    }

    const cfg = {
      mode:    getMode(mode),
      padding: window.CryptoJS.pad.Pkcs7,
    };
    if (iv) cfg.iv = iv;

    const decrypted = window.CryptoJS.TripleDES.decrypt(cipherParams, key, cfg);
    return decrypted.toString(window.CryptoJS.enc.Utf8);
  }

  /* ── UI Helper (shared for both DES and 3DES pages) ─── */

  function initPage(prefix, encryptFn, decryptFn) {
    const encBtn    = document.getElementById(`${prefix}-encrypt-btn`);
    if (!encBtn) return;

    const decBtn    = document.getElementById(`${prefix}-decrypt-btn`);
    const clearBtn  = document.getElementById(`${prefix}-clear-btn`);
    const copyBtn   = document.getElementById(`${prefix}-copy-btn`);
    const dlBtn     = document.getElementById(`${prefix}-download-btn`);
    const inputEl   = document.getElementById(`${prefix}-input`);
    const keyEl     = document.getElementById(`${prefix}-key`);
    const ivEl      = document.getElementById(`${prefix}-iv`);
    const modeEl    = document.getElementById(`${prefix}-mode`);
    const fmtEl     = document.getElementById(`${prefix}-format`);
    const outBox    = document.getElementById(`${prefix}-output`);
    const counter   = document.getElementById(`${prefix}-char-count`);
    const genIvBtn  = document.getElementById(`${prefix}-gen-iv`);

    Utils.initTabs(document.querySelector('.tabs-container') || document.body);
    if (counter) Utils.bindCharCounter(inputEl, counter);

    // Show/hide IV field based on mode
    function toggleIV() {
      const ivGroup = document.getElementById(`${prefix}-iv-group`);
      if (ivGroup) ivGroup.style.opacity = modeEl.value === 'ECB' ? '0.4' : '1';
      if (ivEl)    ivEl.disabled = modeEl.value === 'ECB';
    }
    if (modeEl) { modeEl.addEventListener('change', toggleIV); toggleIV(); }

    // Generate random IV
    if (genIvBtn && ivEl) {
      genIvBtn.addEventListener('click', () => {
        // DES uses 8-byte IV
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        ivEl.value = Array.from(bytes).map(b => String.fromCharCode(b)).join('').slice(0, 8);
        Utils.showToast('🔀 IV generated');
      });
    }

    encBtn.addEventListener('click', () => {
      if (!Utils.requireField(inputEl, 'Plaintext')) return;
      if (!Utils.requireField(keyEl, 'Secret key')) return;
      Utils.setLoading(encBtn, true);
      try {
        const result = encryptFn(inputEl.value, keyEl.value, {
          mode:         modeEl?.value || 'CBC',
          outputFormat: fmtEl?.value  || 'Base64',
          iv:           ivEl?.value   || '',
        });
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
      Utils.setLoading(encBtn, false);
    });

    decBtn.addEventListener('click', () => {
      if (!Utils.requireField(inputEl, 'Ciphertext')) return;
      if (!Utils.requireField(keyEl, 'Secret key')) return;
      Utils.setLoading(decBtn, true);
      try {
        const result = decryptFn(inputEl.value.trim(), keyEl.value, {
          mode:        modeEl?.value || 'CBC',
          inputFormat: fmtEl?.value  || 'Base64',
          iv:          ivEl?.value   || '',
        });
        if (!result) throw new Error('Decryption failed — check your key, mode, and IV.');
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Decryption failed — verify your key, mode, and IV match the encryption settings.`, 'error');
      }
      Utils.setLoading(decBtn, false);
    });

    if (clearBtn) clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      outBox.classList.remove('output-box--success', 'output-box--error');
      outBox.innerHTML = '<span class="placeholder">Output will appear here…</span>';
    });

    if (copyBtn) copyBtn.addEventListener('click', () => {
      const t = outBox.textContent.trim();
      if (t && !t.includes('appear here')) Utils.copyToClipboard(t, 'Output copied!');
    });

    if (dlBtn) dlBtn.addEventListener('click', () => {
      const t = outBox.textContent.trim();
      if (t && !t.includes('appear here')) Utils.downloadText(t, `${prefix}-output.txt`);
    });
  }

  function init() {
    // DES page
    if (document.getElementById('des-encrypt-btn')) {
      initPage('des', desEncrypt, desDecrypt);
    }
    // Triple DES page
    if (document.getElementById('tripledes-encrypt-btn')) {
      initPage('tripledes', tripleDesEncrypt, tripleDesDecrypt);
    }
  }

  return { init, desEncrypt, desDecrypt, tripleDesEncrypt, tripleDesDecrypt };

})();

document.addEventListener('DOMContentLoaded', () => { DESModule.init(); Utils.initNavbar(); });
window.DESModule = DESModule;
