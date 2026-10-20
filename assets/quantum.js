// QuickSite "quantum field": a canvas of nodes (the things we build) joined by entanglement-style links, with pointer
// attraction, click ripples (interference rings), kinetic text, magnetic controls, page transitions, an energy cursor
// and scroll energy. It is a VISUAL METAPHOR, not a scientific simulation or claim.
// Accessibility/performance: every node is also a real button; the canvas is decorative (aria-hidden); the loop runs at
// ~30 fps, pauses off-screen and in hidden tabs, caps pixel ratio, uses fewer particles on small screens, and with
// prefers-reduced-motion it draws one still frame and disables transitions, cursor, magnets and auto-cycling.
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var BASE = (window.QS && window.QS.base) || '';
  if (/^\/(account|admin)\//.test(location.pathname.slice(BASE.length))) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

  // ---------- colours follow the active theme (re-read whenever it changes) ----------
  var pal = { ink: '#0B0B0C', gold: '#E9B43B', muted: '#505050' };
  function readPalette() {
    var cs = getComputedStyle(root);
    pal.ink = cs.getPropertyValue('--ink').trim() || pal.ink; pal.gold = cs.getPropertyValue('--gold').trim() || pal.gold; pal.muted = cs.getPropertyValue('--muted').trim() || pal.muted;
  }
  function rgba(hex, a) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 'rgba(128,128,128,' + a + ')';
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }
  readPalette();

  // ---------- the field ----------
  function Field(canvas, opt) {
    var self = this; this.c = canvas; this.ctx = canvas.getContext('2d'); this.opt = opt;
    this.nodes = opt.nodes || []; this.parts = []; this.rip = []; this.ptr = { x: -9999, y: -9999, on: false };
    this.active = -1; this.visible = true; this.t0 = performance.now(); this.last = 0; this.running = false;
    this.resize();
    var host = opt.host || canvas.parentNode;
    host.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); self.ptr.x = e.clientX - r.left; self.ptr.y = e.clientY - r.top; self.ptr.on = true; }, { passive: true });
    host.addEventListener('pointerleave', function () { self.ptr.on = false; }, { passive: true });
    host.addEventListener('pointerdown', function (e) { if (e.target.closest('a,button,input')) return; var r = canvas.getBoundingClientRect(); self.ripple(e.clientX - r.left, e.clientY - r.top, 0.9); }, { passive: true });
    addEventListener('resize', function () { self.resize(); self.draw(performance.now()); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; self.kick(); }).observe(canvas);
    doc.addEventListener('visibilitychange', function () { self.kick(); });
  }
  Field.prototype.resize = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var small = this.W < 700, n = this.opt.particles * (small ? 0.5 : 1) | 0, i;
    this.parts = []; for (i = 0; i < n; i++) this.parts.push({ x: Math.random() * this.W, y: Math.random() * this.H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.4 + .6 });
    // node homes: an ellipse on the right of the hero so labels never sit on the headline or paragraph
    var k = this.nodes.length, cx = this.W * (small ? .5 : .76), cy = this.H * (small ? .5 : .5), rx = this.W * (small ? .4 : .2), ry = this.H * (small ? .36 : .4);
    for (i = 0; i < k; i++) {
      var a = i / k * Math.PI * 2 + .35, jit = 1 + ((i % 3) - 1) * .12, n_ = this.nodes[i];
      n_.hx = cx + Math.cos(a) * rx * jit; n_.hy = cy + Math.sin(a) * ry * jit;
      if (n_.x == null) { n_.x = n_.hx; n_.y = n_.hy; n_.ph = i * 1.7; }
    }
  };
  Field.prototype.ripple = function (x, y, strength) { this.rip.push({ x: x, y: y, t: performance.now(), s: strength || 1 }); this.kick(); };
  Field.prototype.setActive = function (i, ripple) { this.active = i; if (ripple && this.nodes[i]) this.ripple(this.nodes[i].x, this.nodes[i].y, 1.1); this.kick(); };
  Field.prototype.kick = function () {
    if (reduce) { this.draw(performance.now()); return; }
    if (this.running || !this.visible || doc.hidden) return;
    this.running = true; var self = this;
    (function loop(t) { if (!self.visible || doc.hidden) { self.running = false; return; } if (t - self.last >= 33) { self.last = t; self.step(); self.draw(t); } raf(loop); })(performance.now());
  };
  Field.prototype.step = function () {
    var W = this.W, H = this.H, p = this.ptr, i, o;
    for (i = 0; i < this.parts.length; i++) {
      o = this.parts[i]; o.x += o.vx; o.y += o.vy;
      if (o.x < 0 || o.x > W) o.vx *= -1; if (o.y < 0 || o.y > H) o.vy *= -1;
      if (p.on) { var dx = p.x - o.x, dy = p.y - o.y, d = dx * dx + dy * dy; if (d < 22500) { o.x += dx * .004; o.y += dy * .004; } }
    }
    var t = (performance.now() - this.t0) / 1000;
    for (i = 0; i < this.nodes.length; i++) {
      o = this.nodes[i];
      var tx = o.hx + Math.sin(t * .6 + o.ph) * 10, ty = o.hy + Math.cos(t * .5 + o.ph) * 8;
      if (p.on) { var ddx = p.x - tx, ddy = p.y - ty, dd = Math.sqrt(ddx * ddx + ddy * ddy); if (dd < 170) { var f = (1 - dd / 170) * 28; tx += ddx / (dd || 1) * f; ty += ddy / (dd || 1) * f; } }
      o.x += (tx - o.x) * .08; o.y += (ty - o.y) * .08;
    }
  };
  Field.prototype.draw = function (now) {
    var c = this.ctx, W = this.W, H = this.H, N = this.nodes, i, j, a, b, d;
    c.clearRect(0, 0, W, H);
    // drifting particles
    c.fillStyle = rgba(pal.ink, .22);
    for (i = 0; i < this.parts.length; i++) { a = this.parts[i]; c.beginPath(); c.arc(a.x, a.y, a.r, 0, 6.283); c.fill(); }
    // particle links (faint) near the pointer
    if (this.ptr.on) for (i = 0; i < this.parts.length; i++) { a = this.parts[i]; d = Math.hypot(a.x - this.ptr.x, a.y - this.ptr.y); if (d < 120) { c.strokeStyle = rgba(pal.gold, (1 - d / 120) * .5); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(this.ptr.x, this.ptr.y); c.stroke(); } }
    // entanglement links between nodes; the active node and its partner glow gold
    var act = this.active, partner = act >= 0 ? (act + Math.floor(N.length / 2)) % N.length : -1;
    for (i = 0; i < N.length; i++) for (j = i + 1; j < N.length; j++) {
      a = N[i]; b = N[j]; d = Math.hypot(a.x - b.x, a.y - b.y); var R = Math.min(W, 520) * .5;
      var hot = (i === act || j === act);
      if (d < R || (hot && (i === partner || j === partner))) {
        c.strokeStyle = hot ? rgba(pal.gold, .75) : rgba(pal.ink, Math.max(0.05, (1 - d / R) * .28)); c.lineWidth = hot ? 1.6 : 1;
        c.setLineDash(hot && (i === partner || j === partner) ? [5, 5] : []); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
    }
    c.setLineDash([]); c.lineWidth = 1;
    // nodes and labels
    c.font = '600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; c.textBaseline = 'middle';
    var pulse = (Math.sin(now / 420) + 1) / 2;
    for (i = 0; i < N.length; i++) {
      a = N[i]; var on = i === act, r = on ? 7 + pulse * 2.5 : 4.5;
      if (on) { var g = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, 34); g.addColorStop(0, rgba(pal.gold, .55)); g.addColorStop(1, rgba(pal.gold, 0)); c.fillStyle = g; c.beginPath(); c.arc(a.x, a.y, 34, 0, 6.283); c.fill(); }
      c.fillStyle = on ? pal.gold : rgba(pal.ink, .85); c.beginPath(); c.arc(a.x, a.y, r, 0, 6.283); c.fill();
      if (W >= 700) { c.fillStyle = on ? rgba(pal.ink, .95) : rgba(pal.ink, .5); c.textAlign = a.x > W * .7 ? 'right' : 'left'; c.fillText(a.label, a.x + (a.x > W * .7 ? -12 : 12), a.y); }
    }
    // click ripples: two interfering rings per event
    for (i = this.rip.length - 1; i >= 0; i--) {
      var rp = this.rip[i], age = (now - rp.t) / 1300; if (age >= 1) { this.rip.splice(i, 1); continue; }
      for (j = 0; j < 2; j++) { var rr = (age * 170 + j * 18) * rp.s; c.strokeStyle = rgba(j ? pal.ink : pal.gold, (1 - age) * .55); c.beginPath(); c.arc(rp.x, rp.y, rr, 0, 6.283); c.stroke(); }
    }
  };

  // ---------- kinetic text ----------
  var GLY = 'abcdefghijklmnopqrstuvwxyz0123456789';
  function scramble(el, text) {
    if (reduce) { el.textContent = text; return; }
    var start = performance.now(), dur = 420, token = (el.__qs = (el.__qs || 0) + 1);
    (function frame(t) {
      if (el.__qs !== token) return;
      var p = Math.min(1, (t - start) / dur), keep = Math.floor(text.length * p), out = '';
      for (var i = 0; i < text.length; i++) out += i < keep || text[i] === ' ' ? text[i] : GLY[Math.floor(Math.random() * GLY.length)];
      el.textContent = out; if (p < 1) raf(frame); else el.textContent = text;
    })(start);
  }

  // ---------- hero: sectors, chips, panel ----------
  var hero = $('[data-quantum-hero]'), canvas = $('[data-qfield]', hero || doc), dataEl = $('#qs-sectors');
  var heroField = null;
  if (hero && canvas && dataEl) {
    var sectors = JSON.parse(dataEl.textContent);
    var nodes = sectors.map(function (s) { return { id: s.id, label: s.node }; });
    heroField = new Field(canvas, { nodes: nodes, particles: 46, host: hero });
    var rail = $('.qrail', hero), chips = $$('.qchip', hero), line = $('[data-q-line]', hero), detail = $('[data-q-detail]', hero), link = $('[data-q-link]', hero), announce = $('[data-q-announce]', hero);
    rail.hidden = false; hero.classList.add('q-live');
    var cur = 0, user = false, timer = null;
    function select(i, byUser) {
      if (byUser) { user = true; clearInterval(timer); }
      cur = i; var s = sectors[i];
      chips.forEach(function (c, k) { c.setAttribute('aria-pressed', String(k === i)); });
      scramble(line, s.line); detail.textContent = s.detail; link.textContent = s.cta; link.setAttribute('href', s.href);
      // screen readers hear ONE clean message, and only when the visitor chose (never the scrambled frames or the auto-cycle)
      if (byUser && announce) announce.textContent = s.label + '. ' + s.line + '. ' + s.detail;
      heroField.setActive(i, true);
    }
    chips.forEach(function (c, i) { c.addEventListener('click', function () { select(i, true); }); c.addEventListener('pointerenter', function () { if (fine) heroField.setActive(i, false); }); c.addEventListener('pointerleave', function () { heroField.setActive(cur, false); }); c.addEventListener('focus', function () { heroField.setActive(i, false); }); c.addEventListener('blur', function () { heroField.setActive(cur, false); }); });
    // clicking a node on the canvas selects it
    hero.addEventListener('click', function (e) {
      if (e.target.closest('a,button,input')) return; var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = -1, bd = 40;
      heroField.nodes.forEach(function (n, k) { var d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = k; } }); if (best >= 0) select(best, true);
    });
    heroField.setActive(0, false);
    // the field evolves by itself until the visitor takes over
    if (!reduce) timer = setInterval(function () { if (!user && !doc.hidden && heroField.visible) select((cur + 1) % sectors.length, false); }, 6000);
    ['pointerenter', 'focusin'].forEach(function (ev) { $('.qwrap', hero).addEventListener(ev, function () { clearInterval(timer); }); });
    heroField.kick();
  }

  // ---------- ambient aura on inner page heroes ----------
  if (!reduce) $$('.page-hero').forEach(function (h) {
    var cv = doc.createElement('canvas'); cv.className = 'q-aura'; cv.setAttribute('aria-hidden', 'true'); h.insertBefore(cv, h.firstChild);
    new Field(cv, { nodes: [], particles: 34, host: h }).kick();
  });

  // ---------- theme changes: recolour without reloading ----------
  new MutationObserver(function () { readPalette(); if (heroField) heroField.draw(performance.now()); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- scroll energy: a CSS variable that drives glow and drift ----------
  (function energy() {
    if (reduce) return; var lastY = scrollY, e = 0, queued = false;
    function upd() { queued = false; var y = scrollY; e = Math.min(1, e * .85 + Math.abs(y - lastY) / 60); lastY = y; root.style.setProperty('--scroll-energy', e.toFixed(3)); if (e > .01) { queued = true; raf(upd); } }
    addEventListener('scroll', function () { if (!queued) { queued = true; raf(upd); } }, { passive: true });
  })();

  if (reduce) return;

  // ---------- magnetic controls ----------
  if (fine) $$('.btn, .qchip, .theme-toggle').forEach(function (el) {
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + 'px'); el.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .22).toFixed(1) + 'px'); });
    el.addEventListener('pointerleave', function () { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); });
  });

  // ---------- energy cursor (a trailing ring; the real cursor is never hidden) ----------
  if (fine) (function cursor() {
    var ring = doc.createElement('div'); ring.className = 'q-cursor'; ring.setAttribute('aria-hidden', 'true'); doc.body.appendChild(ring);
    var x = -50, y = -50, tx = -50, ty = -50;
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; ring.classList.add('on'); }, { passive: true });
    doc.documentElement.addEventListener('mouseleave', function () { ring.classList.remove('on'); });
    doc.addEventListener('pointerover', function (e) { ring.classList.toggle('hot', !!e.target.closest('a,button,input,select,textarea,summary,label')); });
    (function loop() { x += (tx - x) * .2; y += (ty - y) * .2; ring.style.transform = 'translate3d(' + (x - 16) + 'px,' + (y - 16) + 'px,0)'; raf(loop); })();
  })();

  // ---------- page transitions for same-origin navigation ----------
  (function transitions() {
    var veil = doc.createElement('div'); veil.className = 'q-veil'; veil.setAttribute('aria-hidden', 'true'); veil.innerHTML = '<i></i>'; doc.body.appendChild(veil);
    root.classList.add('q-enter'); setTimeout(function () { root.classList.remove('q-enter'); }, 700);
    addEventListener('pageshow', function (e) { if (e.persisted) veil.classList.remove('on'); });
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self' || a.hasAttribute('download')) return;
      var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      if (/^\/(account|admin|api|preview|media|sites)\//.test(u.pathname.slice(BASE.length)) || /\.(pdf|zip|png|jpe?g|webp|svg|xml|txt)$/i.test(u.pathname)) return;
      e.preventDefault(); veil.classList.add('on');
      setTimeout(function () { location.href = u.href; }, 260);
    });
  })();
})();
