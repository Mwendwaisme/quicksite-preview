// Shared helpers for the account portal and admin apps. Safe DOM building only: text goes through textContent,
// never innerHTML, so customer-supplied strings cannot inject markup.
window.QSDom = (function () {
  'use strict';
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  var money = function (cents) { return (window.QSShared && QSShared.money) ? QSShared.money.formatKES(cents) : 'KSh ' + (cents / 100); };
  var TZ = 'Africa/Nairobi';
  var date = function (iso) { return iso ? new Intl.DateTimeFormat('en-KE', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : ''; };
  var dateTime = function (iso) { return iso ? new Intl.DateTimeFormat('en-KE', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : ''; };

  /** fetch wrapper: resolves { ok, status, data } and never throws on HTTP errors. */
  function api(method, url, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var body;
    if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
    else if (opts.body !== undefined) body = opts.body;
    var base = (window.QS && window.QS.apiBase) || '';
    return fetch(base + url, { method: method, headers: headers, body: body, credentials: 'same-origin' })
      .then(function (r) { return r.text().then(function (t) { var d; try { d = JSON.parse(t); } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }); })
      .catch(function () { return { ok: false, status: 0, data: { error: 'We could not reach the server. Check your connection and try again.' } }; });
  }

  var toastBox;
  function toast(msg, kind) {
    if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    var t = h('div', { class: 'toast ' + (kind || 'ok'), text: msg });
    toastBox.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, kind === 'err' ? 8000 : 4000);
  }
  function errText(res) {
    var d = res.data || {};
    if (d.details) { var k = Object.keys(d.details); if (k.length) return d.details[k[0]]; }
    return d.error || 'Something went wrong.';
  }

  function badge(text, kind) { return h('span', { class: 'badge b-' + (kind || 'grey'), text: text }); }

  /** cols: [{ key|render, label, class }]. rows: array of objects. opts.onRow(row). */
  function table(cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) return h('div', { class: 'empty-state', text: opts.empty || 'Nothing here yet.' });
    var thead = h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { scope: 'col', class: c.class || '', text: c.label }); })));
    var tbody = h('tbody', null, rows.map(function (r) {
      var tr = h('tr', opts.onRow ? { tabindex: '0', class: 'click', role: 'link', onclick: function () { opts.onRow(r); }, onkeydown: function (e) { if (e.key === 'Enter') opts.onRow(r); } } : null,
        cols.map(function (c) { return h('td', { class: c.class || '' }, c.render ? c.render(r) : (r[c.key] == null ? '' : String(r[c.key]))); }));
      return tr;
    }));
    return h('div', { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': opts.label || 'Table' }, h('table', { class: 'tbl' }, thead, tbody));
  }

  function field(id, label, input, hint) {
    return h('div', { class: 'field' }, h('label', { for: id }, label, hint ? h('span', { class: 'hint', text: hint }) : null), input);
  }
  function select(id, options, value) {
    return h('select', { id: id }, options.map(function (o) { var v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label; return h('option', { value: v, selected: v === value }, l); }));
  }
  function confirmAction(message) { return window.confirm(message); }
  function ask(message, def) { return window.prompt(message, def || ''); }

  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('qs-theme', t); } catch (e) { /* ignore */ } }
  function themeButton() {
    var ns = 'http://www.w3.org/2000/svg';
    function svg(cls, d, extra) { var s = document.createElementNS(ns, 'svg'); s.setAttribute('class', cls); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.appendChild(p); if (extra) { var c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '4'); s.appendChild(c); } return s; }
    var b = h('button', { class: 'theme-toggle', type: 'button' });
    b.appendChild(svg('sun', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', true));
    b.appendChild(svg('moon', 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'));
    function paint() { var dark = document.documentElement.getAttribute('data-theme') === 'dark'; b.setAttribute('aria-pressed', String(dark)); b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }
    b.addEventListener('click', function () { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); paint(); });
    paint(); return b;
  }

  return { setTheme: setTheme, themeButton: themeButton, h: h, clear: clear, api: api, toast: toast, errText: errText, money: money, date: date, dateTime: dateTime, badge: badge, table: table, field: field, select: select, confirmAction: confirmAction, ask: ask };
})();
