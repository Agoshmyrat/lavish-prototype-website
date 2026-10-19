/** Header — adds a solid background once the page has been scrolled. */
(function () {
  'use strict';

  var header = document.getElementById('siteHeader');
  if (!header) return;

  function update() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
})();
