/** Gallery — opens a photo full-screen in a native <dialog> (Esc, click or the × button closes it). */
(function () {
  'use strict';

  var dialog = document.getElementById('lightbox');
  var image = document.getElementById('lightboxImg');
  var triggers = document.querySelectorAll('.g-btn');
  if (!dialog || !image || !triggers.length) return;

  function open(trigger) {
    var thumb = trigger.querySelector('img');
    image.src = trigger.getAttribute('data-full') || thumb.src;
    image.alt = thumb.alt;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener('click', function () { open(trigger); });
  });

  dialog.addEventListener('click', close);
  dialog.addEventListener('close', function () { image.removeAttribute('src'); });
})();
