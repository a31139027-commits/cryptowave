/**
 * theme.js — Dark / Light Theme Toggle
 * Uses event delegation — works on all pages
 */

(function() {

  function getTheme() {
    var t = localStorage.getItem('cw-theme');
    return (t === 'light' || t === 'dark') ? t : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cw-theme', theme);

    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      var icon  = btns[i].querySelector('.theme-toggle__icon');
      var label = btns[i].querySelector('.theme-toggle__label');
      if (icon)  icon.textContent  = theme === 'dark' ? '☀️' : '🌙';
      if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Apply theme immediately
  applyTheme(getTheme());

  // Event delegation — click anywhere, check if it's the toggle button
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.theme-toggle');
    if (btn) toggleTheme();
  });

  // Re-sync icons after DOM fully loads
  document.addEventListener('DOMContentLoaded', function() {
    applyTheme(getTheme());
  });

  window.ThemeModule = { toggle: toggleTheme, apply: applyTheme };

})();
