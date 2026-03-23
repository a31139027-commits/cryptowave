/**
 * modules/aes.js — AES Encryption / Decryption Module
 *
 * GCM  → Web Crypto API (authenticated encryption)
 * CBC  → CryptoJS ✓ Compatible with anycript.com
 * ECB  → CryptoJS ✓ Compatible with anycript.com
 * CTR  → Web Crypto API
 */
'use strict';

const AESModule = (() => {

  function requireCryptoJS() {
    if (!window.CryptoJS) throw new Error('CryptoJS not loaded');
  }

  /* ── Key / IV parsing ─────────────────────────────────── */

  function parseKeyInput(keyStr, keyLen) {
    if (/^[0-9a-fA-F]+$/.test(keyStr) && keyStr.length === keyLen / 4)
      return Utils.hexToBuf(keyStr);
    try {
      const buf = Utils.base64ToBuf(keyStr);
      if (new Uint8Array(buf).length === keyLen / 8) return new Uint8Array(buf);
    } catch (_) {}
    const raw = new TextEncoder().encode(keyStr);
    const out = new Uint8Array(keyLen / 8);
    out.set(raw.slice(0, keyLen / 8));
    return out;
  }

  async function importRawKey(keyData, algorithm, keyLen) {
    return crypto.subtle.importKey('raw', keyData, { name: algorithm, length: keyLen }, false, ['encrypt','decrypt']);
  }

  function parseIVBytes(ivStr, ivLen) {
    if (!ivStr || !ivStr.trim()) return null;
    const s = ivStr.trim();
    if (/^[0-9a-fA-F]+$/.test(s) && s.length === ivLen * 2) return Utils.hexToBuf(s);
    try {
      const buf = new Uint8Array(Utils.base64ToBuf(s));
      if (buf.length === ivLen) return buf;
    } catch (_) {}
    const raw = new TextEncoder().encode(s);
    const out = new Uint8Array(ivLen);
    out.set(raw.slice(0, ivLen));
    return out;
  }

  function toOutputFormat(buf, format) {
    return format === 'HEX' ? Utils.bufToHex(buf) : Utils.bufToBase64(buf);
  }

  function fromInputFormat(str, format) {
    return format === 'HEX' ? Utils.hexToBuf(str.trim()).buffer : Utils.base64ToBuf(str.trim());
  }

  /* ── CryptoJS helpers ─────────────────────────────────── */

  function toCJS(uint8) {
    const words = [];
    for (let i = 0; i < uint8.length; i += 4)
      words.push(((uint8[i]||0)<<24)|((uint8[i+1]||0)<<16)|((uint8[i+2]||0)<<8)|(uint8[i+3]||0));
    return window.CryptoJS.lib.WordArray.create(words, uint8.length);
  }

  function fromCJS(wa) {
    const u8 = new Uint8Array(wa.sigBytes);
    for (let i = 0; i < wa.sigBytes; i++)
      u8[i] = (wa.words[i>>>2] >>> (24-(i%4)*8)) & 0xff;
    return u8;
  }

  /* ── AES-GCM (Web Crypto) ─────────────────────────────── */

  async function encryptGCM(text, keyStr, keyLen=256, opts={}) {
    const {ivStr='', outputFormat='Base64'} = opts;
    const enc = new TextEncoder();
    const ivBuf = parseIVBytes(ivStr, 12);
    const iv = ivBuf || crypto.getRandomValues(new Uint8Array(12));
    const key = await importRawKey(parseKeyInput(keyStr, keyLen), 'AES-GCM', keyLen);
    const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(text));
    const combined = new Uint8Array(12 + cipher.byteLength);
    combined.set(iv); combined.set(new Uint8Array(cipher), 12);
    return { result: toOutputFormat(combined.buffer, outputFormat), iv: Utils.bufToHex(iv) };
  }

  async function decryptGCM(cipherStr, keyStr, keyLen=256, opts={}) {
    const {ivStr='', inputFormat='Base64'} = opts;
    const key = await importRawKey(parseKeyInput(keyStr, keyLen), 'AES-GCM', keyLen);
    const ivBuf = parseIVBytes(ivStr, 12);
    let iv, cipher;
    if (ivBuf) { iv=ivBuf; cipher=new Uint8Array(fromInputFormat(cipherStr,inputFormat)); }
    else { const d=new Uint8Array(fromInputFormat(cipherStr,inputFormat)); iv=d.slice(0,12); cipher=d.slice(12); }
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, cipher));
  }

  /* ── AES-CBC (CryptoJS — anycript.com compatible) ──────── */

  function encryptCBC(text, keyStr, keyLen=256, opts={}) {
    requireCryptoJS();
    const {ivStr='', outputFormat='Base64'} = opts;
    const keyBytes = parseKeyInput(keyStr, keyLen);
    const ivBuf = parseIVBytes(ivStr, 16);
    const iv = ivBuf || (() => { const b=new Uint8Array(16); crypto.getRandomValues(b); return b; })();
    const enc = window.CryptoJS.AES.encrypt(text, toCJS(keyBytes),
      {iv: toCJS(iv), mode: window.CryptoJS.mode.CBC, padding: window.CryptoJS.pad.Pkcs7});
    return { result: toOutputFormat(fromCJS(enc.ciphertext).buffer, outputFormat), iv: Utils.bufToHex(iv) };
  }

  function decryptCBC(cipherStr, keyStr, keyLen=256, opts={}) {
    requireCryptoJS();
    const {ivStr='', inputFormat='Base64'} = opts;
    const keyBytes = parseKeyInput(keyStr, keyLen);
    const ivBuf = parseIVBytes(ivStr, 16);
    const iv = ivBuf || new Uint8Array(16);
    const cwa = inputFormat==='HEX'
      ? window.CryptoJS.enc.Hex.parse(cipherStr.trim())
      : window.CryptoJS.enc.Base64.parse(cipherStr.trim());
    const dec = window.CryptoJS.AES.decrypt(
      window.CryptoJS.lib.CipherParams.create({ciphertext: cwa}),
      toCJS(keyBytes), {iv: toCJS(iv), mode: window.CryptoJS.mode.CBC, padding: window.CryptoJS.pad.Pkcs7}
    );
    const r = dec.toString(window.CryptoJS.enc.Utf8);
    if (!r) throw new Error('Decryption failed — check key, IV, and input.');
    return r;
  }

  /* ── AES-ECB (CryptoJS — anycript.com compatible) ──────── */

  function encryptECB(text, keyStr, keyLen=256, opts={}) {
    requireCryptoJS();
    const {outputFormat='Base64'} = opts;
    const keyBytes = parseKeyInput(keyStr, keyLen);
    const enc = window.CryptoJS.AES.encrypt(text, toCJS(keyBytes),
      {mode: window.CryptoJS.mode.ECB, padding: window.CryptoJS.pad.Pkcs7});
    return { result: toOutputFormat(fromCJS(enc.ciphertext).buffer, outputFormat), iv: '(ECB — no IV)' };
  }

  function decryptECB(cipherStr, keyStr, keyLen=256, opts={}) {
    requireCryptoJS();
    const {inputFormat='Base64'} = opts;
    const keyBytes = parseKeyInput(keyStr, keyLen);
    const cwa = inputFormat==='HEX'
      ? window.CryptoJS.enc.Hex.parse(cipherStr.trim())
      : window.CryptoJS.enc.Base64.parse(cipherStr.trim());
    const dec = window.CryptoJS.AES.decrypt(
      window.CryptoJS.lib.CipherParams.create({ciphertext: cwa}),
      toCJS(keyBytes), {mode: window.CryptoJS.mode.ECB, padding: window.CryptoJS.pad.Pkcs7}
    );
    const r = dec.toString(window.CryptoJS.enc.Utf8);
    if (!r) throw new Error('Decryption failed — check key and input.');
    return r;
  }

  /* ── AES-CTR (Web Crypto) ─────────────────────────────── */

  async function encryptCTR(text, keyStr, keyLen=256, opts={}) {
    const {ivStr='', outputFormat='Base64'} = opts;
    const enc = new TextEncoder();
    const ivBuf = parseIVBytes(ivStr, 16);
    const counter = ivBuf || crypto.getRandomValues(new Uint8Array(16));
    const key = await importRawKey(parseKeyInput(keyStr, keyLen), 'AES-CTR', keyLen);
    const cipher = await crypto.subtle.encrypt({name:'AES-CTR',counter,length:64}, key, enc.encode(text));
    const combined = new Uint8Array(16 + cipher.byteLength);
    combined.set(counter); combined.set(new Uint8Array(cipher), 16);
    return { result: toOutputFormat(combined.buffer, outputFormat), iv: Utils.bufToHex(counter) };
  }

  async function decryptCTR(cipherStr, keyStr, keyLen=256, opts={}) {
    const {ivStr='', inputFormat='Base64'} = opts;
    const key = await importRawKey(parseKeyInput(keyStr, keyLen), 'AES-CTR', keyLen);
    const ivBuf = parseIVBytes(ivStr, 16);
    let counter, cipher;
    if (ivBuf) { counter=ivBuf; cipher=new Uint8Array(fromInputFormat(cipherStr,inputFormat)); }
    else { const d=new Uint8Array(fromInputFormat(cipherStr,inputFormat)); counter=d.slice(0,16); cipher=d.slice(16); }
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-CTR',counter,length:64}, key, cipher));
  }

  /* ── Generators ───────────────────────────────────────── */

  function generateKey(bits=256, format='hex') {
    const b = new Uint8Array(bits/8); crypto.getRandomValues(b);
    return format==='base64' ? Utils.bufToBase64(b.buffer) : Utils.bufToHex(b);
  }

  function generateIV(mode, format='hex') {
    const len = mode==='GCM' ? 12 : 16;
    const b = new Uint8Array(len); crypto.getRandomValues(b);
    return format==='base64' ? Utils.bufToBase64(b.buffer) : Utils.bufToHex(b);
  }

  /* ── UI ───────────────────────────────────────────────── */

  function init() {
    const encBtn = document.getElementById('aes-encrypt-btn');
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
    const ivInfo   = document.getElementById('aes-iv-info');
    const ivInfoVal= document.getElementById('aes-iv-info-val');
    const copyIV   = document.getElementById('aes-copy-iv');
    const modeNote = document.getElementById('aes-mode-note');

    Utils.bindCharCounter(inputEl, document.getElementById('aes-char-count'));

    function onModeChange() {
      const mode = modeEl.value;
      const ivHint = document.getElementById('aes-iv-hint');
      const isECB = mode === 'ECB';
      if (ivEl)  ivEl.disabled  = isECB;
      if (genIV) genIV.disabled = isECB;
      if (ivHint) ivHint.textContent = isECB
        ? 'ECB does not use IV'
        : mode==='GCM' ? 'GCM: 12 bytes (24 hex chars) — auto-generated if empty'
                       : 'CBC/CTR: 16 bytes (32 hex chars) — auto-generated if empty';
      if (modeNote) {
        if (mode==='CBC'||mode==='ECB') {
          modeNote.textContent = '✓ Compatible with anycript.com (CryptoJS)';
          modeNote.style.color = 'var(--green-text)';
        } else {
          modeNote.textContent = 'Web Crypto API — not interoperable with CryptoJS tools';
          modeNote.style.color = 'var(--text-muted)';
        }
      }
    }
    modeEl.addEventListener('change', onModeChange); onModeChange();

    genKey.addEventListener('click', () => {
      keyEl.value = generateKey(parseInt(bitsEl.value)||256, document.getElementById('aes-key-format')?.value||'hex');
      Utils.showToast('🔑 Key generated');
    });

    if (genIV) genIV.addEventListener('click', () => {
      ivEl.value = generateIV(modeEl.value, document.getElementById('aes-iv-format')?.value||'hex');
      Utils.showToast('🔀 IV generated');
    });

    encBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl,'Plaintext')||!Utils.requireField(keyEl,'Secret key')) return;
      Utils.setLoading(encBtn, true);
      if (ivInfo) ivInfo.style.display='none';
      try {
        const mode=modeEl.value, bits=parseInt(bitsEl.value)||256;
        const opts={ivStr:ivEl?.value||'', outputFormat:fmtEl?.value||'Base64'};
        let res;
        if      (mode==='GCM') res=await encryptGCM(inputEl.value,keyEl.value,bits,opts);
        else if (mode==='CBC') res=      encryptCBC(inputEl.value,keyEl.value,bits,opts);
        else if (mode==='ECB') res=      encryptECB(inputEl.value,keyEl.value,bits,opts);
        else if (mode==='CTR') res=await encryptCTR(inputEl.value,keyEl.value,bits,opts);
        Utils.setOutput(outBox, res.result, 'success');
        if (ivInfo && ivInfoVal && res.iv !== '(ECB — no IV)') {
          ivInfoVal.textContent = res.iv; ivInfo.style.display='block';
        }
      } catch(err) { Utils.setOutput(outBox,`Error: ${err.message}`,'error'); }
      Utils.setLoading(encBtn, false);
    });

    decBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl,'Ciphertext')||!Utils.requireField(keyEl,'Secret key')) return;
      Utils.setLoading(decBtn, true);
      try {
        const mode=modeEl.value, bits=parseInt(bitsEl.value)||256;
        const opts={ivStr:ivEl?.value||'', inputFormat:fmtEl?.value||'Base64'};
        let result;
        if      (mode==='GCM') result=await decryptGCM(inputEl.value,keyEl.value,bits,opts);
        else if (mode==='CBC') result=      decryptCBC(inputEl.value,keyEl.value,bits,opts);
        else if (mode==='ECB') result=      decryptECB(inputEl.value,keyEl.value,bits,opts);
        else if (mode==='CTR') result=await decryptCTR(inputEl.value,keyEl.value,bits,opts);
        Utils.setOutput(outBox, result, 'success');
      } catch(err) { Utils.setOutput(outBox,'Decryption failed — check key, IV, mode, and format.','error'); }
      Utils.setLoading(decBtn, false);
    });

    clearBtn.addEventListener('click', () => {
      inputEl.value=''; keyEl.value='';
      if(ivEl) ivEl.value='';
      if(ivInfo) ivInfo.style.display='none';
      outBox.classList.remove('output-box--success','output-box--error');
      outBox.innerHTML='<span class="placeholder">Output will appear here…</span>';
    });

    copyBtn.addEventListener('click', () => {
      const t=outBox.textContent.trim();
      if(t&&!t.includes('appear here')) Utils.copyToClipboard(t,'Output copied');
    });

    if(copyIV) copyIV.addEventListener('click', () => {
      const v=ivInfoVal?.textContent; if(v) Utils.copyToClipboard(v,'IV copied');
    });
  }

  return { init, encryptGCM, decryptGCM, encryptCBC, decryptCBC, encryptECB, decryptECB, encryptCTR, decryptCTR, generateKey, generateIV };

})();

document.addEventListener('DOMContentLoaded', () => { AESModule.init(); Utils.initNavbar(); });
window.AESModule = AESModule;
