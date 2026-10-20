// QuickSite Express order wizard. Vanilla JS, no dependencies. Safe DOM building only (no innerHTML with user text).
// Server is the source of truth for price, limits and eligibility; this UI mirrors the rules so people are never surprised.
(function () {
  'use strict';
  var root = document.getElementById('wizard');
  var dataEl = document.getElementById('qs-data');
  if (!root || !dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var CAT = D.catalogue, TPLS = D.templates, PK = CAT.packages;
  var Phone = (window.QSShared && window.QSShared.phone) || { normalizePhone: function (v) { return v; } };
  var Money = (window.QSShared && window.QSShared.money) || { formatKES: function (c) { return 'KSh ' + c / 100; } };
  var KEY = 'qs-order-draft-v1';

  // ---------- tiny DOM helper ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    var add = function (c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(add); return; } el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); };
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }
  var kes = function (c) { return Money.formatKES(c); };
  var pkgOf = function (id) { return PK.filter(function (p) { return p.id === id; })[0] || null; };
  var tplOf = function (id) { return TPLS.filter(function (t) { return t.id === id; })[0] || null; };
  var rank = function (id) { return PK.map(function (p) { return p.id; }).indexOf(id); };
  var uuid = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2); };

  // ---------- state + draft ----------
  var blank = function () {
    return { step: 0, requestId: uuid(), templateId: '', packageId: '', businessName: '', ownerName: '', mobile: '', whatsappSame: true, whatsapp: '', email: '',
      location: '', onlineOnly: false, hours: '', social: { instagram: '', facebook: '', tiktok: '' }, products: [], addLater: false, useDefaultColours: true, primary: '', accent: '',
      tagline: '', about: '', inspiration: '', domainChoices: ['', '', ''], domainHelp: false, registrantName: '', consent: false, promoConsent: false };
  };
  var S = blank();
  var resumed = false;
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.v === 1 && !saved.submitted) { S = Object.assign(blank(), saved.data); resumed = true; }
  } catch (e) { /* storage unavailable: the wizard still works, just without resume */ }
  var params = new URLSearchParams(location.search);
  if (params.get('template') && tplOf(params.get('template'))) { S.templateId = params.get('template'); if (!resumed) S.step = S.packageId ? 1 : 1; }
  if (params.get('package') && pkgOf(params.get('package'))) { S.packageId = params.get('package'); }
  if (!resumed && (params.get('template') || params.get('package'))) S.step = params.get('template') ? 1 : 0;
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, data: S, at: Date.now() })); } catch (e) { /* ignore */ } };

  var STEPS = ['Design', 'Package', 'Business', 'Products', 'Branding', 'Domain', 'Review'];
  var errors = {};
  var done = null; // set after a successful submit

  var DOMAIN_OK = function (d) { return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(d).toLowerCase().replace(/\.co\.ke$/, '')); };
  // Which step owns which server-side error key, so a rejected order jumps back to the right place.
  var STEP_OF = { templateId: 0, packageId: 1, businessName: 2, ownerName: 2, mobile: 2, whatsapp: 2, email: 2, products: 3, theme: 4, inspiration: 4, domain: 5, consent: 6 };
  function stepForErrors(d) { var best = 99; Object.keys(d || {}).forEach(function (k) { var st = /^price\d+$/.test(k) ? 3 : /^social/.test(k) ? 2 : STEP_OF[k]; if (st != null && st < best) best = st; }); return best === 99 ? null : best; }

  // ---------- validation (client mirror; server re-validates everything) ----------
  function validateStep(i) {
    var e = {};
    var pk = pkgOf(S.packageId);
    if (i === 0 && !S.templateId) e.templateId = 'Please choose a design.';
    if (i === 1 && !S.packageId) e.packageId = 'Please choose a package.';
    if (i === 2) {
      if (!S.businessName.trim()) e.businessName = 'Enter your business name.';
      if (!S.ownerName.trim()) e.ownerName = 'Enter your name.';
      if (!Phone.normalizePhone(S.mobile)) e.mobile = 'Enter a valid mobile number, for example 0712 345 678.';
      if (!S.whatsappSame && S.whatsapp && !Phone.normalizePhone(S.whatsapp)) e.whatsapp = 'That WhatsApp number does not look right.';
      if (S.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email)) e.email = 'That email does not look right.';
    }
    if (i === 3 && pk && S.products.length > pk.limits.products) e.products = pk.name + ' includes ' + pk.limits.products + ' products or services. Remove ' + (S.products.length - pk.limits.products) + ' or choose a bigger package.';
    if (i === 3) S.products.forEach(function (p, n) { if (p.price && !/^\d{1,9}(\.\d{1,2})?$/.test(String(p.price).replace(/[,\s]/g, '').replace(/^ksh\.?/i, ''))) e['price' + n] = 'Use numbers only, for example 1500.'; });
    if (i === 5) { var badDom = S.domainChoices.filter(function (d) { return d && !DOMAIN_OK(d); })[0]; if (badDom) e.domain = '"' + badDom + '" is not a valid domain name. Use letters, numbers and hyphens only.'; }
    if (i === 6) { if (!S.consent) e.consent = 'Please agree to the terms to place your order.'; }
    return e;
  }

  // ---------- fields ----------
  function field(id, label, input, hint, err) {
    return h('div', { class: 'field' }, h('label', { for: id }, label, hint ? h('span', { class: 'hint', text: hint }) : null), input, err ? h('span', { class: 'err', id: id + '-err', text: err }) : null);
  }
  function text(id, key, opts) {
    opts = opts || {};
    var inp = h('input', { id: id, type: opts.type || 'text', value: opts.get ? opts.get() : S[key], autocomplete: opts.autocomplete, inputmode: opts.inputmode, maxlength: opts.max || 120, 'aria-invalid': errors[key] ? 'true' : false, 'aria-describedby': errors[key] ? id + '-err' : false,
      oninput: function (e) { if (opts.set) opts.set(e.target.value); else S[key] = e.target.value; save(); } });
    return field(id, opts.label, inp, opts.hint, errors[key]);
  }
  function area(id, key, label, hint, rows, max) {
    return field(id, label, h('textarea', { id: id, rows: rows || 3, maxlength: max || 1500, oninput: function (e) { S[key] = e.target.value; save(); } }, S[key]), hint);
  }
  function check(id, key, label, errKey) {
    return h('div', { class: 'check' }, h('input', { id: id, type: 'checkbox', checked: S[key], 'aria-invalid': errors[errKey || key] ? 'true' : false, onchange: function (e) { S[key] = e.target.checked; save(); if (key === 'whatsappSame' || key === 'onlineOnly' || key === 'addLater' || key === 'domainHelp' || key === 'useDefaultColours') { if (key === 'useDefaultColours' && !S.useDefaultColours) { var tt = tplOf(S.templateId), d2 = (tt && tt.defaultTheme) || { primary: '#10264f', accent: '#e9b43b' }; S.primary = S.primary || d2.primary; S.accent = S.accent || d2.accent; } render(); } } }),
      h('label', { for: id }, label), errors[errKey || key] ? h('span', { class: 'err', text: errors[errKey || key] }) : null);
  }

  // ---------- steps ----------
  function stepDesign() {
    var sectors = []; TPLS.forEach(function (t) { if (sectors.indexOf(t.sector) < 0) sectors.push(t.sector); });
    var sname = function (id) { var s = CAT.sectors.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; };
    var filter = S._sector || '';
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by sector' },
      [''].concat(sectors).map(function (id) { return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === id), onclick: function () { S._sector = id; render(); } }, id ? sname(id) : 'All'); }));
    var grid = h('div', { class: 'opt-grid' }, TPLS.filter(function (t) { return !filter || t.sector === filter; }).map(function (t) {
      var inp = h('input', { type: 'radio', name: 'tpl', value: t.id, checked: S.templateId === t.id, onchange: function () { S.templateId = t.id; save(); } });
      return h('label', { class: 'opt' }, inp, h('img', { src: t.thumbDesktop, alt: '', width: 320, height: 200, loading: 'lazy' }), h('span', { class: 't', text: t.name }), h('span', { class: 'muted', style: 'display:block;font-size:.88rem', text: sname(t.sector) + ' · ' + t.siteType }),
        h('a', { href: t.detailPath, target: '_blank', rel: 'noopener', style: 'font-size:.88rem;position:relative;z-index:2', onclick: function (e) { e.stopPropagation(); } }, 'Preview (new tab)'));
    }));
    return [h('h2', { text: 'Choose a design' }), h('p', { class: 'muted', text: 'Pick the one closest to your business. You can change your colours and content later in this form.' }), chips,
      errors.templateId ? h('p', { class: 'err field', style: 'color:var(--danger);font-weight:700', role: 'alert', text: errors.templateId }) : null, grid];
  }

  function stepPackage() {
    var t = tplOf(S.templateId);
    var list = PK.map(function (p) {
      var inp = h('input', { type: 'radio', name: 'pkg', value: p.id, checked: S.packageId === p.id, onchange: function () { S.packageId = p.id; save(); render(); } });
      return h('label', { class: 'opt' }, inp, h('span', { class: 't', text: p.name }), h('div', { style: 'font-size:1.6rem;font-weight:800;color:var(--navy)', text: kes(p.setupCents) }),
        h('div', { class: 'muted', style: 'font-size:.85rem', text: 'setup, first year included. Renewal ' + kes(p.renewalCents) + '/year' }),
        h('ul', { class: 'checks', style: 'margin-top:10px;font-size:.9rem' }, p.includes.slice(0, 4).map(function (i) { return h('li', { text: i }); })));
    });
    var note = null;
    if (t && S.packageId && rank(S.packageId) < rank(t.minPackage)) note = h('div', { class: 'notice notice-info', style: 'margin-top:16px', role: 'note' }, h('strong', { text: t.name + ' on ' + pkgOf(S.packageId).name }), h('p', { style: 'margin:4px 0 0', text: 'You will get this design without its signature feature (' + t.signature.toLowerCase() + '). Choose ' + pkgOf(t.minPackage).name + ' or higher for the full design.' }));
    return [h('h2', { text: 'Choose a package' }), h('p', { class: 'muted', text: 'Every package includes your first-year .co.ke domain, hosting and HTTPS. You can upgrade later.' }),
      errors.packageId ? h('p', { style: 'color:var(--danger);font-weight:700', role: 'alert', text: errors.packageId }) : null, h('div', { class: 'opt-grid' }, list), note,
      h('p', { class: 'muted', style: 'margin-top:14px;font-size:.9rem' }, 'Need online checkout, logins or a system? That is custom work. ', h('a', { href: '/quicksite-preview/request-quote/', text: 'Request a custom quote' }), '.')];
  }

  function stepBusiness() {
    var pk = pkgOf(S.packageId);
    var socialOk = pk && pk.features.social;
    return [h('h2', { text: 'About your business' }),
      h('div', { class: 'row2' }, text('f-biz', 'businessName', { label: 'Business name', autocomplete: 'organization', max: 120 }), text('f-owner', 'ownerName', { label: 'Your name', autocomplete: 'name', max: 100 })),
      h('div', { class: 'row2' }, text('f-mobile', 'mobile', { label: 'Mobile number', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: 'For example 0712 345 678', max: 30 }), text('f-email', 'email', { label: 'Email (optional)', type: 'email', autocomplete: 'email', max: 160 })),
      check('f-wa-same', 'whatsappSame', 'My WhatsApp number is the same as my mobile number'),
      S.whatsappSame ? null : text('f-wa', 'whatsapp', { label: 'WhatsApp number', type: 'tel', inputmode: 'tel', max: 30 }),
      check('f-online', 'onlineOnly', 'I trade online only (no shop or stall to show)'),
      S.onlineOnly ? null : text('f-loc', 'location', { label: 'Where are you?', hint: 'Area and landmark, for example "Gikomba, near the main gate"', max: 200 }),
      area('f-hours', 'hours', 'Opening hours (optional)', 'One line per day or range, for example "Mon-Sat 8am-6pm"', 3, 300),
      h('fieldset', null, h('legend', { text: 'Social media (optional)' }),
        socialOk ? h('div', { class: 'row2' }, ['instagram', 'facebook', 'tiktok'].map(function (k) { return text('f-soc-' + k, 'social_' + k, { label: k.charAt(0).toUpperCase() + k.slice(1) + ' link', max: 200, get: function () { return S.social[k]; }, set: function (v) { S.social[k] = v; } }); }))
          : h('p', { class: 'muted', text: pk ? 'Social links are included from Duka Plus (' + kes(pkgOf('duka-plus').setupCents) + '). You can still choose that package, or add social links later as an upgrade.' : 'Choose a package first to see what is included.' }))];
  }

  function parseBulk(txt, limit) {
    var out = [], skipped = 0;
    txt.split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var m = /^(.*?)\s*(?:[-–,:|]|\s)\s*(?:ksh\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s*$/i.exec(line);
      var title = (m ? m[1] : line).trim().slice(0, 120), price = m ? m[2].replace(/,/g, '') : '';
      if (!title) return;
      if (out.length >= limit) { skipped++; return; }
      out.push({ title: title, price: price, text: '', category: '' });
    });
    return { items: out, skipped: skipped };
  }
  function stepProducts() {
    var pk = pkgOf(S.packageId); var limit = pk ? pk.limits.products : 5; var n = S.products.length;
    var full = n >= limit;
    var rows = S.products.map(function (p, i) {
      var f = function (key, label, o) { o = o || {}; return h('div', null, h('label', { for: 'p' + i + key }, label), h('input', { id: 'p' + i + key, value: p[key], maxlength: o.max || 120, inputmode: o.inputmode, 'aria-invalid': errors['price' + i] && key === 'price' ? 'true' : false, oninput: function (e) { p[key] = e.target.value; save(); } })); };
      return h('div', { class: 'prod-row' }, f('title', 'Name'), f('price', 'Price (KSh)', { inputmode: 'decimal', max: 12 }), f('text', 'Short description (optional)', { max: 200 }),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Remove ' + (p.title || 'item ' + (i + 1)), onclick: function () { S.products.splice(i, 1); save(); render(); } }, 'Remove'),
        errors['price' + i] ? h('span', { class: 'err', style: 'grid-column:1/-1;color:var(--danger)', text: errors['price' + i] }) : null);
    });
    var bulk = h('textarea', { id: 'bulk', rows: 4, placeholder: 'Tomatoes 1kg - 120\nOnions 1kg - 100\nSukuma wiki - 30', 'aria-describedby': 'bulk-hint' });
    var bulkMsg = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite', id: 'bulk-msg' });
    return [h('h2', { text: 'What do you sell or offer?' }), h('p', { class: 'muted', text: 'Add your main products or services with prices. You can skip this now and send them after you order.' }),
      check('f-later', 'addLater', 'I will add my products later'),
      S.addLater ? null : h('div', null,
        h('div', { class: 'meter' + (n > limit ? ' full' : ''), role: 'img', 'aria-label': n + ' of ' + limit + ' used' }, h('i', { style: 'width:' + Math.min(100, Math.round(n / limit * 100)) + '%' })),
        h('p', { class: 'muted', style: 'font-size:.9rem', text: n + ' of ' + limit + ' products used on ' + (pk ? pk.name : 'your package') }),
        errors.products ? h('div', { class: 'notice notice-err', role: 'alert', style: 'margin-bottom:14px' }, h('strong', { text: 'Too many products' }), errors.products) : null,
        rows,
        h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
          h('button', { type: 'button', class: 'btn btn-navy btn-sm', 'aria-disabled': full ? 'true' : false, onclick: function () { if (full) { return; } S.products.push({ title: '', price: '', text: '', category: '' }); save(); render(); } }, 'Add a product'),
          full ? h('span', { class: 'muted', style: 'font-size:.9rem' }, pk.name + ' includes ' + limit + '. ', pkgOf('duka-plus') && pk.id === 'duka-starter' ? 'Duka Plus includes 15.' : '', ' Extra products can be added as a quoted extra.') : null),
        h('details', { class: 'more', style: 'margin-top:18px' }, h('summary', { text: 'Paste a list instead' }),
          h('div', { class: 'field' }, h('label', { for: 'bulk' }, 'One product per line: name, then price', h('span', { id: 'bulk-hint', class: 'hint', text: 'For example: Tomatoes 1kg - 120' })), bulk),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () {
            var r = parseBulk(bulk.value, Math.max(0, limit - S.products.length));
            r.items.forEach(function (it) { S.products.push(it); }); save();
            if (r.items.length) { render(); }
            bulkMsg.textContent = r.items.length ? '' : 'Nothing added. Check the lines, or you may have reached your limit.';
            if (r.skipped) { var m = document.getElementById('bulk-msg'); if (m) m.textContent = r.skipped + ' lines were skipped because they are over your package limit.'; }
          } }, 'Add these to my list'), bulkMsg))];
  }

  function stepBranding() {
    var color = function (id, key, label) { return h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id: id, type: 'color', value: S[key], style: 'height:52px;padding:4px', oninput: function (e) { S[key] = e.target.value; save(); } })); };
    return [h('h2', { text: 'Look and feel' }), h('p', { class: 'muted', text: 'Optional. We will use the design’s default colours if you skip this.' }),
      h('div', { class: 'row2' }, color('f-c1', 'primary', 'Main colour'), color('f-c2', 'accent', 'Accent colour')),
      text('f-tag', 'tagline', { label: 'A short line about your business', hint: 'For example "Fresh sneakers from the heart of Nairobi"', max: 150 }),
      area('f-about', 'about', 'About your business (optional)', 'Two or three sentences', 4, 800),
      text('f-insp', 'inspiration', { label: 'A website you like (optional)', type: 'url', max: 300 }),
      h('div', { class: 'notice notice-info', role: 'note' }, h('strong', { text: 'Logo and photos' }), h('p', { style: 'margin:4px 0 0', text: 'After you place your order we give you a private page where you can upload your logo and photos. You do not need them to continue.' }))];
  }

  var DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  function stepDomain() {
    var inputs = [0, 1, 2].map(function (i) {
      var v = S.domainChoices[i] || '';
      var bad = v && !DOMAIN_RE.test(v.toLowerCase().replace(/\.co\.ke$/, ''));
      return field('f-dom' + i, i === 0 ? 'Preferred domain name' : 'Alternative ' + i + ' (optional)', h('div', { style: 'display:flex;align-items:center;gap:8px' },
        h('input', { id: 'f-dom' + i, value: v, maxlength: 70, autocapitalize: 'none', spellcheck: 'false', 'aria-invalid': bad ? 'true' : false, oninput: function (e) { var val = e.target.value.trim().toLowerCase(); S.domainChoices[i] = val; save(); var invalid = val && !DOMAIN_OK(val); e.target.setAttribute('aria-invalid', invalid ? 'true' : 'false'); var holder = e.target.closest('.field'); var old = holder.querySelector('.err'); if (old) old.remove(); if (invalid) holder.appendChild(h('span', { class: 'err', role: 'status', text: 'Use letters, numbers and hyphens only.' })); } }), h('span', { text: '.co.ke', style: 'font-weight:700' })),
        i === 0 ? 'Letters, numbers and hyphens, for example kickscorner' : null, bad ? 'Use letters, numbers and hyphens only.' : null);
    });
    return [h('h2', { text: 'Your domain name' }), h('p', { class: 'muted', text: 'Your first-year standard .co.ke domain is included. We register it in your name.' }),
      h('div', { class: 'notice notice-warn', role: 'note' }, h('strong', { text: 'Availability is not checked yet' }), h('p', { style: 'margin:4px 0 0', text: 'We confirm with the registry after you order, and offer alternatives if your first choice is taken. We will never tell you a name is available until it has been checked.' })),
      h('div', { style: 'margin-top:16px' }, inputs),
      check('f-domhelp', 'domainHelp', 'Please suggest a name for me if all of these are taken'),
      text('f-reg', 'registrantName', { label: 'Registrant name (who the domain is registered to)', hint: 'Usually your name or your business name. Leave blank to use your business name. The registry may ask for identity or registration documents later.', max: 140 })];
  }

  function stepReview() {
    var t = tplOf(S.templateId), pk = pkgOf(S.packageId);
    var row = function (k, v) { return h('tr', null, h('td', { text: k }), h('td', { text: v })); };
    var dom = S.domainChoices.filter(Boolean).map(function (d) { return d + '.co.ke'; }).join(', ') || (S.domainHelp ? 'Suggest one for me' : 'Not chosen yet');
    var rows = [row('Design', t ? t.name : '-'), row('Package', pk ? pk.name : '-'), row('Business', S.businessName), row('Contact', Phone.normalizePhone(S.mobile) || S.mobile),
      row('Products', S.addLater ? 'To be added later' : S.products.length + ' added'), row('Domain', dom + ' (availability not yet checked)')];
    var money = pk ? [row('Setup price (first year included)', kes(pk.setupCents)), row('Deposit to start (' + CAT.delivery.depositPercent + '%)', kes(pk.depositCents)), row('Balance before launch', kes(pk.balanceCents)), row('Renewal from year two', kes(pk.renewalCents) + '/year')] : [];
    return [h('h2', { text: 'Review and place your order' }),
      h('table', { class: 'sum', 'aria-label': 'Order summary' }, h('tbody', null, rows)),
      h('h3', { style: 'margin:22px 0 6px', text: 'Price' }), h('table', { class: 'sum', 'aria-label': 'Price summary' }, h('tbody', null, money)),
      h('p', { class: 'muted', style: 'font-size:.9rem', text: 'Any applicable tax is shown on your quote and invoice. Extras are only charged after you approve them.' }),
      h('div', { class: 'notice notice-info', role: 'note', style: 'margin:14px 0' }, h('strong', { text: 'What happens next' }), h('p', { style: 'margin:4px 0 0', text: 'We save your order and give you a private link. We then confirm payment instructions. We only start once your deposit is verified, and your ' + CAT.delivery.slaDays + '-day delivery clock starts when we also have your minimum content. It pauses while we wait for you or the domain registry.' })),
      check('f-consent', 'consent', 'I agree to the terms, including the renewal price and that my domain is registered in my name. (Terms are in draft pending legal review.)'),
      check('f-promo', 'promoConsent', 'Optional: send me occasional news and offers on WhatsApp or SMS.'),
      h('label', { class: 'hp', 'aria-hidden': 'true' }, 'Leave empty', h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', id: 'f-hp' }))];
  }

  var BUILD = [stepDesign, stepPackage, stepBusiness, stepProducts, stepBranding, stepDomain, stepReview];

  // ---------- submit ----------
  function payload() {
    var pk = pkgOf(S.packageId);
    var domains = S.domainChoices.filter(Boolean);
    return { clientRequestId: S.requestId, templateId: S.templateId, packageId: S.packageId, businessName: S.businessName.trim(), ownerName: S.ownerName.trim(), mobile: S.mobile.trim(),
      whatsapp: S.whatsappSame ? '' : S.whatsapp.trim(), email: S.email.trim(), location: S.onlineOnly ? '' : S.location.trim(), onlineOnly: S.onlineOnly, hours: S.hours,
      social: pk && pk.features.social ? S.social : {}, products: S.addLater ? [] : S.products.filter(function (p) { return p.title.trim(); }).map(function (p) { return { title: p.title.trim(), price: p.price ? String(p.price).replace(/[,\s]/g, '') : '', text: p.text || '', category: p.category || '' }; }),
      theme: S.useDefaultColours ? null : { primary: S.primary, accent: S.accent }, tagline: S.tagline, about: S.about, inspiration: S.inspiration, domain: { choices: domains, suggestForMe: S.domainHelp, registrantName: S.registrantName.trim() },
      consent: S.consent, promoConsent: S.promoConsent, website: (document.getElementById('f-hp') || {}).value || '' };
  }
  var statusMsg = '';
  function submit(btn) {
    for (var i = 0; i < STEPS.length; i++) { var e = validateStep(i); if (Object.keys(e).length) { errors = e; S.step = i; statusMsg = 'Please fix the highlighted item first.'; render(); return; } }
    btn.setAttribute('aria-disabled', 'true'); btn.textContent = 'Placing your order...';
    var base = (window.QS && window.QS.apiBase) || '';
    fetch(base + '/api/express-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { statusMsg = (res.j && res.j.error) || 'We could not place the order.'; if (res.j && res.j.details) { errors = res.j.details; var back = stepForErrors(errors); if (back != null) { S.step = back; save(); var first = Object.keys(errors)[0]; statusMsg = errors[first] || statusMsg; } } btn.removeAttribute('aria-disabled'); btn.textContent = 'Place my order'; render(); return; }
        done = res.j;
        try { localStorage.setItem(KEY, JSON.stringify({ v: 1, submitted: true })); var o = JSON.parse(localStorage.getItem('qs-orders') || '[]'); o.push({ ref: done.ref, portalUrl: done.portalUrl, at: Date.now() }); localStorage.setItem('qs-orders', JSON.stringify(o)); } catch (e2) { /* ignore */ }
        render();
      })
      .catch(function () { statusMsg = 'We could not reach the server. Your answers are saved on this phone, so you can try again in a moment.'; btn.removeAttribute('aria-disabled'); btn.textContent = 'Place my order'; render(); });
  }

  function successView() {
    var link = location.origin + done.portalUrl;
    var pay = done.payment || {};
    return [h('div', { class: 'notice notice-ok', role: 'status', tabindex: '-1', id: 'wiz-focus' }, h('strong', { text: 'Your order is placed. Reference ' + done.ref }), h('p', { style: 'margin:4px 0 0', text: 'Status: ' + (done.statusLabel || 'Submitted') + '. Nothing has been charged.' })),
      h('h2', { style: 'margin-top:24px', text: 'Save your private link' }), h('p', { text: 'This link is how you see your order, upload your logo and photos, preview your site and approve it. Anyone with the link can see your order, so keep it private.' }),
      h('div', { class: 'field' }, h('label', { for: 'plink' }, 'Your order link'), h('input', { id: 'plink', readonly: true, value: link, onfocus: function (e) { e.target.select(); } })),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, h('a', { class: 'btn btn-gold', href: done.portalUrl }, 'Open my order page'), h('button', { type: 'button', class: 'btn btn-ghost', onclick: function (e) { var el = document.getElementById('plink'); el.select(); try { navigator.clipboard.writeText(link).then(function () { e.target.textContent = 'Copied'; }); } catch (x) { document.execCommand('copy'); e.target.textContent = 'Copied'; } } }, 'Copy link')),
      h('h2', { style: 'margin:28px 0 8px', text: 'Next: your deposit' }),
      h('div', { class: 'notice notice-warn' }, h('strong', { text: 'Deposit: ' + kes(done.deposit.cents) }), h('p', { style: 'margin:4px 0 0', text: pay.message || 'We will send payment instructions. Work starts once your deposit is verified.' })),
      h('p', { class: 'muted', style: 'margin-top:14px', text: 'Domain: not yet checked. We will confirm availability with the registry and tell you.' })];
  }

  // ---------- render ----------
  function render() {
    var scroll = window.scrollY;
    root.textContent = '';
    if (done) { root.appendChild(h('div', null, successView())); var f = document.getElementById('wiz-focus'); if (f) f.focus(); return; }
    if (resumed && S.step === 0 && !S._dismissResume) {
      root.appendChild(h('div', { class: 'notice notice-info', role: 'note', style: 'margin-bottom:18px' }, h('strong', { text: 'Welcome back' }), h('p', { style: 'margin:4px 0 8px', text: 'We saved your answers on this phone.' }),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } S = blank(); resumed = false; errors = {}; render(); } }, 'Start over')));
    }
    root.appendChild(h('ol', { class: 'wiz-progress', 'aria-label': 'Progress' }, STEPS.map(function (s, i) { return h('li', { class: i < S.step ? 'done' : i === S.step ? 'on' : '', 'aria-current': i === S.step ? 'step' : false }, (i + 1) + '. ' + s); })));
    var summary = Object.keys(errors).length ? h('div', { class: 'notice notice-err', role: 'alert', tabindex: '-1', id: 'wiz-focus', style: 'margin-bottom:16px' }, h('strong', { text: 'Please check this step' }), h('p', { style: 'margin:4px 0 0', text: statusMsg || 'Some answers need attention (shown in red).' })) : (statusMsg ? h('div', { class: 'notice notice-err', role: 'alert', id: 'wiz-focus', tabindex: '-1', style: 'margin-bottom:16px' }, statusMsg) : null);
    root.appendChild(h('div', { class: 'wiz-step' }, summary, BUILD[S.step]()));
    var last = S.step === STEPS.length - 1;
    var back = S.step > 0 ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { errors = {}; statusMsg = ''; S.step--; save(); render(); window.scrollTo(0, 0); } }, 'Back') : h('span');
    var next = h('button', { type: 'button', class: 'btn btn-gold', onclick: function (e) {
      if (last) { errors = validateStep(S.step); if (Object.keys(errors).length) { statusMsg = ''; render(); return; } statusMsg = ''; submit(e.currentTarget); return; }
      errors = validateStep(S.step); statusMsg = ''; if (Object.keys(errors).length) { render(); var fe = document.getElementById('wiz-focus'); if (fe) fe.focus(); return; }
      S.step++; save(); render(); window.scrollTo(0, 0); } }, last ? 'Place my order' : 'Continue');
    root.appendChild(h('div', { class: 'wiz-nav' }, back, next));
    root.appendChild(h('p', { class: 'muted', style: 'margin-top:14px;font-size:.88rem', text: 'Your answers are saved on this device as you go.' }));
    var focus = document.getElementById('wiz-focus'); if (focus && Object.keys(errors).length) focus.focus(); else window.scrollTo(0, scroll);
  }
  render();
})();
