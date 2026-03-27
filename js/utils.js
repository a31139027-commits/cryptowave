/**
 * utils.js — Shared Utility Functions
 * CryptoWave Tools Suite
 */

'use strict';

const Utils = (() => {

  /** Copy text to clipboard, show toast */
  async function copyToClipboard(text, label = 'Copied!') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✓ ${label}`);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`✓ ${label}`);
    }
  }

  /** Show a brief toast notification */
  function showToast(msg, duration = 2400) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  /** Format bytes to human-readable string */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /** Sanitize HTML to prevent XSS */
  function sanitize(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /** Validate non-empty input, highlight field if empty */
  function requireField(inputEl, label) {
    const val = inputEl.value.trim();
    if (!val) {
      inputEl.style.borderColor = 'var(--orange)';
      setTimeout(() => inputEl.style.borderColor = '', 1500);
      showToast(`⚠ ${label} is required`);
      return false;
    }
    return true;
  }

  /** Set output box content with state */
  function setOutput(boxEl, content, state = 'default') {
    boxEl.classList.remove('output-box--success', 'output-box--error');
    if (state === 'success') boxEl.classList.add('output-box--success');
    if (state === 'error')   boxEl.classList.add('output-box--error');
    boxEl.textContent = content;
  }

  /** Download text as file */
  function downloadText(content, filename, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Download Uint8Array as file */
  function downloadBlob(data, filename, mime) {
    const blob = new Blob([data], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Debounce wrapper */
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  /** Update character counter */
  function bindCharCounter(inputEl, counterEl, max = null) {
    const update = () => {
      const n = inputEl.value.length;
      counterEl.textContent = max ? `${n} / ${max}` : `${n} chars`;
    };
    inputEl.addEventListener('input', update);
    update();
  }

  /** Toggle button loading state */
  function setLoading(btnEl, loading, originalText) {
    if (loading) {
      btnEl.dataset.orig = btnEl.innerHTML;
      btnEl.innerHTML = '<span class="spinner"></span> Processing…';
      btnEl.disabled = true;
    } else {
      btnEl.innerHTML = originalText || btnEl.dataset.orig || btnEl.innerHTML;
      btnEl.disabled = false;
    }
  }

  /** Initialize tabs */
  function initTabs(container) {
    const btns   = container.querySelectorAll('.tab-btn');
    const panels = container.querySelectorAll('.tab-panel');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = container.querySelector(`#${btn.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });
  }

  /** Navbar hamburger toggle */
  function initNavbar() {
    const hamburger = document.querySelector('.hamburger');
    const nav       = document.querySelector('.navbar__nav');
    if (hamburger && nav) {
      hamburger.addEventListener('click', () => nav.classList.toggle('open'));
    }
    // Mobile accordion: tap dropdown parent to expand/collapse
    document.querySelectorAll('.navbar__nav .dropdown > a').forEach(a => {
      a.addEventListener('click', e => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          const li = a.closest('.dropdown');
          const isOpen = li.classList.contains('mobile-open');
          document.querySelectorAll('.navbar__nav .dropdown').forEach(d => d.classList.remove('mobile-open'));
          if (!isOpen) li.classList.add('mobile-open');
        }
      });
    });
    // Active link — normalize both sides (strip .html and #fragment)
    const current = (window.location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
    document.querySelectorAll('.navbar__nav a').forEach(a => {
      const href = a.getAttribute('href').split('#')[0].replace(/\.html$/, '');
      if (href === current) {
        a.classList.add('active');
      }
    });
    // If a dropdown item is active, also activate the parent dropdown trigger
    document.querySelectorAll('.navbar__nav .dropdown').forEach(li => {
      if (li.querySelector('.dropdown__menu a.active')) {
        const trigger = li.querySelector(':scope > a');
        if (trigger) trigger.classList.add('active');
      }
    });
  }

  /** Generate cryptographically secure random bytes as hex */
  function randomHex(bytes = 16) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Convert ArrayBuffer to hex string */
  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Convert hex string to Uint8Array */
  function hexToBuf(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2)
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    return new Uint8Array(bytes);
  }

  /** Convert ArrayBuffer to Base64 */
  function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  /** Convert Base64 to ArrayBuffer */
  function base64ToBuf(b64) {
    try {
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    } catch {
      throw new Error('Invalid Base64 input');
    }
  }

  return {
    copyToClipboard, showToast, formatBytes, sanitize,
    requireField, setOutput, downloadText, downloadBlob,
    debounce, bindCharCounter, setLoading, initTabs, initNavbar,
    randomHex, bufToHex, hexToBuf, bufToBase64, base64ToBuf,
  };

})();

// Make globally available
window.Utils = Utils;
