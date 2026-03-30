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
    // Track recently used tool
    const activeToolLink = document.querySelector('.navbar__nav .dropdown__menu a.active');
    if (activeToolLink) {
      const icon = activeToolLink.textContent.trim().split(' ')[0]; // first emoji
      const name = activeToolLink.textContent.trim().replace(/^.\s/, ''); // rest after emoji
      const href = activeToolLink.getAttribute('href').split('#')[0];
      try {
        const metaDesc = document.querySelector('meta[name="description"]');
        const desc = metaDesc ? metaDesc.content.slice(0, 120) : '';
        const rootHref = window.location.pathname.includes('/pages/') ? 'pages/' + href : href;
        const entry = { name, icon, href: rootHref, desc, ts: Date.now() };
        const recent = JSON.parse(localStorage.getItem('cw-recent2') || '[]');
        const filtered = recent.filter(r => r.href !== entry.href);
        filtered.unshift(entry);
        localStorage.setItem('cw-recent2', JSON.stringify(filtered.slice(0, 6)));
      } catch (_) {}
    }
  }

  /** Back-to-top button */
  function initBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('back-to-top--visible', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  /** Send a GA4 event if gtag is available */
  function trackEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
      gtag('event', eventName, params);
    }
  }

  /** Auto-track primary action button clicks across all tool pages */
  function initAnalytics() {
    const page = window.location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('button[id]');
      if (!btn) return;
      const cls = btn.classList;
      if (!cls.contains('btn--primary') && !cls.contains('btn--ghost')) return;
      trackEvent('tool_used', {
        tool_page: page,
        button_id: btn.id,
        button_label: btn.textContent.trim().slice(0, 50),
      });
    });
  }

  /** Inject related tools section before footer */
  function initRelatedTools() {
    var RELATED = {
      'aes':           [['🔑 DES Encryption','des.html'],['🔐 3DES Encryption','tripledes.html'],['🔒 RSA Encryption','rsa.html'],['# Hash Generator','hash.html']],
      'des':           [['🔐 AES Encryption','aes.html'],['🔐 3DES Encryption','tripledes.html'],['🔒 RSA Encryption','rsa.html'],['# Hash Generator','hash.html']],
      'tripledes':     [['🔐 AES Encryption','aes.html'],['🔑 DES Encryption','des.html'],['🔒 RSA Encryption','rsa.html'],['# Hash Generator','hash.html']],
      'rsa':           [['🔐 AES Encryption','aes.html'],['🔑 DES Encryption','des.html'],['# Hash Generator','hash.html'],['🔑 Password Gen','password.html']],
      'hash':          [['🔐 AES Encryption','aes.html'],['🔒 RSA Encryption','rsa.html'],['⇌ Encoding','encoding.html'],['🔑 Password Gen','password.html']],
      'encoding':      [['# Hash Generator','hash.html'],['🔐 AES Encryption','aes.html'],['⬡ Base Convert','base-convert.html'],['🔑 Password Gen','password.html']],
      'password':      [['🔐 AES Encryption','aes.html'],['# Hash Generator','hash.html'],['⊞ QR Code','qrcode.html'],['🔒 RSA Encryption','rsa.html']],
      'qrcode':        [['🔑 Password Gen','password.html'],['🖼 Image Compress','image.html'],['⇌ Encoding','encoding.html']],
      'age':           [['📅 Date Diff','date-diff.html'],['📝 Word Count','word-count.html']],
      'date-diff':     [['🎂 Age Calc','age.html'],['📝 Word Count','word-count.html']],
      'base-convert':  [['⇌ Encoding','encoding.html'],['# Hash Generator','hash.html'],['🔐 AES Encryption','aes.html']],
      'color-convert': [['🖼 Image Compress','image.html'],['⊞ QR Code','qrcode.html'],['⇌ Encoding','encoding.html']],
      'word-count':    [['⇌ Encoding','encoding.html'],['📅 Date Diff','date-diff.html'],['🗣 TTS','tts.html']],
      'image':         [['🌐 Image to WebP','image-webp.html'],['📄 PDF Merge','pdf-merge.html'],['⊞ QR Code','qrcode.html']],
      'image-webp':    [['🖼 Image Compress','image.html'],['📄 PDF Merge','pdf-merge.html'],['⊞ QR Code','qrcode.html']],
      'audio':         [['✂ Audio Cutter','audio-cut.html'],['🔀 Audio Merge','audio-merge.html'],['🎵 MP4 to MP3','mp4-to-mp3.html'],['🔊 Volume Adjust','audio-volume.html']],
      'audio-cut':     [['🔀 Audio Merge','audio-merge.html'],['🔊 Volume Adjust','audio-volume.html'],['⏪ Audio Reverse','audio-reverse.html'],['🎵 MP4 to MP3','mp4-to-mp3.html']],
      'audio-merge':   [['✂ Audio Cutter','audio-cut.html'],['🔊 Volume Adjust','audio-volume.html'],['🎵 MP4 to MP3','mp4-to-mp3.html']],
      'audio-pitch':   [['✂ Audio Cutter','audio-cut.html'],['⏪ Audio Reverse','audio-reverse.html'],['🔊 Volume Adjust','audio-volume.html']],
      'audio-reverse': [['✂ Audio Cutter','audio-cut.html'],['🎚 Pitch Shift','audio-pitch.html'],['🔊 Volume Adjust','audio-volume.html']],
      'audio-volume':  [['✂ Audio Cutter','audio-cut.html'],['🔀 Audio Merge','audio-merge.html'],['🎵 MP4 to MP3','mp4-to-mp3.html']],
      'mp4-to-mp3':    [['✂ Audio Cutter','audio-cut.html'],['🔊 Volume Adjust','audio-volume.html'],['🎬 Video Converter','video.html']],
      'tts':           [['✂ Audio Cutter','audio-cut.html'],['🎵 MP4 to MP3','mp4-to-mp3.html'],['📝 Word Count','word-count.html']],
      'video':         [['✂ Video Trim','video-trim.html'],['🔄 Video Rotate','video-rotate.html'],['⚡ Video Speed','video-speed.html'],['🎵 MP4 to MP3','mp4-to-mp3.html']],
      'video-trim':    [['🔄 Video Rotate','video-rotate.html'],['⚡ Video Speed','video-speed.html'],['🔀 Video Merge','video-merge.html'],['🎵 MP4 to MP3','mp4-to-mp3.html']],
      'video-rotate':  [['✂ Video Trim','video-trim.html'],['⚡ Video Speed','video-speed.html'],['✂ Video Crop','video-crop.html']],
      'video-merge':   [['✂ Video Trim','video-trim.html'],['⚡ Video Speed','video-speed.html'],['🔁 Video Loop','video-loop.html']],
      'video-speed':   [['✂ Video Trim','video-trim.html'],['🔄 Video Rotate','video-rotate.html'],['🔁 Video Loop','video-loop.html']],
      'video-loop':    [['✂ Video Trim','video-trim.html'],['🔀 Video Merge','video-merge.html'],['⚡ Video Speed','video-speed.html']],
      'video-crop':    [['🔄 Video Rotate','video-rotate.html'],['✂ Video Trim','video-trim.html'],['🖼 Image Compress','image.html']],
      'video-volume':  [['✂ Video Trim','video-trim.html'],['🔊 Audio Volume','audio-volume.html'],['🎵 MP4 to MP3','mp4-to-mp3.html']],
      'pdf-merge':     [['✂ PDF Split','pdf-split.html'],['🖼 PDF to Images','pdf-images.html'],['🖼 Image Compress','image.html']],
      'pdf-split':     [['📄 PDF Merge','pdf-merge.html'],['🖼 PDF to Images','pdf-images.html'],['🖼 Image Compress','image.html']],
      'pdf-images':    [['📄 PDF Merge','pdf-merge.html'],['✂ PDF Split','pdf-split.html'],['🖼 Image Compress','image.html']],
    };
    var page = (window.location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var tools = RELATED[page];
    if (!tools || !tools.length) return;
    var footer = document.querySelector('footer');
    if (!footer) return;
    var sec = document.createElement('section');
    sec.className = 'related-tools';
    var html = '<div class="container"><p class="related-tools__label">Related Tools</p><div class="related-tools__grid">';
    tools.forEach(function(t) {
      html += '<a href="' + t[1] + '" class="related-tools__item">' + t[0] + '</a>';
    });
    html += '</div></div>';
    sec.innerHTML = html;
    footer.before(sec);
  }

  // Init back-to-top on every page
  document.addEventListener('DOMContentLoaded', initBackToTop);
  document.addEventListener('DOMContentLoaded', initAnalytics);
  document.addEventListener('DOMContentLoaded', initRelatedTools);

  return {
    copyToClipboard, showToast, formatBytes, sanitize,
    requireField, setOutput, downloadText, downloadBlob,
    debounce, bindCharCounter, setLoading, initTabs, initNavbar,
    randomHex, bufToHex, hexToBuf, bufToBase64, base64ToBuf,
  };

})();

// Make globally available
window.Utils = Utils;
