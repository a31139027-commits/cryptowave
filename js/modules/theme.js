/**
 * theme.js — Theme Toggle (Global function approach)
 */
(function () {
  var KEY = 'cw-theme';

  function getTheme() {
    var t = localStorage.getItem(KEY);
    return t === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      var icon  = btns[i].querySelector('.theme-toggle__icon');
      var label = btns[i].querySelector('.theme-toggle__label');
      if (icon)  icon.textContent  = theme === 'dark' ? '☀️' : '🌙';
      if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
    }
  }

  // Expose globally so onclick="cwToggle()" works
  window.cwToggle = function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  // Apply on load
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getTheme());
  });

}());
