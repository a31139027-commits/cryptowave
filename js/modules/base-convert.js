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
    const digits = (negative ? valueStr.slice(1) : valueStr).toLowerCase();
    if (!digits) return null;

    try {
      const base = BigInt(fromBase);
      let result = 0n;
      for (const ch of digits) {
        const d = BigInt(parseInt(ch, fromBase));
        if (d >= base) return null;
        result = result * base + d;
      }
      return negative ? -result : result;
    } catch {
      return null;
    }
  }

  function toBaseStr(num, toBase) {
    if (num === null || num === undefined) return '';
    const negative = num < 0n;
    const abs = negative ? -num : num;
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
    const neg = decimal < 0n;
    const abs = neg ? -decimal : decimal;
    const binStr = abs.toString(2);
    const bits = binStr.length;
    infoEl.innerHTML = `
      <div class="breakdown-row">
        <span class="breakdown-row__label">Decimal value</span>
        <span class="breakdown-row__value">${decimal.toString()}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-row__label">Bits needed</span>
        <span class="breakdown-row__value">${bits} bit${bits !== 1 ? 's' : ''}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-row__label">Hex (with prefix)</span>
        <span class="breakdown-row__value">${neg ? '-' : ''}0x${abs.toString(16).toUpperCase()}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-row__label">Binary (with prefix)</span>
        <span class="breakdown-row__value">${neg ? '-' : ''}0b${binStr}</span>
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
