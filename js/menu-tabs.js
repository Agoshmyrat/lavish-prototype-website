/**
 * Menu tabs — shows one menu panel at a time.
 * Follows the WAI-ARIA tabs pattern: click, or use Arrow keys / Home / End.
 */
(function () {
  'use strict';

  var tablist = document.querySelector('.menu-supertabs');
  if (!tablist) return;

  var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function select(tab, options) {
    tabs.forEach(function (t) {
      var active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (options && options.focus) tab.focus();
    if (options && options.scroll) {
      document.getElementById('menu').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      select(tab, { scroll: true });
    });

    tab.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      select(next, { focus: true });
    });
  });
})();
