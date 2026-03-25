'use strict';

(function () {

  /* ── Helpers ──────────────────────────────────────────── */

  function toDateObj(str) {
    // Parse YYYY-MM-DD without timezone shift
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function diffCalendar(start, end) {
    // Detailed breakdown: years, months, days
    let y = end.getFullYear() - start.getFullYear();
    let m = end.getMonth()    - start.getMonth();
    let d = end.getDate()     - start.getDate();

    if (d < 0) {
      m--;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      d += prevMonth.getDate();
    }
    if (m < 0) { y--; m += 12; }
    return { years: y, months: m, days: d };
  }

  function countBusinessDays(start, end) {
    let count = 0;
    const cur = new Date(start);
    while (cur < end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ── Render ───────────────────────────────────────────── */

  function renderResults(startStr, endStr) {
    let start = toDateObj(startStr);
    let end   = toDateObj(endStr);
    let swapped = false;

    if (end < start) { [start, end] = [end, start]; swapped = true; }

    const totalMs   = end - start;
    const totalDays = Math.round(totalMs / 86400000);
    const totalWeeks = Math.floor(totalDays / 7);
    const remDays    = totalDays % 7;
    const bizDays    = countBusinessDays(start, end);
    const { years, months, days } = diffCalendar(start, end);

    const container = document.getElementById('results-content');

    container.innerHTML = `
      <p style="text-align:center;font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">
        ${swapped ? '⚠ Dates were swapped — showing positive difference.' : ''}
        <strong style="color:var(--text-primary);">${formatDate(start)}</strong>
        &nbsp;→&nbsp;
        <strong style="color:var(--text-primary);">${formatDate(end)}</strong>
      </p>

      <div class="results-grid">
        <div class="stat-card">
          <div class="stat-card__value">${totalDays.toLocaleString()}</div>
          <div class="stat-card__label">Total Days</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${totalWeeks.toLocaleString()}</div>
          <div class="stat-card__label">Full Weeks</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${bizDays.toLocaleString()}</div>
          <div class="stat-card__label">Business Days</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${(totalDays / 30.44).toFixed(1)}</div>
          <div class="stat-card__label">Approx Months</div>
        </div>
      </div>

      <div style="margin-top:20px;">
        <div class="breakdown-row">
          <span class="breakdown-row__label">Detailed breakdown</span>
          <span class="breakdown-row__value">${years}y ${months}m ${days}d</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Weeks + remaining days</span>
          <span class="breakdown-row__value">${totalWeeks} weeks${remDays ? ` + ${remDays} day${remDays > 1 ? 's' : ''}` : ''}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Total hours</span>
          <span class="breakdown-row__value">${(totalDays * 24).toLocaleString()} hours</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Weekend days</span>
          <span class="breakdown-row__value">${(totalDays - bizDays).toLocaleString()} days</span>
        </div>
      </div>
    `;
  }

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const startEl  = document.getElementById('date-start');
    const endEl    = document.getElementById('date-end');
    const calcBtn  = document.getElementById('calc-btn');
    const swapBtn  = document.getElementById('swap-btn');
    const startTod = document.getElementById('start-today-btn');
    const endTod   = document.getElementById('end-today-btn');

    // Default: today − 30 days → today
    const today = todayStr();
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const thirtyAgoStr = thirtyAgo.toISOString().split('T')[0];

    startEl.value = thirtyAgoStr;
    endEl.value   = today;

    startTod.addEventListener('click', () => { startEl.value = todayStr(); });
    endTod.addEventListener('click',   () => { endEl.value   = todayStr(); });

    swapBtn.addEventListener('click', () => {
      [startEl.value, endEl.value] = [endEl.value, startEl.value];
    });

    function calculate() {
      if (!startEl.value || !endEl.value) {
        Utils.showToast('⚠ Please select both dates');
        return;
      }
      if (startEl.value === endEl.value) {
        document.getElementById('results-content').innerHTML =
          '<p class="placeholder-msg">The two dates are the same — difference is 0 days.</p>';
        return;
      }
      renderResults(startEl.value, endEl.value);
    }

    calcBtn.addEventListener('click', calculate);

    // Auto-calculate on load with defaults
    calculate();
  });

})();
