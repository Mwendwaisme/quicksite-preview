// QuickSite interaction layer. Progressive enhancement: every page works without this file.
// Motion effects are skipped entirely when the visitor prefers reduced motion; functional pieces (recommender, sticky bar) still run.
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
  var BASE = (window.QS && window.QS.base) || '';
  var path = location.pathname.slice(BASE.length) || '/';
  var isApp = /^\/(account|admin)\//.test(path);
  if (isApp) return;

  // ---------- 1. Package recommender (uses the real catalogue limits) ----------
  (function reco() {
    var sec = $('.reco-sec'), data = $('#qs-plans');
    if (!sec || !data || !window.QSShared) return;
    var plans = JSON.parse(data.textContent), M = QSShared.money, R = QSShared.recommend;
    var n = $('#reco-n'), out = $('#reco-out'), box = $('[data-reco-result]');
    sec.hidden = false;
    function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function render() {
      var need = { products: Number(n.value) };
      $$('[data-need]', sec).forEach(function (c) { need[c.dataset.need] = c.checked; });
      out.textContent = n.value;
      var r = R.recommend(plans, need);
      while (box.firstChild) box.removeChild(box.firstChild);
      if (r.custom) {
        box.appendChild(el('span', 'pill', 'Custom quote'));
        box.appendChild(el('h3', null, 'That is beyond a fixed package'));
        box.appendChild(el('p', 'muted', r.reason + ' We will scope it with you and quote it in writing.'));
        var a = el('a', 'btn btn-gold', 'Request a Custom Quote'); a.href = '/quicksite-preview/request-quote/'; box.appendChild(a); return;
      }
      var p = r.package;
      box.appendChild(el('span', 'pill pill-gold', 'Best fit'));
      box.appendChild(el('h3', null, p.name));
      box.appendChild(el('div', 'reco-price', M.formatKES(p.setupCents)));
      box.appendChild(el('p', 'muted', 'setup, first year included. Then ' + M.formatKES(p.renewalCents) + ' a year. Up to ' + p.limits.products + ' products, ' + p.limits.pages + ' page' + (p.limits.pages > 1 ? 's' : '') + ', ' + p.limits.revisions + ' round' + (p.limits.revisions > 1 ? 's' : '') + ' of changes.'));
      var ul = el('ul', 'checks'); p.includes.slice(0, 4).forEach(function (i) { ul.appendChild(el('li', null, i)); }); box.appendChild(ul);
      var go = el('a', 'btn btn-gold', 'Choose ' + p.name); go.href = '/quicksite-preview/websites/order/?package=' + p.id; box.appendChild(go);
    }
    n.addEventListener('input', render); $$('[data-need]', sec).forEach(function (c) { c.addEventListener('change', render); });
    render();
  })();

  // ---------- 2. Sticky mobile call-to-action ----------
  (function sticky() {
    if (/^\/(websites\/order|request-quote|contact)\//.test(path)) return;
    var bar = doc.createElement('div'); bar.className = 'sticky-cta'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Quick actions');
    bar.innerHTML = '<a class="btn btn-gold btn-sm" href="/quicksite-preview/websites/order/">Get a website</a><a class="btn btn-ghost btn-sm" href="/quicksite-preview/request-quote/">Custom quote</a>';
    doc.body.appendChild(bar);
    var shown = false;
    function check() { var y = window.scrollY, h = doc.documentElement.scrollHeight - innerHeight; var on = y > 520 && y < h - 260; if (on !== shown) { shown = on; bar.classList.toggle('on', on); } }
    addEventListener('scroll', function () { raf(check); }, { passive: true }); check();
  })();

  if (reduce) return; // everything below is decorative motion

  root.className += ' fx';

  // ---------- 3. Reading progress + smart header ----------
  (function chrome() {
    var bar = doc.createElement('div'); bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true'); doc.body.appendChild(bar);
    var header = $('.site-header'), last = 0, ticking = false;
    function frame() {
      var y = window.scrollY, h = doc.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
      if (header) {
        var open = $('#site-nav.open');
        header.classList.toggle('hide', y > 240 && y > last + 4 && !open);
        if (y < last - 4 || y < 120) header.classList.remove('hide');
        header.classList.toggle('scrolled', y > 8);
      }
      last = y; ticking = false;
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; raf(frame); } }, { passive: true }); frame();
    // keep the header visible while keyboard focus is inside it
    if (header) header.addEventListener('focusin', function () { header.classList.remove('hide'); });
  })();

  // ---------- 4. Hero headline: word-by-word entrance ----------
  (function headline() {
    var h1 = $('.hero h1'); if (!h1) return;
    var i = 0;
    (function split(node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(doc.createTextNode(w)); return; }
            var s = doc.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = w; frag.appendChild(s);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1) split(c);
      });
    })(h1);
    raf(function () { h1.classList.add('go'); });
  })();

  // ---------- 5. Scroll reveal with stagger ----------
  (function reveal() {
    if (!('IntersectionObserver' in window)) return;
    var sel = 'main section .container > .sec-head, main section .container > .grid, main section .container > .paths, main section .container > .pricing, main section .container > .steps, main section .container > .audience, main section .container > .faq, main section .container > .table-wrap, main section .container > .card, main section .container > .reco, .center.narrow, .tpl-card, .preview-wrap, .form-card';
    var items = $$(sel).filter(function (e, i, a) { return a.indexOf(e) === i; });
    items.forEach(function (e) {
      e.setAttribute('data-reveal', '');
      $$(':scope > *', e).slice(0, 12).forEach(function (c, k) { if (/grid|pricing|steps|paths|audience/.test(e.className)) c.style.setProperty('--d', (k * 70) + 'ms'); });
    });
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (e) { io.observe(e); });
    setTimeout(function () { items.forEach(function (e) { e.classList.add('in'); }); }, 4000); // fail-safe: never leave content hidden
  })();

  // ---------- 6. Count-up on plan prices (final text is always the exact catalogue value) ----------
  (function counters() {
    var els = $$('.plan .amount, .path .price-big'); if (!els.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        if (!x.isIntersecting) return; io.unobserve(x.target);
        var el = x.target, txt = el.textContent, m = /([\d,]+)/.exec(txt); if (!m) return;
        var end = parseInt(m[1].replace(/,/g, ''), 10), start = performance.now(), dur = 900;
        el.setAttribute('aria-label', txt.trim());
        function tick(t) {
          var p = Math.min(1, (t - start) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
          el.textContent = txt.replace(m[1], p === 1 ? m[1] : v.toLocaleString('en-US'));
          if (p < 1) raf(tick);
        }
        raf(tick);
      });
    }, { threshold: 0.6 });
    els.forEach(function (e) { io.observe(e); });
  })();

  // ---------- 7. Hero: parallax on scroll and pointer tilt (fine pointers only) ----------
  (function hero() {
    var vis = $('.hero-visual'); if (!vis) return;
    var laptop = $('.laptop', vis), phone = $('.phone', vis), mx = 0, my = 0, y = 0, queued = false;
    function apply() { queued = false;
      if (laptop) laptop.style.transform = 'translate3d(' + (mx * -14) + 'px,' + (y * -0.06 + my * -10) + 'px,0) rotate(' + (mx * 1.2) + 'deg)';
      if (phone) phone.style.transform = 'translate3d(' + (mx * 20) + 'px,' + (y * 0.10 + my * 14) + 'px,0) rotate(' + (mx * -1.6) + 'deg)'; }
    function q() { if (!queued) { queued = true; raf(apply); } }
    addEventListener('scroll', function () { y = Math.min(window.scrollY, 700); q(); }, { passive: true });
    if (fine) $('.hero').addEventListener('mousemove', function (e) { var r = this.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; q(); });
  })();

  // ---------- 8. Template and plan cards: 3D tilt with a moving highlight ----------
  (function tilt() {
    if (!fine) return;
    $$('.tpl-card, .plan').forEach(function (c) {
      c.addEventListener('mousemove', function (e) {
        var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 5) + 'deg) rotateY(' + ((px - 0.5) * 6) + 'deg) translateY(-3px)';
        c.style.setProperty('--mx', (px * 100) + '%'); c.style.setProperty('--my', (py * 100) + '%');
      });
      c.addEventListener('mouseleave', function () { c.style.transform = ''; });
    });
  })();

  // ---------- 9. "Who we serve": endless ticker (pauses on hover/focus) ----------
  (function ticker() {
    var list = $('.audience'); if (!list) return;
    var track = doc.createElement('div'); track.className = 'ticker-track';
    var a = list.cloneNode(true), b = list.cloneNode(true); b.setAttribute('aria-hidden', 'true'); b.removeAttribute('class'); b.className = 'audience';
    track.appendChild(a); track.appendChild(b);
    var wrap = doc.createElement('div'); wrap.className = 'ticker'; wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', 'Who we serve');
    wrap.appendChild(track); list.parentNode.replaceChild(wrap, list);
  })();

  // ---------- 10. Section "spotlight": highlight the nav link of the section in view (home only) ----------
  (function spy() {
    if (path !== '/' || !('IntersectionObserver' in window)) return;
    var secs = $$('main > section[id]'); if (!secs.length) return;
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) root.setAttribute('data-section', x.target.id); }); }, { threshold: 0.4 });
    secs.forEach(function (s) { io.observe(s); });
  })();
})();
