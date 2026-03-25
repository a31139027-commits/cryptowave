'use strict';

(function () {

  /* ── Color math ───────────────────────────────────────── */

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    if (h.length === 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
    return null;
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100),
    };
  }

  function rgbToCmyk(r, g, b) {
    if (r === 0 && g === 0 && b === 0) return { c: 0, m: 0, y: 0, k: 100 };
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    return {
      c: Math.round((1 - r - k) / (1 - k) * 100),
      m: Math.round((1 - g - k) / (1 - k) * 100),
      y: Math.round((1 - b - k) / (1 - k) * 100),
      k: Math.round(k * 100),
    };
  }

  function isValidHex(s) {
    return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  /* ── UI update ────────────────────────────────────────── */

  let updating = false;

  function renderFromRgb(r, g, b) {
    if (updating) return;
    updating = true;

    r = clamp(Math.round(r), 0, 255);
    g = clamp(Math.round(g), 0, 255);
    b = clamp(Math.round(b), 0, 255);

    const hex  = rgbToHex(r, g, b);
    const hsl  = rgbToHsl(r, g, b);
    const hsv  = rgbToHsv(r, g, b);
    const cmyk = rgbToCmyk(r, g, b);

    // Inputs
    document.getElementById('cc-hex').value = hex;
    document.getElementById('cc-r').value = r;
    document.getElementById('cc-g').value = g;
    document.getElementById('cc-b').value = b;
    document.getElementById('cc-h').value = hsl.h;
    document.getElementById('cc-s').value = hsl.s;
    document.getElementById('cc-l').value = hsl.l;

    // Swatch
    const swatch = document.getElementById('cc-swatch');
    swatch.style.background = hex;
    swatch.style.borderColor = hsl.l > 85 ? '#ccc' : hex;

    // Details
    document.getElementById('cc-detail-hex').textContent  = hex;
    document.getElementById('cc-detail-rgb').textContent  = `rgb(${r}, ${g}, ${b})`;
    document.getElementById('cc-detail-hsl').textContent  = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    document.getElementById('cc-detail-hsv').textContent  = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`;
    document.getElementById('cc-detail-cmyk').textContent = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

    // Hue slider background
    document.getElementById('cc-h').style.setProperty('--hue', hsl.h);

    updating = false;
  }

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const hexEl = document.getElementById('cc-hex');
    const rEl   = document.getElementById('cc-r');
    const gEl   = document.getElementById('cc-g');
    const bEl   = document.getElementById('cc-b');
    const hEl   = document.getElementById('cc-h');
    const sEl   = document.getElementById('cc-s');
    const lEl   = document.getElementById('cc-l');
    const picker = document.getElementById('cc-picker');

    // HEX input
    hexEl.addEventListener('input', () => {
      const val = hexEl.value.trim();
      if (isValidHex(val)) {
        const rgb = hexToRgb(val);
        if (rgb) renderFromRgb(rgb.r, rgb.g, rgb.b);
      }
    });

    // RGB inputs
    [rEl, gEl, bEl].forEach(el => {
      el.addEventListener('input', () => {
        const r = parseInt(rEl.value) || 0;
        const g = parseInt(gEl.value) || 0;
        const b = parseInt(bEl.value) || 0;
        renderFromRgb(r, g, b);
      });
    });

    // HSL inputs
    [hEl, sEl, lEl].forEach(el => {
      el.addEventListener('input', () => {
        const h = parseInt(hEl.value) || 0;
        const s = parseInt(sEl.value) || 0;
        const l = parseInt(lEl.value) || 0;
        const rgb = hslToRgb(h, s, l);
        renderFromRgb(rgb.r, rgb.g, rgb.b);
      });
    });

    // Native color picker
    picker.addEventListener('input', () => {
      const rgb = hexToRgb(picker.value);
      if (rgb) renderFromRgb(rgb.r, rgb.g, rgb.b);
    });

    // Copy buttons
    document.querySelectorAll('.cc-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.copy;
        const text = document.getElementById(targetId).textContent;
        navigator.clipboard.writeText(text)
          .then(() => Utils.showToast('✅ Copied: ' + text))
          .catch(() => Utils.showToast('❌ Copy failed'));
      });
    });

    // Example swatches
    document.querySelectorAll('.cc-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const rgb = hexToRgb(btn.dataset.hex);
        if (rgb) {
          renderFromRgb(rgb.r, rgb.g, rgb.b);
          picker.value = btn.dataset.hex;
        }
      });
    });

    // Default: CryptoWave accent blue
    const defaultRgb = hexToRgb('#6366F1');
    renderFromRgb(defaultRgb.r, defaultRgb.g, defaultRgb.b);
    picker.value = '#6366F1';
  });

})();
