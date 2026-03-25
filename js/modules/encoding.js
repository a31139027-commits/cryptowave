/**
 * modules/encoding.js — Encoding / Decoding Module
 * Supports: Base64, Base64 URL-safe, Hex, URL encode, HTML entities, JWT decode
 * All processing is 100% client-side
 */

'use strict';

const EncodingModule = (() => {

  /* ── Base64 ───────────────────────────────────────────── */

  function base64Encode(text, urlSafe = false) {
    let b64 = btoa(unescape(encodeURIComponent(text)));
    if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return b64;
  }

  function base64Decode(b64) {
    // Normalize URL-safe variants
    let str = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (_) {
      return atob(str); // binary fallback
    }
  }

  /* ── Hex ──────────────────────────────────────────────── */

  function hexEncode(text) {
    return Array.from(new TextEncoder().encode(text))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexDecode(hex) {
    hex = hex.replace(/\s/g, '');
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2)
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  /* ── URL Encoding ─────────────────────────────────────── */

  function urlEncode(text) { return encodeURIComponent(text); }
  function urlDecode(text) {
    try { return decodeURIComponent(text); }
    catch (_) { return unescape(text); }
  }

  /* ── HTML Entities ────────────────────────────────────── */

  function htmlEncode(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
  }

  function htmlDecode(text) {
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
  }

  /* ── JWT Decode (no verify) ───────────────────────────── */

  function jwtDecode(token) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT — expected 3 parts separated by "."');
    const decode = part => {
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(atob(b64));
    };
    return {
      header:    decode(parts[0]),
      payload:   decode(parts[1]),
      signature: parts[2],
    };
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function initEncodingTab(prefix, encodeFn, decodeFn) {
    const encBtn  = document.getElementById(`${prefix}-encode-btn`);
    const decBtn  = document.getElementById(`${prefix}-decode-btn`);
    const inputEl = document.getElementById(`${prefix}-input`);
    const outBox  = document.getElementById(`${prefix}-output`);
    const copyBtn = document.getElementById(`${prefix}-copy`);
    const swapBtn = document.getElementById(`${prefix}-swap`);

    if (!encBtn) return;

    encBtn.addEventListener('click', () => {
      if (!Utils.requireField(inputEl, 'Input')) return;
      try {
        const extra = document.getElementById(`${prefix}-urlsafe`)?.checked;
        Utils.setOutput(outBox, encodeFn(inputEl.value, extra), 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
    });

    decBtn.addEventListener('click', () => {
      if (!Utils.requireField(inputEl, 'Input')) return;
      try {
        Utils.setOutput(outBox, decodeFn(inputEl.value), 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
    });

    if (copyBtn) copyBtn.addEventListener('click', () => Utils.copyToClipboard(outBox.textContent));
    if (swapBtn) swapBtn.addEventListener('click', () => {
      const tmp = inputEl.value;
      inputEl.value = outBox.textContent;
      Utils.setOutput(outBox, tmp, 'default');
    });
  }

  function initJWT() {
    const btn    = document.getElementById('jwt-decode-btn');
    const input  = document.getElementById('jwt-input');
    const outBox = document.getElementById('jwt-output');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (!Utils.requireField(input, 'JWT token')) return;
      try {
        const decoded = jwtDecode(input.value.trim());
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const html = `<div class="jwt-section"><span class="output-label">HEADER</span>\n${esc(JSON.stringify(decoded.header, null, 2))}\n\n<span class="output-label">PAYLOAD</span>\n${esc(JSON.stringify(decoded.payload, null, 2))}\n\n<span class="output-label">SIGNATURE (not verified)</span>\n${esc(decoded.signature)}</div>`;
        outBox.classList.add('output-box--success');
        outBox.innerHTML = html;
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
    });
  }

  function init() {
    if (!document.getElementById('b64-encode-btn') && !document.getElementById('hex-encode-btn')) return;
    Utils.initTabs(document.querySelector('.tabs-container') || document.body);
    initEncodingTab('b64',  base64Encode, base64Decode);
    initEncodingTab('hex',  hexEncode,    hexDecode);
    initEncodingTab('url',  urlEncode,    urlDecode);
    initEncodingTab('html', htmlEncode,   htmlDecode);
    initJWT();
  }

  return { init, base64Encode, base64Decode, hexEncode, hexDecode, urlEncode, urlDecode, htmlEncode, htmlDecode, jwtDecode };

})();

document.addEventListener('DOMContentLoaded', () => { EncodingModule.init(); Utils.initNavbar(); });
window.EncodingModule = EncodingModule;
