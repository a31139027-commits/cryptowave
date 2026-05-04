/**
 * theme.js - multi-theme picker and shared visual polish.
 */
(function () {
  'use strict';

  var KEY = 'cw-theme';
  var THEMES = [
    { name: 'light',        icon: 'LT', label: 'Light' },
    { name: 'dark',         icon: 'DK', label: 'Dark' },
    { name: 'ocean',        icon: 'OC', label: 'Ocean' },
    { name: 'ocean-light',  icon: 'OL', label: 'Ocean Light' },
    { name: 'forest',       icon: 'FR', label: 'Forest' },
    { name: 'forest-light', icon: 'FL', label: 'Forest Light' },
  ];
  var VALID = THEMES.map(function (t) { return t.name; });

  var TOP_NAV_META = {
    home: ['HM', 'Home'],
    aes: ['CR', 'Crypto'],
    sha256: ['#', 'Hash'],
    encoding: ['EN', 'Encoding'],
    audio: ['ME', 'Media'],
    image: ['IM', 'Image'],
    password: ['TL', 'Tools'],
  };

  var LINK_META = {
    aes: ['AES', 'AES Encryption'],
    rsa: ['RSA', 'RSA Encryption'],
    des: ['DES', 'DES'],
    tripledes: ['3D', 'Triple DES'],
    sha256: ['SHA', 'SHA / MD5'],
    'hash#tab-hmac': ['HMAC', 'HMAC'],
    bcrypt: ['BC', 'Bcrypt'],
    encoding: ['B64', 'Base64'],
    'encoding#tab-hex': ['HEX', 'Hex'],
    'encoding#tab-url': ['URL', 'URL Encode'],
    'encoding#tab-html-ent': ['ENT', 'HTML Entities'],
    'encoding#tab-jwt': ['JWT', 'JWT Decoder'],
    audio: ['AUD', 'Audio Converter'],
    'audio-cut': ['CUT', 'Audio Cutter'],
    'audio-merge': ['MRG', 'Audio Merger'],
    'audio-volume': ['VOL', 'Audio Volume'],
    'audio-reverse': ['REV', 'Audio Reverse'],
    'audio-pitch': ['PIT', 'Audio Pitch'],
    video: ['VID', 'Video Converter'],
    'video-trim': ['TRM', 'Video Trimmer'],
    'video-merge': ['MRG', 'Video Merger'],
    'video-rotate': ['ROT', 'Video Rotate/Flip'],
    'video-speed': ['SPD', 'Video Speed'],
    'video-loop': ['LOOP', 'Video Loop'],
    'video-volume': ['VOL', 'Video Volume'],
    'video-crop': ['CROP', 'Video Crop'],
    image: ['CMP', 'Compress'],
    'image#convert': ['CVT', 'Convert Format'],
    'image#pdf': ['PDF', 'Image to PDF'],
    'image-webp': ['WEBP', 'Image to WebP'],
    password: ['PWD', 'Password Generator'],
    qrcode: ['QR', 'QR Code'],
    'date-diff': ['DATE', 'Date Difference'],
    age: ['AGE', 'Age Calculator'],
    'pdf-merge': ['PDF', 'PDF Merger'],
    'pdf-split': ['PDF', 'PDF Splitter'],
    'pdf-images': ['IMG', 'PDF to Images'],
    tts: ['TTS', 'Text to Speech'],
    'word-count': ['TXT', 'Word Counter'],
    'base-convert': ['123', 'Base Converter'],
    'color-convert': ['CLR', 'Color Converter'],
    'mp4-to-mp3': ['MP3', 'MP4 to MP3'],
  };

  function getTheme() {
    var t = localStorage.getItem(KEY);
    return VALID.indexOf(t) > -1 ? t : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    var info = THEMES.find(function (t) { return t.name === theme; }) || THEMES[0];
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      var icon = btn.querySelector('.theme-toggle__icon');
      var label = btn.querySelector('.theme-toggle__label');
      if (icon) icon.textContent = info.icon;
      if (label) label.textContent = info.label;
    });
    document.querySelectorAll('.theme-picker__item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.theme === theme);
    });
  }

  function normalizeHref(href) {
    var h = String(href || '').trim();
    h = h.replace(/^https?:\/\/[^/]+\//, '');
    h = h.replace(/^(\.\.\/)+/, '');
    h = h.replace(/^\.\//, '');
    h = h.replace(/^\//, '');
    h = h.replace(/^pages\//, '');
    h = h.replace(/\.html(?=$|#)/, '');
    return h || 'home';
  }

  function setIconLabel(el, token, label, withArrow) {
    if (!el || el.dataset.cwIconReady === 'true') return;
    el.textContent = '';

    var icon = document.createElement('span');
    icon.className = 'nav-icon';
    icon.textContent = token;
    el.appendChild(icon);
    el.appendChild(document.createTextNode(label));

    if (withArrow) {
      var arrow = document.createElement('span');
      arrow.className = 'dropdown__arrow';
      arrow.textContent = '\u25BE';
      el.appendChild(arrow);
    }
    el.dataset.cwIconReady = 'true';
  }

  function initNavIcons() {
    document.querySelectorAll('.navbar__nav a').forEach(function (a) {
      var key = normalizeHref(a.getAttribute('href'));
      var base = key.split('#')[0];
      var isTrigger = a.parentElement &&
        a.parentElement.classList.contains('dropdown') &&
        a.parentElement.firstElementChild === a;
      var meta = (isTrigger || base === 'home') ? TOP_NAV_META[base] : LINK_META[key];
      if (!meta) meta = LINK_META[base];
      if (meta) setIconLabel(a, meta[0], meta[1], isTrigger);
    });

    document.querySelectorAll('.dropdown__col-head').forEach(function (head) {
      var text = head.textContent.toLowerCase();
      if (text.indexOf('audio') !== -1) setIconLabel(head, 'AUD', 'Audio', false);
      if (text.indexOf('video') !== -1) setIconLabel(head, 'VID', 'Video', false);
    });
  }

  window.cwSetTheme = function (name) {
    applyTheme(name);
    document.querySelectorAll('.theme-picker__menu').forEach(function (m) {
      m.remove();
    });
  };

  window.cwToggle = function (e) {
    var btn = (e && e.currentTarget) || document.querySelector('.theme-toggle');
    var picker = btn && btn.closest('.theme-picker');
    if (!picker) return;
    var existing = picker.querySelector('.theme-picker__menu');
    if (existing) {
      existing.remove();
      return;
    }

    var menu = document.createElement('div');
    menu.className = 'theme-picker__menu';
    var cur = getTheme();
    THEMES.forEach(function (t) {
      var item = document.createElement('button');
      item.className = 'theme-picker__item' + (t.name === cur ? ' active' : '');
      item.dataset.theme = t.name;
      item.textContent = t.icon + ' ' + t.label;
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        window.cwSetTheme(t.name);
      });
      menu.appendChild(item);
    });
    picker.appendChild(menu);

    setTimeout(function () {
      document.addEventListener('click', function handler() {
        menu.remove();
        document.removeEventListener('click', handler);
      });
    }, 0);
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getTheme());
    initNavIcons();

    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      if (!btn.closest('.theme-picker')) {
        var wrapper = document.createElement('div');
        wrapper.className = 'theme-picker';
        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
      }
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.cwToggle(e);
      });
    });
  });
}());
