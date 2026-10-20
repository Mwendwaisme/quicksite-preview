// QuickSite public site behaviour. Progressive enhancement only: every page works without this file.
(function () {
  'use strict';
  // Theme toggle (the initial theme is set by an inline script in <head> so there is no flash)
  (function theme() {
    var root = document.documentElement, meta = document.querySelector('meta[name=theme-color]');
    var btns = [].slice.call(document.querySelectorAll('[data-theme-toggle]'));
    function paint() {
      var dark = root.getAttribute('data-theme') === 'dark';
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(dark)); b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); });
      if (meta) meta.setAttribute('content', dark ? '#0E0E10' : '#EFEFEF');
    }
    function set(t, store) { root.setAttribute('data-theme', t); if (store) { try { localStorage.setItem('qs-theme', t); } catch (e) { /* private mode */ } } paint(); }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true); }); });
    // follow the system setting until the visitor makes an explicit choice
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      var follow = function (e) { var saved = null; try { saved = localStorage.getItem('qs-theme'); } catch (x) { /* ignore */ } if (!saved) set(e.matches ? 'dark' : 'light', false); };
      if (mq.addEventListener) mq.addEventListener('change', follow);
    }
    paint();
  })();

  // Mobile menu
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var set = function (open) { nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', function () { set(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); toggle.focus(); } });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  }

  // Template library filters
  var filters = document.querySelector('[data-tpl-filters]');
  if (filters) {
    filters.addEventListener('submit', function (e) { e.preventDefault(); });
    var cards = [].slice.call(document.querySelectorAll('[data-tpl]'));
    var live = document.querySelector('[data-tpl-count]');
    var empty = document.querySelector('[data-tpl-empty]');
    var q = filters.querySelector('[name=q]'), sector = filters.querySelector('[name=sector]'), type = filters.querySelector('[name=type]'), pkg = filters.querySelector('[name=pkg]');
    var apply = function () {
      var term = q.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var d = c.dataset;
        var ok = (!term || d.search.indexOf(term) > -1) && (!sector.value || d.sector === sector.value) && (!type.value || d.type === type.value) && (!pkg.value || Number(d.rank) <= Number(pkg.value));
        c.hidden = !ok; if (ok) shown++;
      });
      if (live) live.textContent = shown + (shown === 1 ? ' design' : ' designs') + ' shown';
      if (empty) empty.hidden = shown > 0;
    };
    [q, sector, type, pkg].forEach(function (el) { el.addEventListener('input', apply); el.addEventListener('change', apply); });
    var params = new URLSearchParams(location.search);
    if (params.get('sector')) sector.value = params.get('sector');
    apply();
  }

  // Template preview: phone / desktop toggle
  var frame = document.querySelector('.preview-frame');
  if (frame) {
    var btns = [].slice.call(document.querySelectorAll('[data-device]'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        frame.classList.toggle('mobile', b.dataset.device === 'mobile');
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
  }
})();
