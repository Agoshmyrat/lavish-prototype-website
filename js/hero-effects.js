/**
 * Hero effects — one small canvas behind the headline draws two things with a single animation loop:
 *   1. Smoke: puffs rise from the word "steak", then spread out and drift behind the big words.
 *   2. Sparks: small glowing embers drift up across the front of the page (a few near "steak").
 *
 * Built to be cheap: one canvas, one requestAnimationFrame loop, about 30 frames a second (smoke and
 * embers move slowly, so this looks identical), a reduced drawing resolution (everything is soft anyway),
 * and a full stop when the hero is off-screen or the tab is hidden.
 *
 * Switch off with `effects.sparks: false` and/or `effects.steakSmoke: false` in js/config.js.
 * Visitors who prefer reduced motion never get the canvas at all.
 */
(function () {
  'use strict';

  var settings = (window.LAVISH_CONFIG && window.LAVISH_CONFIG.effects) || {};
  var wantSmoke = settings.steakSmoke !== false, wantSparks = settings.sparks !== false;
  if (!wantSmoke && !wantSparks) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = document.querySelector('.hero');
  var canvas = document.getElementById('heroFx');
  var word = document.getElementById('steakWord');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- sprites (drawn once, stamped many times) ---------- */
  var smokeSprite = (function () {
    var s = 96, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(228,216,204,0.85)');
    gr.addColorStop(0.5, 'rgba(228,216,204,0.32)');
    gr.addColorStop(1, 'rgba(228,216,204,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return c;
  })();

  var STEPS = 10, sparkSprites = [];   // white-yellow (fresh) -> deep red (cooling)
  (function () {
    var cols = [[255, 240, 190], [255, 200, 90], [255, 140, 40], [220, 70, 20], [150, 30, 12]];
    for (var i = 0; i < STEPS; i++) {
      var f = i / (STEPS - 1) * (cols.length - 1), a = Math.floor(f), b = Math.min(cols.length - 1, a + 1), k = f - a;
      var rgb = [0, 1, 2].map(function (n) { return Math.round(cols[a][n] + (cols[b][n] - cols[a][n]) * k); }).join(',');
      var c = document.createElement('canvas'); c.width = c.height = 32;
      var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,235,1)');
      gr.addColorStop(0.18, 'rgba(' + rgb + ',0.95)');
      gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      sparkSprites.push(c);
    }
  })();

  var glowSprites = [[255,196,90],[255,140,50],[240,96,34]].map(function (rgb) {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16), r = rgb.join(',');
    gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.18, 'rgba(' + r + ',0.95)');
    gr.addColorStop(0.55, 'rgba(' + r + ',0.28)'); gr.addColorStop(1, 'rgba(' + r + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
  });

  /* ---------- layout ---------- */
  var W = 0, H = 0, RES = 0.7, small = false, box = null;
  var puffs = [], sparks = [], glows = [];

  function measure() {
    var h = hero.getBoundingClientRect();
    W = h.width; H = h.height;
    small = window.innerWidth < 700;
    RES = small ? 0.6 : 0.85;
    canvas.width = Math.max(1, Math.round(W * RES));
    canvas.height = Math.max(1, Math.round(H * RES));
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    if (word) {
      var w = word.getBoundingClientRect();
      box = { left: w.left - h.left, right: w.right - h.left, top: w.top - h.top, height: w.height };
    }
  }

  /* ---------- spawning ---------- */
  function spawnPuff() {
    if (!box || puffs.length >= (small ? 24 : 40)) return;
    puffs.push({
      x: rand(box.left + 8, box.right - 8), y: box.top + box.height * rand(0.12, 0.30),
      vx: rand(-14, 6), vy: -rand(14, 30), age: 0, life: rand(5.5, 8.5),
      r0: rand(9, 15), grow: rand(5.5, 8), peak: rand(0.26, 0.40), seed: Math.random() * 6.28, drop: rand(8, 20)
    });
  }

  function spawnSpark(near) {
    if (sparks.length >= (small ? 55 : 100)) return;
    var x, y;
    if (near && box) { x = rand(box.left, box.right); y = box.top + box.height * rand(0.3, 0.7); }
    else { x = Math.pow(Math.random(), 0.8) * W; y = rand(H * 0.55, H * 1.02); }
    sparks.push({
      x: x, y: y, vx: rand(-10, 22), vy: -rand(40, 120), age: 0, life: rand(2.4, 6),
      size: rand(1.4, 3.4) * (small ? 0.8 : 1), seed: Math.random() * 6.28, wob: rand(6, 20), hz: rand(1.2, 2.6)
    });
  }

  function spawnGlow(burst) {
    if (glows.length >= (small ? 45 : 90)) return;
    glows.push({
      x: rand(0, W), y: burst ? rand(H * 0.3, H) : rand(H * 0.72, H * 1.02), vx: rand(-10, 22), vy: -rand(26, 80),
      age: burst ? rand(0, 3) : 0, life: rand(3.5, 8), size: rand(4, 10),
      tone: Math.random() < 0.5 ? 0 : (Math.random() < 0.6 ? 1 : 2), seed: Math.random() * 6.28,
      wob: rand(6, 20), freq: rand(0.8, 2.2), tw: rand(6, 14)
    });
  }

  /* ---------- loop ---------- */
  var FRAME_MS = 32;                 // about 30 frames a second
  var t0 = 0, lastDraw = 0, raf = 0, running = false, inView = true;
  var accPuff = 0, accSpark = 0, accNear = 0, accGlow = 0;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var elapsed = now - lastDraw;
    if (elapsed < FRAME_MS) return;                       // skip: keeps the work at ~30fps
    var dt = Math.min(elapsed / 1000, 0.08); lastDraw = now;
    var t = (now - t0) / 1000;

    if (wantSmoke && t > 0) { accPuff += (0.9 + 0.5 * Math.sin(t * 0.7)) * dt; while (accPuff >= 1) { accPuff -= 1; spawnPuff(); } }
    if (wantSparks) {
      accSpark += (small ? 9 : 17) * dt; while (accSpark >= 1) { accSpark -= 1; spawnSpark(false); }
      accGlow += (small ? 6 : 12) * dt;  while (accGlow >= 1) { accGlow -= 1; spawnGlow(false); }
      accNear += 3.2 * dt;               while (accNear >= 1)  { accNear -= 1;  spawnSpark(true); }
    }

    ctx.clearRect(0, 0, W, H);
    var i, p, k, s, a;

    // smoke first (normal blending), embers on top (additive)
    ctx.globalCompositeOperation = 'source-over';
    for (i = puffs.length - 1; i >= 0; i--) {
      p = puffs[i]; p.age += dt; k = p.age / p.life;
      if (k >= 1) { puffs[i] = puffs[puffs.length - 1]; puffs.pop(); continue; }
      p.vy += p.drop * dt * smooth(0.25, 0.9, k) * 0.9; p.vy *= 1 - 0.25 * dt; p.vx *= 1 - 0.12 * dt;
      p.x += (p.vx + Math.sin(p.age * 0.9 + p.seed) * 9) * dt; p.y += p.vy * dt;
      a = p.peak * smooth(0, 0.1, k) * (1 - smooth(0.4, 1, k));
      if (a < 0.003) continue;
      s = p.r0 * (1 + (p.grow - 1) * Math.sqrt(k));
      ctx.globalAlpha = a;
      ctx.drawImage(smokeSprite, p.x - s, p.y - s * 0.75, s * 2, s * 1.5);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (i = sparks.length - 1; i >= 0; i--) {
      p = sparks[i]; p.age += dt; k = p.age / p.life;
      if (k >= 1 || p.y < -20) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); continue; }
      p.vy *= 1 - 0.1 * dt;
      p.x += (p.vx + Math.sin(p.age * p.hz * 2 + p.seed) * p.wob) * dt; p.y += p.vy * dt;
      ctx.globalAlpha = clamp((1 - k) * 1.1, 0, 1) * (0.65 + 0.35 * Math.sin(p.age * 17 + p.seed * 3));
      s = p.size * 4 * (1 - 0.45 * k);
      ctx.drawImage(sparkSprites[Math.min(STEPS - 1, (k * STEPS) | 0)], p.x - s, p.y - s, s * 2, s * 2);
    }
    for (i = glows.length - 1; i >= 0; i--) {
      p = glows[i]; p.age += dt;
      if (p.age >= p.life || p.y < -20) { glows[i] = glows[glows.length - 1]; glows.pop(); continue; }
      k = p.age / p.life;
      p.x += (p.vx + Math.sin(p.age * p.freq + p.seed) * p.wob) * dt; p.y += p.vy * dt;
      a = (k < 0.08 ? k / 0.08 : 1 - Math.pow((k - 0.08) / 0.92, 1.4)) * (0.65 + 0.35 * Math.sin(p.age * p.tw + p.seed));
      if (a < 0.02) continue;
      s = p.size * (1 - 0.4 * k); ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowSprites[p.tone], p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function start() { if (running || !W) return; running = true; lastDraw = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function init() {
    measure();
    t0 = performance.now() + 600;
    if (wantSmoke) for (var n = 0; n < 6; n++) { spawnPuff(); if (puffs.length) puffs[puffs.length - 1].age = rand(0, 2.5); }
    if (wantSparks) for (var q = 0; q < (small ? 14 : 30); q++) spawnGlow(true);
    if (wantSparks) for (var m = 0; m < 40; m++) { spawnSpark(m % 4 === 0); if (sparks.length) sparks[sparks.length - 1].age = rand(0, 3); }
    if (inView && !document.hidden) start();

    if ('ResizeObserver' in window) {
      var pending = false;
      new ResizeObserver(function () {
        if (pending) return; pending = true;
        requestAnimationFrame(function () { pending = false; measure(); });
      }).observe(hero);
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      inView = e[0].isIntersecting;
      if (inView && !document.hidden) start(); else stop();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (inView) start(); });

  // wait for the web fonts (the word "steak" moves when they load), but never longer than 1.5s
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(init);
})();
