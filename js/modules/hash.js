/**
 * modules/hash.js — Hashing Module
 * Uses: Web Crypto API (SHA family, HMAC) + CryptoJS (MD5) + bcryptjs
 * Supports: MD5, SHA-1, SHA-256, SHA-384, SHA-512, HMAC, Bcrypt
 */

'use strict';

const HashModule = (() => {

  /* ── Web Crypto SHA ───────────────────────────────────── */

  async function sha(text, algorithm = 'SHA-256') {
    const enc  = new TextEncoder();
    const buf  = await crypto.subtle.digest(algorithm, enc.encode(text));
    return Utils.bufToHex(buf);
  }

  /* ── HMAC ─────────────────────────────────────────────── */

  async function hmac(text, secret, algorithm = 'SHA-256') {
    const enc    = new TextEncoder();
    const rawKey = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: algorithm }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', rawKey, enc.encode(text));
    return Utils.bufToHex(sig);
  }

  /* ── MD5 (via CryptoJS) ───────────────────────────────── */

  function md5(text) {
    if (!window.CryptoJS) throw new Error('CryptoJS not loaded');
    return window.CryptoJS.MD5(text).toString();
  }

  /* ── Bcrypt (via bcryptjs) ────────────────────────────── */

  async function bcryptHash(text, rounds = 10) {
    if (!window.dcodeIO?.bcrypt && !window.bcrypt) throw new Error('bcryptjs not loaded');
    const lib = window.dcodeIO?.bcrypt || window.bcrypt;
    const salt = await lib.genSalt(rounds);
    return lib.hash(text, salt);
  }

  async function bcryptVerify(text, hash) {
    if (!window.dcodeIO?.bcrypt && !window.bcrypt) throw new Error('bcryptjs not loaded');
    const lib = window.dcodeIO?.bcrypt || window.bcrypt;
    return lib.compare(text, hash);
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    const hashBtn = document.getElementById('hash-btn');
    if (!hashBtn) return;

    const inputEl  = document.getElementById('hash-input');
    const algoEl   = document.getElementById('hash-algo');
    const outBox   = document.getElementById('hash-output');
    const copyBtn  = document.getElementById('hash-copy');
    const clearBtn = document.getElementById('hash-clear');

    // HMAC section
    const hmacBtn  = document.getElementById('hmac-btn');
    const hmacIn   = document.getElementById('hmac-input');
    const hmacKey  = document.getElementById('hmac-key');
    const hmacAlgo = document.getElementById('hmac-algo');
    const hmacOut  = document.getElementById('hmac-output');

    // Bcrypt section
    const bcryptBtn    = document.getElementById('bcrypt-btn');
    const bcryptVerBtn = document.getElementById('bcrypt-verify-btn');
    const bcryptIn     = document.getElementById('bcrypt-input');
    const bcryptRounds = document.getElementById('bcrypt-rounds');
    const bcryptHash_  = document.getElementById('bcrypt-hash-field');
    const bcryptOut    = document.getElementById('bcrypt-output');

    Utils.initTabs(document.querySelector('.tabs-container') || document.body);

    hashBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Input text')) return;
      Utils.setLoading(hashBtn, true);
      try {
        const algo = algoEl.value;
        let result;
        if (algo === 'MD5') result = md5(inputEl.value);
        else result = await sha(inputEl.value, algo);
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
      Utils.setLoading(hashBtn, false);
    });

    if (hmacBtn) {
      hmacBtn.addEventListener('click', async () => {
        if (!Utils.requireField(hmacIn, 'Message')) return;
        if (!Utils.requireField(hmacKey, 'Secret key')) return;
        Utils.setLoading(hmacBtn, true);
        try {
          const result = await hmac(hmacIn.value, hmacKey.value, hmacAlgo.value);
          Utils.setOutput(hmacOut, result, 'success');
        } catch (err) {
          Utils.setOutput(hmacOut, `Error: ${err.message}`, 'error');
        }
        Utils.setLoading(hmacBtn, false);
      });
    }

    if (bcryptBtn) {
      bcryptBtn.addEventListener('click', async () => {
        if (!Utils.requireField(bcryptIn, 'Input text')) return;
        Utils.setLoading(bcryptBtn, true);
        try {
          const rounds = parseInt(bcryptRounds?.value) || 10;
          const result = await bcryptHash(bcryptIn.value, rounds);
          bcryptHash_.value = result;
          Utils.setOutput(bcryptOut, result, 'success');
        } catch (err) {
          Utils.setOutput(bcryptOut, `Error: ${err.message}`, 'error');
        }
        Utils.setLoading(bcryptBtn, false);
      });
    }

    if (bcryptVerBtn) {
      bcryptVerBtn.addEventListener('click', async () => {
        if (!Utils.requireField(bcryptIn, 'Input text')) return;
        if (!bcryptHash_.value.trim()) { Utils.showToast('⚠ Hash is required'); return; }
        Utils.setLoading(bcryptVerBtn, true);
        try {
          const match = await bcryptVerify(bcryptIn.value, bcryptHash_.value.trim());
          Utils.setOutput(bcryptOut, match ? '✓ Hash matches — verified!' : '✗ Hash does not match', match ? 'success' : 'error');
        } catch (err) {
          Utils.setOutput(bcryptOut, `Error: ${err.message}`, 'error');
        }
        Utils.setLoading(bcryptVerBtn, false);
      });
    }

    if (copyBtn) copyBtn.addEventListener('click', () => Utils.copyToClipboard(outBox.textContent, 'Hash copied'));
    if (clearBtn) clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      outBox.innerHTML = '<span class="placeholder">Hash will appear here…</span>';
    });

    // Auto-hash on input (debounced) for the main section
    inputEl.addEventListener('input', Utils.debounce(async () => {
      const val = inputEl.value;
      if (!val) return;
      try {
        const algo = algoEl.value;
        let result;
        if (algo === 'MD5') result = md5(val);
        else result = await sha(val, algo);
        Utils.setOutput(outBox, result, 'success');
      } catch (_) {}
    }, 500));
  }

  return { init, sha, hmac, md5, bcryptHash, bcryptVerify };

})();

document.addEventListener('DOMContentLoaded', () => { HashModule.init(); Utils.initNavbar(); });
window.HashModule = HashModule;
