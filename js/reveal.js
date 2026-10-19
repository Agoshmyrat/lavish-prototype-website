/**
 * Scroll animations:
 *   1. Elements marked data-reveal rise and fade in as they enter the screen (siblings stagger).
 *   2. The three numbers in the About section (4.8 / 490+ / 28) count up once they are visible.
 *
 * Safe by design: does nothing for visitors who prefer reduced motion; if this file fails to load,
 * the safety timer in <head> removes the `js` class after 3s and everything simply shows.
 * Switch off with `effects.reveal` / `effects.countUp` = false in js/config.js.
 */
(function () {
  'use strict';

  // Tells the safety timer in <head> that this script is running.
  window.LAVISH_REVEAL = true;

  var settings = (window.LAVISH_CONFIG && window.LAVISH_CONFIG.effects) || {};
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;

  /* ---------- 1. reveal on scroll ---------- */

  var targets = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  if (reduceMotion || settings.reveal === false || !canObserve) {
    root.classList.remove('js');                      // show everything straight away
  } else {
    // Siblings that reveal together are staggered: 0ms, 90ms, 180ms ... capped at 450ms.
    var seen = new Map();
    targets.forEach(function (el) {
      var index = seen.get(el.parentNode) || 0;
      seen.set(el.parentNode, index + 1);
      el.style.transitionDelay = Math.min(index * 90, 450) + 'ms';
    });

    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(function (el) { revealer.observe(el); });
  }

  /* ---------- 2. count-up numbers ---------- */

  var statRow = document.querySelector('.stat-row');
  if (!statRow || reduceMotion || settings.countUp === false || !canObserve) return;

  function countUp(el) {
    var original = el.textContent.trim();
    var match = original.match(/^(\d+(?:\.\d+)?)(.*)$/);   // "4.8" -> 4.8 + "", "490+" -> 490 + "+"
    if (!match) return;

    var end = parseFloat(match[1]);
    var decimals = (match[1].split('.')[1] || '').length;
    var suffix = match[2];
    var duration = 1500;

    el.style.minWidth = el.offsetWidth + 'px';             // stops neighbours shifting as the digits grow
    var begin = null;

    function step(now) {
      if (begin === null) begin = now;
      var p = Math.min((now - begin) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (end * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = original;                       // always finish on the exact original text
    }
    el.textContent = (0).toFixed(decimals) + suffix;
    requestAnimationFrame(step);
  }

  var counter = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    counter.disconnect();
    Array.prototype.forEach.call(statRow.querySelectorAll('.num'), countUp);
  }, { threshold: 0.6 });
  counter.observe(statRow);
})();
