/**
 * modules/aes.js — AES Encryption / Decryption Module
 * Uses: Web Crypto API (native browser)
 * Supports: AES-GCM (recommended), AES-CBC, AES-CTR
 * Key lengths: 128, 192, 256 bit
 */

'use strict';

const AESModule = (() => {

  /* ── Helpers ──────────────────────────────────────────── */

  async function deriveKey(password, salt, keyLen) {
    const enc = new TextEncoder();
    const raw = enc.encode(password);
    const importedKey = await crypto.subtle.importKey(
      'raw', raw, { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      importedKey,
      { name: 'AES-GCM', length: keyLen },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function importRawKey(keyData, algorithm, keyLen) {
    return crypto.subtle.importKey(
      'raw', keyData,
      { name: algorithm, length: keyLen },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function parseKeyInput(keyStr, keyLen) {
    const enc = new TextEncoder();
    if (/^[0-9a-fA-F]+$/.test(keyStr) && keyStr.length === keyLen / 4) {
      return Utils.hexToBuf(keyStr);
    }
    // Try Base64
    try {
      const buf = Utils.base64ToBuf(keyStr);
      if (new Uint8Array(buf).length === keyLen / 8) return new Uint8Array(buf);
    } catch (_) {}
    // Pad/trim plain text to required byte length
    const raw = enc.encode(keyStr);
    const out  = new Uint8Array(keyLen / 8);
    out.set(raw.slice(0, keyLen / 8));
    return out;
  }

  /* ── AES-GCM ──────────────────────────────────────────── */

  async function encryptGCM(plaintext, keyStr, keyLen = 256) {
    const enc    = new TextEncoder();
    const iv     = crypto.getRandomValues(new Uint8Array(12));
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-GCM', keyLen);
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
    );
    // Prepend IV to ciphertext for storage
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);
    return Utils.bufToBase64(combined.buffer);
  }

  async function decryptGCM(cipherB64, keyStr, keyLen = 256) {
    const data   = new Uint8Array(Utils.base64ToBuf(cipherB64));
    const iv     = data.slice(0, 12);
    const cipher = data.slice(12);
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-GCM', keyLen);
    const plain  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, cipher
    );
    return new TextDecoder().decode(plain);
  }

  /* ── AES-CBC ──────────────────────────────────────────── */

  async function encryptCBC(plaintext, keyStr, keyLen = 256) {
    const enc    = new TextEncoder();
    const iv     = crypto.getRandomValues(new Uint8Array(16));
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-CBC', keyLen);
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv }, key, enc.encode(plaintext)
    );
    const combined = new Uint8Array(16 + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), 16);
    return Utils.bufToBase64(combined.buffer);
  }

  async function decryptCBC(cipherB64, keyStr, keyLen = 256) {
    const data   = new Uint8Array(Utils.base64ToBuf(cipherB64));
    const iv     = data.slice(0, 16);
    const cipher = data.slice(16);
    const keyBuf = parseKeyInput(keyStr, keyLen);
    const key    = await importRawKey(keyBuf, 'AES-CBC', keyLen);
    const plain  = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv }, key, cipher
    );
    return new TextDecoder().decode(plain);
  }

  /* ── AES-CTR ──────────────────────────────────────────── */

  async function encryptCTR(plaintext, keyStr, keyLen = 256) {
    const enc    = new TextEncoder();
    const counter = crypto.getRandomValues(new Uint8Array(16));
    const keyBuf  = parseKeyInput(keyStr, keyLen);
    const key     = await importRawKey(keyBuf, 'AES-CTR', keyLen);
    const cipher  = await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter, length: 64 }, key, enc.encode(plaintext)
    );
    const combined = new Uint8Array(16 + cipher.byteLength);
    combined.set(counter, 0);
    combined.set(new Uint8Array(cipher), 16);
    return Utils.bufToBase64(combined.buffer);
  }

  async function decryptCTR(cipherB64, keyStr, keyLen = 256) {
    const data    = new Uint8Array(Utils.base64ToBuf(cipherB64));
    const counter = data.slice(0, 16);
    const cipher  = data.slice(16);
    const keyBuf  = parseKeyInput(keyStr, keyLen);
    const key     = await importRawKey(keyBuf, 'AES-CTR', keyLen);
    const plain   = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter, length: 64 }, key, cipher
    );
    return new TextDecoder().decode(plain);
  }

  /* ── Generate Secure Key ──────────────────────────────── */

  function generateKey(bits = 256, format = 'hex') {
    const bytes = new Uint8Array(bits / 8);
    crypto.getRandomValues(bytes);
    if (format === 'base64') return btoa(String.fromCharCode(...bytes));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    const encBtn  = document.getElementById('aes-encrypt-btn');
    const decBtn  = document.getElementById('aes-decrypt-btn');
    const clearBtn= document.getElementById('aes-clear-btn');
    const copyBtn = document.getElementById('aes-copy-btn');
    const genKey  = document.getElementById('aes-gen-key');
    const inputEl = document.getElementById('aes-input');
    const keyEl   = document.getElementById('aes-key');
    const modeEl  = document.getElementById('aes-mode');
    const bitsEl  = document.getElementById('aes-bits');
    const outBox  = document.getElementById('aes-output');
    const counter = document.getElementById('aes-char-count');

    if (!encBtn) return; // Not on AES page

    Utils.bindCharCounter(inputEl, counter);
    Utils.initTabs(document.querySelector('.tabs-container') || document.body);

    genKey.addEventListener('click', () => {
      const fmt = document.getElementById('aes-key-format')?.value || 'hex';
      keyEl.value = generateKey(parseInt(bitsEl.value) || 256, fmt);
      Utils.showToast('🔑 Key generated');
    });

    encBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Plaintext')) return;
      if (!Utils.requireField(keyEl, 'Secret key')) return;
      Utils.setLoading(encBtn, true);
      try {
        const mode = modeEl.value;
        const bits = parseInt(bitsEl.value) || 256;
        let result;
        if      (mode === 'GCM') result = await encryptGCM(inputEl.value, keyEl.value, bits);
        else if (mode === 'CBC') result = await encryptCBC(inputEl.value, keyEl.value, bits);
        else if (mode === 'CTR') result = await encryptCTR(inputEl.value, keyEl.value, bits);
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
      Utils.setLoading(encBtn, false);
    });

    decBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Ciphertext')) return;
      if (!Utils.requireField(keyEl, 'Secret key')) return;
      Utils.setLoading(decBtn, true);
      try {
        const mode = modeEl.value;
        const bits = parseInt(bitsEl.value) || 256;
        let result;
        if      (mode === 'GCM') result = await decryptGCM(inputEl.value, keyEl.value, bits);
        else if (mode === 'CBC') result = await decryptCBC(inputEl.value, keyEl.value, bits);
        else if (mode === 'CTR') result = await decryptCTR(inputEl.value, keyEl.value, bits);
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, 'Decryption failed — check your key, mode, and input.', 'error');
      }
      Utils.setLoading(decBtn, false);
    });

    clearBtn.addEventListener('click', () => {
      inputEl.value = ''; keyEl.value = '';
      Utils.setOutput(outBox, '', 'default');
      outBox.innerHTML = '<span class="placeholder">Output will appear here…</span>';
    });

    copyBtn.addEventListener('click', () => {
      const text = outBox.textContent.trim();
      if (text && text !== 'Output will appear here…')
        Utils.copyToClipboard(text, 'Output copied');
    });
  }

  return { init, encryptGCM, decryptGCM, encryptCBC, decryptCBC, encryptCTR, decryptCTR, generateKey };

})();

document.addEventListener('DOMContentLoaded', () => { AESModule.init(); Utils.initNavbar(); });
window.AESModule = AESModule;
