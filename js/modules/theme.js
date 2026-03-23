/**
 * theme.js — Dark / Light Theme Toggle
 * Persists preference to localStorage
 * Applies to all pages via shared script
 */

'use strict';

const ThemeModule = (() => {

  const STORAGE_KEY = 'cw-theme';
  const DARK  = 'dark';
  const LIGHT = 'light';

  function getPreferred() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    // Respect OS preference on first visit
    return window.matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK;
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    // Update all toggle buttons on the page
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.setAttribute('aria-label', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
      btn.querySelector('.theme-toggle__icon').textContent = theme === DARK ? '☀️' : '🌙';
      btn.querySelector('.theme-toggle__label').textContent = theme === DARK ? 'Light' : 'Dark';
    });
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || DARK;
    apply(current === DARK ? LIGHT : DARK);
  }

  function init() {
    // Apply saved/preferred theme immediately (before paint)
    apply(getPreferred());

    // Bind all toggle buttons
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
  }

  return { init, toggle, apply, getPreferred };

})();

// Run as early as possible to avoid flash
ThemeModule.init();
window.ThemeModule = ThemeModule;
