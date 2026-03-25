'use strict';

(function () {

  const BASES = [
    { id: 'bc-bin', base: 2,  label: 'Binary',      prefix: '0b', pattern: /^-?[01]*$/ },
    { id: 'bc-oct', base: 8,  label: 'Octal',       prefix: '0o', pattern: /^-?[0-7]*$/ },
    { id: 'bc-dec', base: 10, label: 'Decimal',     prefix: '',   pattern: /^-?[0-9]*$/ },
    { id: 'bc-hex', base: 16, label: 'Hexadecimal', prefix: '0x', pattern: /^-?[0-9a-fA-F]*$/ },
  ];

  let updating = false;

  function convert(valueStr, fromBase) {
    if (!valueStr || valueStr === '-') return null;
    const negative = valueStr.startsWith('-');
    const digits = negative ? valueStr.slice(1) : valueStr;
    if (!digits) return null;

    const decimal = parseInt(digits, fromBase);
    if (isNaN(decimal)) return null;

    return negative ? -decimal : decimal;
  }

  function toBaseStr(num, toBase) {
    if (num === null || num === undefined) return '';
    const negative = num < 0;
    const abs = Math.abs(num);
    const str = abs.toString(toBase).toUpperCase();
    return negative ? '-' + str : str;
  }

  function updateAll(sourceId, valueStr) {
    if (updating) return;
    updating = true;

    const source = BASES.find(b => b.id === sourceId);
    const decimal = convert(valueStr, source.base);

    for (const b of BASES) {
      if (b.id === sourceId) continue;
      const el = document.getElementById(b.id);
      if (decimal === null) {
        el.value = '';
      } else {
        el.value = toBaseStr(decimal, b.base);
      }
    }

    // Update info row
    updateInfo(decimal);

    updating = false;
  }

  function updateInfo(decimal) {
    const infoEl = document.getElementById('bc-info');
    if (decimal === null || decimal === undefined) {
      infoEl.innerHTML = '';
      return;
    }
    const abs = Math.abs(decimal);
    const bits = abs === 0 ? 1 : Math.floor(Math.log2(abs)) + 1;
    infoEl.innerHTML = `
      <div class="breakdown-row">
        <span class="breakdown-row__label">Decimal value</span>
        <span class="breakdown-row__value">${decimal.toLocaleString()}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-row__label">Bits needed</span>
        <span class="breakdown-row__value">${bits} bit${bits !== 1 ? 's' : ''}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-row__label">Hex (with prefix)</span>
        <span class="breakdown-row__value">${decimal < 0 ? '-' : ''}0x${Math.abs(decimal).toString(16).toUpperCase()}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-row__label">Binary (with prefix)</span>
        <span class="breakdown-row__value">${decimal < 0 ? '-' : ''}0b${Math.abs(decimal).toString(2)}</span>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    for (const b of BASES) {
      const el = document.getElementById(b.id);

      el.addEventListener('input', () => {
        const val = el.value.trim();
        // Validate: only allow valid chars for this base
        if (val !== '' && val !== '-' && !b.pattern.test(val)) {
          // Strip invalid chars
          el.value = el.value.replace(new RegExp(`[^${b.base === 16 ? '0-9a-fA-F\\-' : b.base === 2 ? '01\\-' : b.base === 8 ? '0-7\\-' : '0-9\\-'}]`, 'g'), '');
        }
        updateAll(b.id, el.value.trim().toUpperCase());
      });

      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') el.blur();
      });
    }

    document.getElementById('bc-clear-btn').addEventListener('click', () => {
      for (const b of BASES) document.getElementById(b.id).value = '';
      document.getElementById('bc-info').innerHTML = '';
    });

    // Swap / example buttons
    document.querySelectorAll('.bc-example-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        const decEl = document.getElementById('bc-dec');
        decEl.value = val;
        updateAll('bc-dec', val);
      });
    });
  });

})();
