/**
 * theme.js — Multi-theme picker (Light / Dark / Ocean / Ocean Light / Forest / Forest Light)
 */
(function () {
  var KEY = 'cw-theme';
  var THEMES = [
    { name: 'light',        icon: '☀️', label: 'Light'         },
    { name: 'dark',         icon: '🌙', label: 'Dark'          },
    { name: 'ocean',        icon: '🌊', label: 'Ocean'         },
    { name: 'ocean-light',  icon: '🏖️', label: 'Ocean Light'  },
    { name: 'forest',       icon: '🌿', label: 'Forest'        },
    { name: 'forest-light', icon: '🌱', label: 'Forest Light'  },
  ];
  var VALID = THEMES.map(function(t) { return t.name; });

  function getTheme() {
    var t = localStorage.getItem(KEY);
    return VALID.indexOf(t) > -1 ? t : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    var info = THEMES.find(function(t) { return t.name === theme; }) || THEMES[0];
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      var icon  = btn.querySelector('.theme-toggle__icon');
      var label = btn.querySelector('.theme-toggle__label');
      if (icon)  icon.textContent  = info.icon;
      if (label) label.textContent = info.label;
    });
    // Mark active item in all open pickers
    document.querySelectorAll('.theme-picker__item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.theme === theme);
    });
  }

  // Exposed globally
  window.cwSetTheme = function(name) {
    applyTheme(name);
    // Close all menus
    document.querySelectorAll('.theme-picker__menu').forEach(function(m) {
      m.remove();
    });
  };

  // cwToggle kept for onclick="cwToggle()" compatibility — opens picker
  window.cwToggle = function(e) {
    var btn = (e && e.currentTarget) || document.querySelector('.theme-toggle');
    var picker = btn && btn.closest('.theme-picker');
    if (!picker) return;
    var existing = picker.querySelector('.theme-picker__menu');
    if (existing) { existing.remove(); return; }

    var menu = document.createElement('div');
    menu.className = 'theme-picker__menu';
    var cur = getTheme();
    THEMES.forEach(function(t) {
      var item = document.createElement('button');
      item.className = 'theme-picker__item' + (t.name === cur ? ' active' : '');
      item.dataset.theme = t.name;
      item.textContent = t.icon + ' ' + t.label;
      item.addEventListener('click', function(ev) {
        ev.stopPropagation();
        window.cwSetTheme(t.name);
      });
      menu.appendChild(item);
    });
    picker.appendChild(menu);

    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', function handler() {
        menu.remove();
        document.removeEventListener('click', handler);
      });
    }, 0);
  };

  // Wrap each .theme-toggle in .theme-picker and attach handler
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getTheme());

    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      // Wrap in .theme-picker if not already
      if (!btn.closest('.theme-picker')) {
        var wrapper = document.createElement('div');
        wrapper.className = 'theme-picker';
        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
      }
      // Replace inline onclick with proper handler
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.cwToggle(e);
      });
    });
  });

}());
