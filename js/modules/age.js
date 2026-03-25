'use strict';

(function () {

  /* ── Helpers ──────────────────────────────────────────── */

  function toDateObj(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }

  function calcAge(dob, asOf) {
    let years  = asOf.getFullYear() - dob.getFullYear();
    let months = asOf.getMonth()    - dob.getMonth();
    let days   = asOf.getDate()     - dob.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(asOf.getFullYear(), asOf.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) { years--; months += 12; }

    const totalDays = Math.floor((asOf - dob) / 86400000);
    const totalMonths = years * 12 + months;

    return { years, months, days, totalDays, totalMonths };
  }

  function nextBirthday(dob, asOf) {
    let next = new Date(asOf.getFullYear(), dob.getMonth(), dob.getDate());
    if (next <= asOf) next.setFullYear(next.getFullYear() + 1);

    // Handle Feb 29 → Mar 1 in non-leap years
    if (dob.getMonth() === 1 && dob.getDate() === 29) {
      const y = next.getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      if (!isLeap) next = new Date(y, 2, 1);
    }
    const daysUntil = Math.ceil((next - asOf) / 86400000);
    return { date: next, daysUntil };
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ── Render ───────────────────────────────────────────── */

  function renderAge(dobStr, asOfStr) {
    const dob  = toDateObj(dobStr);
    const asOf = toDateObj(asOfStr);

    if (asOf < dob) {
      document.getElementById('age-results-content').innerHTML =
        '<p class="placeholder-msg">⚠ The "As of" date is before the date of birth.</p>';
      return;
    }

    const { years, months, days, totalDays, totalMonths } = calcAge(dob, asOf);
    const { date: bdayDate, daysUntil } = nextBirthday(dob, asOf);

    const isBirthdayToday = daysUntil === 365 || daysUntil === 366;
    const birthdayMsg = isBirthdayToday
      ? '🎉 Happy Birthday!'
      : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until your next birthday`;

    document.getElementById('age-results-content').innerHTML = `
      <div class="results-grid">
        <div class="stat-card stat-card--highlight">
          <div class="stat-card__value">${years}</div>
          <div class="stat-card__label">Years Old</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${totalMonths.toLocaleString()}</div>
          <div class="stat-card__label">Total Months</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${totalDays.toLocaleString()}</div>
          <div class="stat-card__label">Days Lived</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${daysUntil}</div>
          <div class="stat-card__label">Days to Birthday</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div class="breakdown-row">
          <span class="breakdown-row__label">Exact age</span>
          <span class="breakdown-row__value">${years} yr${years !== 1 ? 's' : ''}, ${months} mo${months !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Date of birth</span>
          <span class="breakdown-row__value">${formatDate(dob)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Age calculated as of</span>
          <span class="breakdown-row__value">${formatDate(asOf)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Next birthday</span>
          <span class="breakdown-row__value">${formatDate(bdayDate)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Total weeks lived</span>
          <span class="breakdown-row__value">${Math.floor(totalDays / 7).toLocaleString()} weeks</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-row__label">Total hours lived</span>
          <span class="breakdown-row__value">${(totalDays * 24).toLocaleString()} hours</span>
        </div>
      </div>

      <div class="birthday-banner" style="margin-top:16px;">
        <div style="font-size:1.5rem;margin-bottom:4px;">🎂</div>
        <div class="countdown-display">${isBirthdayToday ? '🎉' : daysUntil}</div>
        <div style="font-size:0.875rem;color:var(--text-secondary);margin-top:4px;">${birthdayMsg}</div>
      </div>
    `;
  }

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    Utils.initNavbar();

    const dobEl   = document.getElementById('dob-input');
    const asOfEl  = document.getElementById('as-of-input');
    const calcBtn = document.getElementById('age-calc-btn');

    asOfEl.value = todayStr();
    asOfEl.max   = todayStr();

    calcBtn.addEventListener('click', () => {
      if (!dobEl.value) { Utils.showToast('⚠ Please enter your date of birth'); return; }
      if (!asOfEl.value) asOfEl.value = todayStr();
      renderAge(dobEl.value, asOfEl.value);
    });

    // Allow pressing Enter on dob input
    dobEl.addEventListener('keydown', e => { if (e.key === 'Enter') calcBtn.click(); });
  });

})();
