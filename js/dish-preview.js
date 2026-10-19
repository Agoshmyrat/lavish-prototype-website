/**
 * Menu photo preview — rest the mouse on a dish for half a second and a photo card appears
 * beside the pointer; move away and it fades. Photos come from `dishPhotos` in js/config.js.
 * Only runs on devices with a real hover (mouse / trackpad).
 */
(function () {
  'use strict';

  var cfg = (window.LAVISH_CONFIG && window.LAVISH_CONFIG.dishPhotos) || null;
  if (!cfg) return;
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var DELAY = typeof cfg.delayMs === 'number' ? cfg.delayMs : 500;
  var card = document.createElement('figure');
  card.className = 'dish-preview';
  card.setAttribute('aria-hidden', 'true');
  var img = document.createElement('img');
  img.alt = '';
  var cap = document.createElement('figcaption');
  var nameEl = document.createElement('b');
  nameEl.style.fontWeight = '500';
  var priceEl = document.createElement('span');
  cap.appendChild(nameEl); cap.appendChild(priceEl);
  card.appendChild(img); card.appendChild(cap);
  document.body.appendChild(card);

  var timer = 0, current = null, mx = 0, my = 0;

  function dishName(dish) {
    var h = dish.querySelector('h3');
    if (!h) return '';
    var clone = h.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('.chef-hat, .new-tag'), function (n) { n.remove(); });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function photoFor(name) {
    var key = name.toLowerCase();
    if (cfg.byDish && cfg.byDish[key]) return cfg.byDish[key];
    var list = cfg.byKeyword || [];
    for (var i = 0; i < list.length; i++) if (key.indexOf(list[i][0]) !== -1) return list[i][1];
    return cfg.fallback || '';
  }

  function place() {
    var w = card.offsetWidth || 260, h = card.offsetHeight || 220;
    var x = mx + 26, y = my - h / 2;
    if (x + w > window.innerWidth - 12) x = mx - w - 26;
    y = Math.max(12, Math.min(y, window.innerHeight - h - 12));
    card.style.setProperty('--x', Math.round(x) + 'px');
    card.style.setProperty('--y', Math.round(y) + 'px');
  }

  function show(dish) {
    var name = dishName(dish);
    var src = photoFor(name);
    if (!src) return;
    var price = dish.querySelector('.dish-price');
    nameEl.textContent = name;
    priceEl.textContent = price ? price.textContent : '';
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    place();
    card.classList.add('is-on');
  }

  function hide() {
    clearTimeout(timer);
    current = null;
    card.classList.remove('is-on');
  }

  document.addEventListener('mouseover', function (e) {
    var dish = e.target.closest && e.target.closest('.dish');
    if (dish === current) return;
    hide();
    if (!dish) return;
    current = dish;
    mx = e.clientX; my = e.clientY;
    // start loading the picture now, so it is ready when the delay is over
    var src = photoFor(dishName(dish));
    if (src) { var pre = new Image(); pre.src = src; }
    timer = setTimeout(function () { show(dish); }, DELAY);
  });

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (card.classList.contains('is-on')) place();
  }, { passive: true });

  document.addEventListener('mouseleave', hide);
  window.addEventListener('scroll', hide, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
})();
