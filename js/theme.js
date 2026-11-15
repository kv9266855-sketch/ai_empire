/* Theme bootstrap. Loaded synchronously in <head> so the right palette paints first.
   Priority: visitor's saved choice → owner's public theme (FastAPI runtime) → winter. */
(function () {
  'use strict';
  var KEY = 'empire-theme', THEMES = ['winter', 'classic'];
  var COLORS = { winter: '#fafbff', classic: '#f6f2ef' };
  var runtime = window.SITE_RUNTIME || { api: false, theme: 'winter' };
  function stored() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function valid(t) { return THEMES.indexOf(t) > -1; }
  var current = valid(stored()) ? stored() : valid(runtime.theme) ? runtime.theme : 'winter';
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[theme]);
  }
  apply(current);
  window.Theme = {
    list: THEMES,
    get: function () { return current; },
    set: function (theme) {
      if (!valid(theme) || theme === current) return;
      current = theme; apply(theme);
      try { localStorage.setItem(KEY, theme); } catch (_) { /* private mode: session only */ }
      document.dispatchEvent(new CustomEvent('site:theme', { detail: { theme: theme } }));
    }
  };
  document.addEventListener('DOMContentLoaded', function () { apply(current); });
})();
