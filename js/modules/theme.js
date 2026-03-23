/**
 * theme.js — Dark / Light Theme Toggle
 * Persists preference to localStorage
 */

'use strict';

const STORAGE_KEY = 'cw-theme';

function getTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // First visit: default to DARK regardless of OS
  return 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    var icon  = btn.querySelector('.theme-toggle__icon');
    var label = btn.querySelector('.theme-toggle__label');
    if (theme === 'dark') {
      if (icon)  icon.textContent  = '☀️';
      if (label) label.textContent = 'Light';
      btn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      if (icon)  icon.textContent  = '🌙';
      if (label) label.textContent = 'Dark';
      btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  });
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Apply immediately on script load (prevents flash)
applyTheme(getTheme());

// Bind buttons after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    btn.addEventListener('click', toggleTheme);
  });
  // Re-apply to update button icons after DOM loads
  applyTheme(getTheme());
});

window.ThemeModule = { toggle: toggleTheme, apply: applyTheme, getTheme: getTheme };
