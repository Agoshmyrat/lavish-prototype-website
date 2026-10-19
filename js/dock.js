/**
 * Dock effect for the social icons (Instagram, Tripadvisor, Facebook) in the header:
 * the icon under the pointer grows, and its neighbours grow a little less, like the Mac Dock.
 * Mouse and trackpad only; skipped for visitors who prefer reduced motion.
 */
(function () {
  'use strict';

  var bar = document.querySelector('.nav-social');
  if (!bar) return;
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var icons = Array.prototype.slice.call(bar.querySelectorAll('a'));
  var MAX = 1.9;        // size of the icon right under the pointer (1 = normal)
  var REACH = 70;       // how far (px) the effect reaches to the sides
  var state = icons.map(function () { return { s: 1, target: 1 }; });
  var pointerX = null, raf = 0;

  function aim() {
    icons.forEach(function (a, i) {
      var r = a.getBoundingClientRect();
      var centre = r.left + r.width / 2 - (state[i].s - 1) * 0;   // layout centre is unaffected by scale
      var d = pointerX === null ? REACH * 3 : Math.abs(pointerX - centre);
      var k = Math.exp(-Math.pow(d / (REACH * 0.55), 2));          // bell curve around the pointer
      state[i].target = 1 + (MAX - 1) * k;
    });
  }

  function tick() {
    var moving = false;
    icons.forEach(function (a, i) {
      var st = state[i];
      st.s += (st.target - st.s) * 0.22;
      if (Math.abs(st.target - st.s) > 0.002) moving = true; else st.s = st.target;
      var lift = (st.s - 1) * 5;                                   // grows slightly downward, away from the page edge
      a.style.transform = st.s === 1 ? '' : 'translateY(' + lift.toFixed(1) + 'px) scale(' + st.s.toFixed(3) + ')';
      a.style.zIndex = st.s > 1.05 ? '2' : '';
    });
    raf = moving ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  bar.addEventListener('mousemove', function (e) { pointerX = e.clientX; aim(); kick(); });
  bar.addEventListener('mouseenter', function (e) { pointerX = e.clientX; aim(); kick(); });
  bar.addEventListener('mouseleave', function () { pointerX = null; aim(); kick(); });
})();
