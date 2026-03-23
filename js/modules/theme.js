/**
 * theme.js — Dark / Light Theme Toggle
 */
(function () {
  var DARK = 'dark', LIGHT = 'light', KEY = 'cw-theme';

  function getTheme() {
    var t = localStorage.getItem(KEY);
    return t === LIGHT ? LIGHT : DARK; // default = dark
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    syncButtons(theme);
  }

  function syncButtons(theme) {
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      var icon  = btns[i].querySelector('.theme-toggle__icon');
      var label = btns[i].querySelector('.theme-toggle__label');
      if (icon)  icon.textContent  = theme === DARK ? '☀️' : '🌙';
      if (label) label.textContent = theme === DARK ? 'Light' : 'Dark';
    }
  }

  function toggle() {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === DARK ? LIGHT : DARK);
  }

  // ── Bind buttons ──────────────────────────────────────────
  // Use event delegation on document — works regardless of load order
  document.addEventListener('click', function (e) {
    // Walk up from click target to find .theme-toggle
    var el = e.target;
    while (el && el !== document) {
      if (el.classList && el.classList.contains('theme-toggle')) {
        toggle();
        return;
      }
      el = el.parentNode;
    }
  });

  // Apply immediately + sync icons when DOM ready
  applyTheme(getTheme());
  document.addEventListener('DOMContentLoaded', function () {
    syncButtons(getTheme());
  });

  window.ThemeModule = { toggle: toggle, apply: applyTheme };
}());
