/**
 * modules/aes.js — AES Encryption / Decryption Module
 * Uses: Web Crypto API (native browser)
 * Supports: AES-GCM (recommended), AES-CBC, AES-CTR
 * Key lengths: 128, 192, 256 bit
 * NEW: Custom IV input, Output format (Base64 / HEX)
 */

'use strict';

const AESModule = (() => {

  /* ── Key Parsing ──────────────────────────────────────── */

  function parseKeyInput(keyStr, keyLen) {
    const enc = new TextEncoder();
    // Hex
    if (/^[0-9a-fA-F]+$/.test(keyStr) && keyStr.length === keyLen / 4) {
      return Utils.hexToBuf(keyStr);
    }
    // Base64
    try {
      const buf = Utils.base64ToBuf(keyStr);
      if (new Uint8Array(buf).length === keyLen / 8) return new Uint8Array(buf);
    } catch (_) {}
    // Plaintext — pad/trim to required length
    const raw = enc.encode(keyStr);
    const out = new Uint8Array(keyLen / 8);
    out.set(raw.slice(0, keyLen / 8));
    return out;
  }

  async function importRawKey(keyData, algorithm, keyLen) {
    return crypto.subtle.importKey(
      'raw', keyData, { name: algorithm, length: keyLen }, false, ['encrypt', 'decrypt']
    );
  }

  /* ── IV Parsing ───────────────────────────────────────── */

  function parseIVInput(ivStr, ivLen) {
    if (!ivStr || !ivStr.trim()) return null; // auto-generate
    const s = ivStr.trim();
    // Hex string
    if (/^[0-9a-fA-F]+$/.test(s) && s.length === ivLen * 2) {
      return Utils.hexToBuf(s);
    }
    // Base64
    try {
      const buf = new Uint8Array(Utils.base64ToBuf(s));
      if (buf.length === ivLen) return buf;
    } catch (_) {}
    // UTF-8 text — pad/trim
    const raw = new TextEncoder().encode(s);
    const out = new Uint8Array(ivLen);
    out.set(raw.slice(0, ivLen));
    return out;
  }

  /* ── Format helpers ───────────────────────────────────── */

  function toOutputFormat(buf, format) {
    if (format === 'HEX') return Utils.bufToHex(buf);
    return Utils.bufToBase64(buf); // Base64 default
  }

  function fromInputFormat(str, format) {
    const s = str.trim();
    if (format === 'HEX') {
      return Utils.hexToBuf(s).buffer;
    }
    return Utils.base64ToBuf(s); // Base64 default
  }

  /* ── AES-GCM ──────────────────────────────────────────── */

  async function encryptGCM(plaintext, keyStr, keyLen = 256, options = {}) {
    const { ivStr = '', outputFormat = 'Base64' } = options;
    const enc    = new TextEncoder();
    const ivBuf  = parseIVInput(ivStr, 12);
    const iv     = ivBuf || crypto.getRandomValues(new Uint8Array(12));
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-GCM', keyLen);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));

    // Output: IV prepended to ciphertext
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);

    return {
      result: toOutputFormat(combined.buffer, outputFormat),
      iv:     Utils.bufToHex(iv),
      ivBase64: Utils.bufToBase64(iv.buffer),
    };
  }

  async function decryptGCM(cipherStr, keyStr, keyLen = 256, options = {}) {
    const { ivStr = '', inputFormat = 'Base64' } = options;
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-GCM', keyLen);

    let iv, cipher;
    const ivBuf = parseIVInput(ivStr, 12);

    if (ivBuf) {
      // User provided IV separately — ciphertext has no prepended IV
      iv     = ivBuf;
      cipher = new Uint8Array(fromInputFormat(cipherStr, inputFormat));
    } else {
      // IV is prepended to ciphertext
      const data = new Uint8Array(fromInputFormat(cipherStr, inputFormat));
      iv     = data.slice(0, 12);
      cipher = data.slice(12);
    }

    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  }

  /* ── AES-CBC ──────────────────────────────────────────── */

  async function encryptCBC(plaintext, keyStr, keyLen = 256, options = {}) {
    const { ivStr = '', outputFormat = 'Base64' } = options;
    const enc    = new TextEncoder();
    const ivBuf  = parseIVInput(ivStr, 16);
    const iv     = ivBuf || crypto.getRandomValues(new Uint8Array(16));
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-CBC', keyLen);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, enc.encode(plaintext));

    const combined = new Uint8Array(16 + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), 16);

    return {
      result: toOutputFormat(combined.buffer, outputFormat),
      iv:     Utils.bufToHex(iv),
      ivBase64: Utils.bufToBase64(iv.buffer),
    };
  }

  async function decryptCBC(cipherStr, keyStr, keyLen = 256, options = {}) {
    const { ivStr = '', inputFormat = 'Base64' } = options;
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-CBC', keyLen);

    let iv, cipher;
    const ivBuf = parseIVInput(ivStr, 16);

    if (ivBuf) {
      iv     = ivBuf;
      cipher = new Uint8Array(fromInputFormat(cipherStr, inputFormat));
    } else {
      const data = new Uint8Array(fromInputFormat(cipherStr, inputFormat));
      iv     = data.slice(0, 16);
      cipher = data.slice(16);
    }

    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  }

  /* ── AES-CTR ──────────────────────────────────────────── */

  async function encryptCTR(plaintext, keyStr, keyLen = 256, options = {}) {
    const { ivStr = '', outputFormat = 'Base64' } = options;
    const enc     = new TextEncoder();
    const ivBuf   = parseIVInput(ivStr, 16);
    const counter = ivBuf || crypto.getRandomValues(new Uint8Array(16));
    const keyBuf  = parseKeyInput(keyStr, keyLen);
    const key     = await importRawKey(keyBuf, 'AES-CTR', keyLen);
    const cipher  = await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter, length: 64 }, key, enc.encode(plaintext)
    );

    const combined = new Uint8Array(16 + cipher.byteLength);
    combined.set(counter, 0);
    combined.set(new Uint8Array(cipher), 16);

    return {
      result: toOutputFormat(combined.buffer, outputFormat),
      iv:     Utils.bufToHex(counter),
      ivBase64: Utils.bufToBase64(counter.buffer),
    };
  }

  async function decryptCTR(cipherStr, keyStr, keyLen = 256, options = {}) {
    const { ivStr = '', inputFormat = 'Base64' } = options;
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-CTR', keyLen);

    let counter, cipher;
    const ivBuf = parseIVInput(ivStr, 16);

    if (ivBuf) {
      counter = ivBuf;
      cipher  = new Uint8Array(fromInputFormat(cipherStr, inputFormat));
    } else {
      const data = new Uint8Array(fromInputFormat(cipherStr, inputFormat));
      counter = data.slice(0, 16);
      cipher  = data.slice(16);
    }

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter, length: 64 }, key, cipher
    );
    return new TextDecoder().decode(plain);
  }

  /* ── Generate Key ─────────────────────────────────────── */

  function generateKey(bits = 256, format = 'hex') {
    const bytes = new Uint8Array(bits / 8);
    crypto.getRandomValues(bytes);
    if (format === 'base64') return btoa(String.fromCharCode(...bytes));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateIV(mode, format = 'hex') {
    const len   = mode === 'GCM' ? 12 : 16;
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    if (format === 'base64') return Utils.bufToBase64(bytes.buffer);
    return Utils.bufToHex(bytes);
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    const encBtn   = document.getElementById('aes-encrypt-btn');
    if (!encBtn) return;

    const decBtn   = document.getElementById('aes-decrypt-btn');
    const clearBtn = document.getElementById('aes-clear-btn');
    const copyBtn  = document.getElementById('aes-copy-btn');
    const genKey   = document.getElementById('aes-gen-key');
    const genIV    = document.getElementById('aes-gen-iv');
    const inputEl  = document.getElementById('aes-input');
    const keyEl    = document.getElementById('aes-key');
    const ivEl     = document.getElementById('aes-iv');
    const modeEl   = document.getElementById('aes-mode');
    const bitsEl   = document.getElementById('aes-bits');
    const fmtEl    = document.getElementById('aes-output-format');
    const outBox   = document.getElementById('aes-output');
    const counter  = document.getElementById('aes-char-count');
    const ivInfo   = document.getElementById('aes-iv-info');
    const ivInfoVal= document.getElementById('aes-iv-info-val');
    const copyIVBtn= document.getElementById('aes-copy-iv');

    Utils.bindCharCounter(inputEl, counter);

    // Update IV placeholder based on mode
    function updateIVHint() {
      const mode = modeEl.value;
      const ivGroup = document.getElementById('aes-iv-group');
      if (!ivEl) return;
      if (mode === 'GCM') {
        ivEl.placeholder = '12 bytes — hex (24 chars) or base64 or text';
      } else {
        ivEl.placeholder = '16 bytes — hex (32 chars) or base64 or text';
      }
      // GCM doesn't need IV for ECB — but all our modes use IV
      if (ivGroup) ivGroup.style.display = 'block';
    }
    if (modeEl) { modeEl.addEventListener('change', updateIVHint); updateIVHint(); }

    // Generate key
    genKey.addEventListener('click', () => {
      const fmt = document.getElementById('aes-key-format')?.value || 'hex';
      keyEl.value = generateKey(parseInt(bitsEl.value) || 256, fmt);
      Utils.showToast('🔑 Key generated');
    });

    // Generate IV
    if (genIV) {
      genIV.addEventListener('click', () => {
        const fmt = document.getElementById('aes-iv-format')?.value || 'hex';
        ivEl.value = generateIV(modeEl.value, fmt);
        Utils.showToast('🔀 IV generated');
      });
    }

    function showIVInfo(ivHex) {
      if (!ivInfo || !ivInfoVal) return;
      ivInfoVal.textContent = ivHex;
      ivInfo.style.display = 'block';
    }

    encBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Plaintext')) return;
      if (!Utils.requireField(keyEl,   'Secret key')) return;
      Utils.setLoading(encBtn, true);
      if (ivInfo) ivInfo.style.display = 'none';
      try {
        const mode = modeEl.value;
        const bits = parseInt(bitsEl.value) || 256;
        const opts = { ivStr: ivEl?.value || '', outputFormat: fmtEl?.value || 'Base64' };
        let res;
        if      (mode === 'GCM') res = await encryptGCM(inputEl.value, keyEl.value, bits, opts);
        else if (mode === 'CBC') res = await encryptCBC(inputEl.value, keyEl.value, bits, opts);
        else if (mode === 'CTR') res = await encryptCTR(inputEl.value, keyEl.value, bits, opts);
        Utils.setOutput(outBox, res.result, 'success');
        showIVInfo(res.iv);
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
      Utils.setLoading(encBtn, false);
    });

    decBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Ciphertext')) return;
      if (!Utils.requireField(keyEl,   'Secret key')) return;
      Utils.setLoading(decBtn, true);
      try {
        const mode = modeEl.value;
        const bits = parseInt(bitsEl.value) || 256;
        const opts = { ivStr: ivEl?.value || '', inputFormat: fmtEl?.value || 'Base64' };
        let result;
        if      (mode === 'GCM') result = await decryptGCM(inputEl.value, keyEl.value, bits, opts);
        else if (mode === 'CBC') result = await decryptCBC(inputEl.value, keyEl.value, bits, opts);
        else if (mode === 'CTR') result = await decryptCTR(inputEl.value, keyEl.value, bits, opts);
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, 'Decryption failed — check your key, mode, IV, and input format.', 'error');
      }
      Utils.setLoading(decBtn, false);
    });

    clearBtn.addEventListener('click', () => {
      inputEl.value = ''; keyEl.value = '';
      if (ivEl) ivEl.value = '';
      if (ivInfo) ivInfo.style.display = 'none';
      Utils.setOutput(outBox, '', 'default');
      outBox.innerHTML = '<span class="placeholder">Output will appear here…</span>';
    });

    copyBtn.addEventListener('click', () => {
      const text = outBox.textContent.trim();
      if (text && !text.includes('appear here'))
        Utils.copyToClipboard(text, 'Output copied');
    });

    if (copyIVBtn) {
      copyIVBtn.addEventListener('click', () => {
        const v = ivInfoVal?.textContent;
        if (v) Utils.copyToClipboard(v, 'IV copied');
      });
    }
  }

  return { init, encryptGCM, decryptGCM, encryptCBC, decryptCBC, encryptCTR, decryptCTR, generateKey, generateIV };

})();

document.addEventListener('DOMContentLoaded', () => { AESModule.init(); Utils.initNavbar(); });
window.AESModule = AESModule;
