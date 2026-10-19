/**
 * Small extras: a thin scroll-progress line along the top, and a gentle parallax on the
 * two big photos. Skipped for visitors who prefer reduced motion; `effects.extras: false`
 * in js/config.js turns it off.
 */
(function () {
  'use strict';

  var settings = (window.LAVISH_CONFIG && window.LAVISH_CONFIG.effects) || {};
  if (settings.extras === false) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var photos = Array.prototype.slice.call(document.querySelectorAll('.about-visual img, .exp-visual img'));
  var ticking = false;

  function update() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    bar.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);

    var vh = window.innerHeight;
    photos.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var offset = ((r.top + r.height / 2) - vh / 2) / vh;       // -1 … 1 around the middle of the screen
      img.style.setProperty('--py', (-offset * 22).toFixed(1) + 'px');
    });
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
