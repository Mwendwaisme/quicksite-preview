// Customer portal. Reached through a private link: /account/#/<order ref>/<secret>. The secret lives in the URL
// fragment (never sent to the server in the page request) and is sent only as an X-Order-Token header.
(function () {
  'use strict';
  var D = QSDom, h = D.h;
  var root = document.getElementById('app');
  var ref = '', token = '', V = null, tab = 'overview', draft = null, saving = false;
  var STAGES = ['draft', 'submitted', 'awaiting_deposit', 'deposit_confirmed', 'awaiting_content', 'ready_for_production', 'building', 'qa', 'client_review', 'approved', 'balance_due', 'deployment_scheduled', 'live'];
  var GROUP = ['Order', 'Deposit', 'Content', 'Build', 'Review', 'Launch'];
  function stageIndex(s) {
    var map = { draft: 0, submitted: 0, awaiting_deposit: 1, deposit_confirmed: 1, awaiting_content: 2, ready_for_production: 2, building: 3, qa: 3, revision_requested: 3, client_review: 4, approved: 4, balance_due: 5, deployment_scheduled: 5, live: 6, support: 6 };
    return map[s] == null ? 0 : map[s];
  }

  function parse() {
    var m = /^#\/([A-Za-z0-9-]+)\/([A-Za-z0-9_-]+)$/.exec(location.hash);
    if (m) { ref = m[1]; token = m[2]; try { sessionStorage.setItem('qs-token-' + ref, token); } catch (e) { /* ignore */ } return true; }
    return false;
  }
  function hdr() { return { 'X-Order-Token': token }; }
  function load(keepTab) {
    return D.api('GET', '/api/portal/orders/' + encodeURIComponent(ref), { headers: hdr() }).then(function (r) {
      if (!r.ok) { V = null; renderError(r); return; }
      V = r.data; if (!keepTab) tab = 'overview'; render();
    });
  }
  function renderError(r) {
    D.clear(root);
    root.appendChild(h('div', { class: 'panel' }, h('h1', { text: r.status === 404 ? 'We could not open that order' : 'Something went wrong' }),
      h('p', { text: r.status === 404 ? 'The link may be incomplete or mistyped. Please open the full link we gave you, or paste it below.' : D.errText(r) }), finder()));
  }
  function finder() {
    var saved = []; try { saved = JSON.parse(localStorage.getItem('qs-orders') || '[]'); } catch (e) { saved = []; }
    var inp = h('input', { id: 'paste', placeholder: 'Paste your order link here', autocomplete: 'off' });
    return h('div', null,
      h('div', { class: 'field' }, h('label', { for: 'paste' }, 'Your order link'), inp),
      h('button', { class: 'btn btn-navy', type: 'button', onclick: function () { var m = /#\/([A-Za-z0-9-]+\/[A-Za-z0-9_-]+)/.exec(inp.value); if (m) { location.hash = '#/' + m[1]; } else D.toast('That does not look like an order link.', 'err'); } }, 'Open my order'),
      saved.length ? h('div', { style: 'margin-top:20px' }, h('h3', { text: 'Orders on this device' }), h('ul', null, saved.map(function (o) { return h('li', null, h('a', { href: o.portalUrl, text: o.ref })); }))) : null);
  }

  function nav() {
    var tabs = [['overview', 'Overview'], ['content', 'Your content'], ['preview', 'Preview'], ['payments', 'Payments'], ['domain', 'Domain'], ['help', 'Help']];
    return h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Order sections' }, tabs.map(function (t) {
      var badge = null;
      if (t[0] === 'preview' && V.preview) badge = ' ●'; if (t[0] === 'payments' && V.payNow) badge = ' ●'; if (t[0] === 'content' && !V.checklist.complete) badge = ' ●';
      return h('button', { role: 'tab', 'aria-selected': String(tab === t[0]), onclick: function () { tab = t[0]; render(); window.scrollTo(0, 0); } }, t[1], badge ? h('span', { 'aria-label': ' needs attention', style: 'color:var(--gold-dark)', text: badge }) : null);
    }));
  }

  // ---------- Overview ----------
  function nextAction() {
    if (V.payNow) return { title: 'Pay ' + V.payNow.outstanding, text: V.payNow.kind === 'deposit' ? 'Your deposit starts the work.' : 'Your final balance lets us publish.', go: 'payments', label: 'See how to pay' };
    if (V.preview) return { title: 'Your preview is ready', text: 'Look at it on your phone, then approve it or ask for changes.', go: 'preview', label: 'Open the preview' };
    if (!V.checklist.complete) return { title: 'We need ' + V.checklist.missing.length + ' more thing' + (V.checklist.missing.length > 1 ? 's' : ''), text: V.checklist.missing.map(function (m) { return m.label; }).join(', '), go: 'content', label: 'Add your details' };
    if (V.liveUrl) return { title: 'Your website is live', text: V.liveUrl, go: null, label: null, link: V.liveUrl };
    return null;
  }
  function overview() {
    var idx = stageIndex(V.status), na = nextAction();
    var out = [];
    out.push(h('div', { class: 'panel' },
      h('div', { class: 'inline', style: 'justify-content:space-between' }, h('div', null, h('span', { class: 'muted small', text: 'Order ' + V.ref + ' · ' + V.package.name + ' · ' + V.template.name }), h('h1', { style: 'font-size:1.7rem;margin-top:4px', text: V.statusLabel })),
        D.badge(V.nextActionBy === 'client' ? 'Your turn' : V.nextActionBy === 'quicksite' ? 'Our turn' : 'Closed', V.nextActionBy === 'client' ? 'gold' : 'blue')),
      h('p', { style: 'margin-top:8px', text: V.statusText }),
      h('div', { class: 'stages', role: 'img', 'aria-label': 'Progress: step ' + (Math.min(idx, 5) + 1) + ' of 6, ' + GROUP[Math.min(idx, 5)] }, GROUP.map(function (g, i) { return h('i', { class: i < idx ? 'done' : i === idx ? 'now' : '', title: g }); })),
      h('div', { class: 'small muted inline', style: 'justify-content:space-between' }, GROUP.map(function (g) { return h('span', { text: g }); }))));
    if (na) out.push(h('div', { class: 'panel', style: 'border:2px solid var(--gold)' }, h('h2', { text: na.title }), h('p', { class: 'muted', text: na.text }),
      na.go ? h('button', { class: 'btn btn-gold', type: 'button', onclick: function () { tab = na.go; render(); window.scrollTo(0, 0); } }, na.label) : h('a', { class: 'btn btn-gold', href: na.link, rel: 'noopener', target: '_blank' }, 'Visit your website')));
    var c = V.clock;
    out.push(h('div', { class: 'panel' }, h('h3', { text: 'Your ' + 7 + '-day delivery clock' }),
      h('p', null, D.badge(c.state === 'not_started' ? 'Not started' : c.state === 'running' ? 'Running' : c.state === 'paused' ? 'Paused' : 'Done', c.state === 'running' ? 'green' : c.state === 'paused' ? 'gold' : 'grey'), ' ', c.note),
      c.deadline ? h('dl', { class: 'kv' }, h('dt', { text: 'Started' }), h('dd', { text: c.startedAt || '' }), h('dt', { text: c.state === 'stopped' ? 'Delivered' : 'Target date' }), h('dd', { text: c.deadline }), c.remainingDays != null && c.state !== 'stopped' ? [h('dt', { text: 'Days left' }), h('dd', { text: String(c.remainingDays) })] : null) : null));
    out.push(h('div', { class: 'panel' }, h('h3', { text: 'What has happened' }), V.timeline.length ? h('ol', { class: 'timeline' }, V.timeline.slice().reverse().map(function (t) { return h('li', null, h('strong', { text: t.label }), h('div', { class: 'muted small', text: t.at })); })) : h('p', { class: 'muted', text: 'Nothing yet.' })));
    out.push(h('div', { class: 'panel' }, h('h3', { text: 'Your package: ' + V.package.name }),
      h('dl', { class: 'kv' }, h('dt', { text: 'Setup price' }), h('dd', { text: V.price.setup + ' (first year included)' }), h('dt', { text: 'Deposit / balance' }), h('dd', { text: V.price.deposit + ' / ' + V.price.balance }), h('dt', { text: 'Renewal from year two' }), h('dd', { text: V.price.renewal + ' a year' }),
        h('dt', { text: 'Changes included' }), h('dd', { text: V.revisions.included + ' round' + (V.revisions.included === 1 ? '' : 's') + ' (' + V.revisions.left + ' left)' })),
      h('ul', { class: 'checks', style: 'margin-top:12px' }, V.price.firstYearIncludes.map(function (x) { return h('li', { text: x }); })),
      h('p', { class: 'muted small', text: V.price.renewalScope.note })));
    return out;
  }

  // ---------- Content ----------
  function contentTab() {
    var c = draft || JSON.parse(JSON.stringify(V.content));
    draft = c;
    c.products = c.products || []; c.social = c.social || {}; c.domain = c.domain || { choices: [] };
    var out = [];
    out.push(h('div', { class: 'panel' }, h('h2', { text: 'Checklist' }), h('p', { class: 'muted', text: V.checklist.done + ' of ' + V.checklist.total + ' required items done. Your delivery clock starts when all required items are in.' }),
      h('ul', { class: 'cl' }, V.checklist.missing.map(function (m) { return h('li', null, h('span', { class: 'no', 'aria-hidden': 'true', text: '✗' }), h('span', null, h('span', { class: 'vh', text: 'Missing: ' }), m.label)); })
        .concat(V.checklist.recommended.map(function (m) { return h('li', null, h('span', { class: 'opt', 'aria-hidden': 'true', text: '○' }), h('span', { class: 'muted' }, h('span', { class: 'vh', text: 'Recommended: ' }), m.label + ' (recommended)')); }))
        .concat(V.checklist.missing.length === 0 ? [h('li', null, h('span', { class: 'ok', 'aria-hidden': 'true', text: '✓' }), h('span', { text: 'All required items are complete.' }))] : []))));

    var errBox = h('div', { class: 'notice notice-err', role: 'alert', hidden: true, tabindex: '-1', id: 'save-err' });
    function txt(key, label, o) { o = o || {}; return D.field('c-' + key, label, h('input', { id: 'c-' + key, value: c[key] || '', maxlength: o.max || 160, oninput: function (e) { c[key] = e.target.value; } }), o.hint); }
    var about = D.field('c-about', 'About your business', h('textarea', { id: 'c-about', rows: 3, maxlength: 800, oninput: function (e) { c.about = e.target.value; } }, c.about || ''));
    var hours = D.field('c-hours', 'Opening hours', h('textarea', { id: 'c-hours', rows: 3, maxlength: 300, oninput: function (e) { c.hours = e.target.value; } }, c.hours || ''), 'One line per day or range, for example "Mon-Sat 8am-6pm"');
    var soc = V.package.features.social
      ? h('div', { class: 'row2' }, ['instagram', 'facebook', 'tiktok'].map(function (k) { return D.field('c-s-' + k, k.charAt(0).toUpperCase() + k.slice(1) + ' link', h('input', { id: 'c-s-' + k, value: c.social[k] || '', maxlength: 200, oninput: function (e) { c.social[k] = e.target.value; } })); }))
      : h('p', { class: 'muted', text: 'Social links come with Duka Plus and above. See the Help tab if you would like to upgrade.' });

    function productRows() {
      var limit = V.package.limits.products, n = c.products.length, full = n >= limit;
      var rows = c.products.map(function (p, i) {
        function f(key, label, o) { o = o || {}; return h('div', null, h('label', { for: 'p' + i + key, text: label }), h('input', { id: 'p' + i + key, value: p[key] || '', maxlength: o.max || 120, inputmode: o.inputmode, oninput: function (e) { p[key] = e.target.value; } })); }
        var extra = V.package.features.categories ? f('category', 'Category', { max: 40 }) : null;
        return h('div', { class: 'prod-row' }, f('title', 'Name'), f('price', 'Price (KSh)', { inputmode: 'decimal', max: 12 }), f('text', 'Description (optional)', { max: 200 }), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Remove ' + (p.title || 'item ' + (i + 1)), onclick: function () { c.products.splice(i, 1); render(); } }, 'Remove'), extra);
      });
      return h('div', null,
        h('div', { class: 'meter' + (n > limit ? ' full' : ''), role: 'img', 'aria-label': n + ' of ' + limit + ' used' }, h('i', { style: 'width:' + Math.min(100, Math.round(n / limit * 100)) + '%' })),
        h('p', { class: 'muted small', text: n + ' of ' + limit + ' products or services used on ' + V.package.name }), rows,
        h('div', { class: 'inline' }, h('button', { class: 'btn btn-navy btn-sm', type: 'button', 'aria-disabled': full ? 'true' : false, onclick: function () { if (full) { D.toast(V.package.name + ' includes ' + limit + '. See the Help tab to upgrade or ask for extra products.', 'err'); return; } c.products.push({ title: '', price: '', text: '' }); render(); } }, 'Add a product'),
          full ? h('span', { class: 'muted small', text: 'Limit reached. Upgrade or ask for extra products as a quoted extra.' }) : null));
    }
    out.push(h('form', { class: 'panel', novalidate: true, onsubmit: function (e) { e.preventDefault(); save(errBox); } },
      h('h2', { text: 'Your business details' }), errBox,
      h('div', { class: 'row2' }, txt('businessName', 'Business name', { max: 120 }), txt('ownerName', 'Your name', { max: 100 })),
      h('div', { class: 'row2' }, txt('mobile', 'Mobile number', { hint: 'For example 0712 345 678', max: 30 }), txt('email', 'Email (optional)', { max: 160 })),
      txt('location', 'Where are you?', { hint: 'Area and landmark', max: 200 }),
      h('div', { class: 'check' }, h('input', { id: 'c-online', type: 'checkbox', checked: !!c.onlineOnly, onchange: function (e) { c.onlineOnly = e.target.checked; } }), h('label', { for: 'c-online', text: 'I trade online only (no shop or stall to show)' })),
      hours, txt('tagline', 'Tagline', { hint: 'One short line under your business name', max: 150 }), about,
      h('h3', { style: 'margin:18px 0 8px', text: 'What you sell or offer' }), productRows(),
      h('h3', { style: 'margin:18px 0 8px', text: 'Social media' }), soc,
      h('h3', { style: 'margin:18px 0 8px', text: 'Domain names' }), h('p', { class: 'muted small', text: 'Up to three names, without .co.ke. Availability is checked with the registry by our team.' }),
      [0, 1, 2].map(function (i) { var d = c.domain; d.choices = d.choices || []; return D.field('c-d' + i, i === 0 ? 'Preferred name' : 'Alternative ' + i, h('input', { id: 'c-d' + i, value: d.choices[i] || '', maxlength: 70, autocapitalize: 'none', oninput: function (e) { d.choices[i] = e.target.value.trim().toLowerCase(); } })); }),
      h('div', { class: 'check' }, h('input', { id: 'c-dh', type: 'checkbox', checked: !!c.domain.suggestForMe, onchange: function (e) { c.domain.suggestForMe = e.target.checked; } }), h('label', { for: 'c-dh', text: 'Suggest a name for me if mine are taken' })),
      h('button', { class: 'btn btn-gold', type: 'submit', 'aria-disabled': saving ? 'true' : false }, saving ? 'Saving...' : 'Save my details')));
    out.push(uploads());
    return out;
  }

  function save(errBox) {
    if (saving) return;
    saving = true;
    var c = draft;
    var body = { businessName: c.businessName, ownerName: c.ownerName, mobile: c.mobile, whatsapp: c.whatsapp, email: c.email, location: c.location, onlineOnly: !!c.onlineOnly, hours: c.hours, tagline: c.tagline, about: c.about, social: c.social,
      products: (c.products || []).filter(function (p) { return (p.title || '').trim(); }), addLater: false, domain: { choices: (c.domain.choices || []).filter(Boolean), suggestForMe: !!c.domain.suggestForMe, registrantName: c.domain.registrantName || '' } };
    D.api('PATCH', '/api/portal/orders/' + ref + '/content', { json: body, headers: hdr() }).then(function (r) {
      saving = false;
      if (r.ok) { V = r.data; draft = null; D.toast('Saved. Thank you.'); render(); return; }
      // Rejected (for example a package limit): keep everything the customer typed and explain, with the upgrade path.
      var d = r.data || {}; var msgs = d.details ? Object.keys(d.details).map(function (k) { return d.details[k]; }) : [d.error || 'We could not save that.'];
      render();
      var box = document.getElementById('save-err'); if (box) { D.clear(box); box.appendChild(h('strong', { text: 'We could not save yet. Nothing you typed has been lost.' })); msgs.forEach(function (m) { box.appendChild(h('p', { style: 'margin:4px 0 0', text: m })); });
        if (d.violations && d.violations[0] && d.violations[0].requiredPackage) box.appendChild(h('p', { style: 'margin:8px 0 0' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () { tab = 'help'; render(); } }, 'See upgrade options')));
        box.hidden = false; box.focus(); }
    });
  }

  function uploads() {
    var photoLimit = V.package.limits.galleryImages;
    function pick(kind) {
      var inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': kind === 'logo' ? 'Choose your logo' : 'Choose a photo', onchange: function (e) {
        var f = e.target.files[0]; if (!f) return;
        if (f.size > 3 * 1024 * 1024) { D.toast('That image is bigger than 3 MB. Please choose a smaller one.', 'err'); return; }
        D.toast('Uploading...');
        fetch('/api/portal/orders/' + ref + '/media?kind=' + kind + '&name=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'X-Order-Token': token, 'Content-Type': f.type }, body: f })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) { if (res.ok) { V = res.j; D.toast('Uploaded.'); render(); } else D.toast((res.j.details && res.j.details.photos) || res.j.error || 'Upload failed.', 'err'); })
          .catch(function () { D.toast('Upload failed. Check your connection.', 'err'); });
      } });
      return inp;
    }
    var logo = V.assets.filter(function (a) { return a.kind === 'logo'; })[0];
    var photos = V.assets.filter(function (a) { return a.kind !== 'logo'; });
    function fig(a) { return h('figure', null, h('img', { src: a.url, alt: a.kind === 'logo' ? 'Your logo' : 'Uploaded photo', width: 130, height: 130 }), h('figcaption', null, h('span', { class: 'small', text: a.width + '×' + a.height }), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Remove this file', onclick: function () { D.api('DELETE', '/api/portal/orders/' + ref + '/media/' + a.id, { headers: hdr() }).then(function (r) { if (r.ok) { V = r.data; render(); } else D.toast(D.errText(r), 'err'); }); } }, 'Remove'))); }
    return h('div', { class: 'panel' }, h('h2', { text: 'Logo and photos' }), h('p', { class: 'muted small', text: 'JPEG, PNG or WebP, up to 3 MB each. Location data is removed from your pictures. Files stay private until your site is published.' }),
      h('h3', { text: 'Logo' }), logo ? h('div', { class: 'thumb-grid' }, fig(logo)) : h('p', { class: 'muted small', text: 'No logo yet. We will use your business name as text if you skip this.' }), h('div', { class: 'field', style: 'margin-top:10px' }, h('label', { text: logo ? 'Replace your logo' : 'Add your logo' }), pick('logo')),
      h('h3', { style: 'margin-top:18px', text: 'Photos' }),
      photoLimit === 0 ? h('div', { class: 'notice notice-info' }, h('strong', { text: 'Photo gallery not in your package' }), h('p', { style: 'margin:4px 0 0', text: V.package.name + ' does not include a gallery. Duka Plus and above do. See the Help tab if you would like to upgrade.' }))
        : [h('p', { class: 'muted small', text: photos.length + ' of ' + photoLimit + ' photos used' }), photos.length ? h('div', { class: 'thumb-grid' }, photos.map(fig)) : null, h('div', { class: 'field', style: 'margin-top:10px' }, h('label', { text: 'Add a photo' }), pick('photo'))]);
  }

  // ---------- Preview ----------
  function previewTab() {
    if (!V.preview) {
      return [h('div', { class: 'panel' }, h('h2', { text: 'Preview' }), V.liveUrl ? h('p', null, 'Your website is live: ', h('a', { href: V.liveUrl, target: '_blank', rel: 'noopener', text: V.liveUrl })) : h('p', { class: 'muted', text: 'No preview is waiting for you right now. We will message you when it is ready, and it will appear here.' }), h('p', { class: 'muted small', text: 'Status: ' + V.statusLabel }))];
    }
    var mobile = true;
    var frame = h('iframe', { class: 'preview-box mobile', src: V.preview.url, title: 'Preview of your website', sandbox: 'allow-scripts allow-forms' });
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Preview size' },
      h('button', { type: 'button', 'aria-pressed': 'true', onclick: function (e) { frame.className = 'preview-box mobile'; seg.children[0].setAttribute('aria-pressed', 'true'); seg.children[1].setAttribute('aria-pressed', 'false'); } }, 'Phone'),
      h('button', { type: 'button', 'aria-pressed': 'false', onclick: function () { frame.className = 'preview-box'; seg.children[0].setAttribute('aria-pressed', 'false'); seg.children[1].setAttribute('aria-pressed', 'true'); } }, 'Computer'));
    var comment = h('textarea', { id: 'rv', rows: 4, maxlength: 2000, placeholder: 'Describe what you would like changed' });
    var msg = h('div', { role: 'alert', class: 'notice notice-err', hidden: true, tabindex: '-1' });
    function act(path, body, ok) { D.api('POST', '/api/portal/orders/' + ref + path, { json: body, headers: hdr() }).then(function (r) { if (r.ok) { V = r.data; D.toast(ok); tab = 'overview'; render(); window.scrollTo(0, 0); } else { D.clear(msg); msg.appendChild(h('strong', { text: D.errText(r) })); msg.hidden = false; msg.focus(); } }); }
    var sure = h('input', { id: 'sure', type: 'checkbox' });
    return [h('div', { class: 'panel' }, h('h2', { text: 'Review your website' }), h('p', { class: 'muted', text: 'This is a private preview made only for you. Your delivery clock is paused while you review.' }), h('div', { style: 'margin:12px 0' }, seg), frame),
      msg,
      h('div', { class: 'panel' }, h('h3', { text: 'Happy with it?' }), h('div', { class: 'check' }, sure, h('label', { for: 'sure', text: 'I have looked at the whole site on my phone and I approve this design. I understand the final balance of ' + V.price.balance + ' is then due.' })),
        h('button', { class: 'btn btn-gold', type: 'button', onclick: function () { if (!sure.checked) { D.toast('Please tick the box to confirm.', 'err'); return; } act('/approve', { buildNo: V.preview.buildNo, comment: 'Approved by customer' }, 'Thank you. Your approval is recorded.'); } }, 'Approve my website')),
      h('div', { class: 'panel' }, h('h3', { text: 'Want changes?' }), h('p', { class: 'muted small', text: V.revisions.left + ' round' + (V.revisions.left === 1 ? '' : 's') + ' of changes left in your package. Put all your changes in one message.' }), D.field('rv', 'What should we change?', comment),
        h('button', { class: 'btn btn-navy', type: 'button', onclick: function () { act('/revision', { buildNo: V.preview.buildNo, comment: comment.value }, 'Thank you. We are making your changes.'); } }, 'Send my changes'))];
  }

  // ---------- Payments ----------
  function paymentsTab() {
    var out = [];
    var pm = V.paymentMode;
    out.push(h('div', { class: 'panel' }, h('h2', { text: 'Payments' }), h('p', { class: 'muted', text: 'We only start work, and only publish your site, once a payment has been verified. A screenshot or message alone is not enough. We check every payment.' })));
    if (V.payNow) {
      var code = h('input', { id: 'code', maxlength: 14, autocapitalize: 'characters', autocomplete: 'off', placeholder: 'For example QGH7XYZ123' });
      var phone = h('input', { id: 'pphone', type: 'tel', inputmode: 'tel', value: V.content.mobile || '', maxlength: 30 });
      var err = h('div', { class: 'notice notice-err', role: 'alert', hidden: true, tabindex: '-1' });
      function fail(r) { D.clear(err); err.appendChild(h('strong', { text: D.errText(r) })); err.hidden = false; err.focus(); }
      var panel = [h('h3', { text: 'Pay ' + V.payNow.outstanding + ' (' + (V.payNow.kind === 'deposit' ? 'deposit' : 'final balance') + ', invoice ' + V.payNow.number + ')' }),
        h('div', { class: 'notice notice-' + (pm === 'sandbox' ? 'warn' : 'info'), role: 'note' }, h('strong', { text: pm === 'sandbox' ? 'Sandbox mode' : 'How to pay' }), h('p', { style: 'margin:4px 0 0', text: V.paymentInstructions.message })), err];
      if (pm === 'sandbox' || pm === 'mpesa') {
        panel.push(D.field('pphone', 'Safaricom number to pay from', phone), h('button', { class: 'btn btn-gold', type: 'button', onclick: function () { D.api('POST', '/api/portal/orders/' + ref + '/payments/stk', { json: { invoiceId: V.payNow.invoiceId, phone: phone.value, idempotencyKey: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '-' + V.payNow.invoiceId.slice(0, 8) }, headers: hdr() }).then(function (r) { if (r.ok) { V = r.data; D.toast(pm === 'sandbox' ? 'Sandbox prompt created (no real money).' : 'Check your phone for the M-Pesa prompt.'); render(); } else fail(r); }); } }, pm === 'sandbox' ? 'Create a sandbox prompt' : 'Send M-Pesa prompt to my phone'));
      }
      panel.push(h('h3', { style: 'margin-top:20px', text: 'Already paid? Tell us your transaction code' }), h('p', { class: 'muted small', text: 'Find the code in your M-Pesa confirmation message. We will verify it against our records.' }), D.field('code', 'M-Pesa transaction code', code), D.field('pphone', 'Phone you paid from (optional)', phone),
        h('button', { class: 'btn btn-navy', type: 'button', onclick: function () { D.api('POST', '/api/portal/orders/' + ref + '/payments/claim', { json: { invoiceId: V.payNow.invoiceId, reference: code.value, phone: phone.value }, headers: hdr() }).then(function (r) { if (r.ok) { V = r.data; D.toast('Thank you. We will verify it and update this page.'); render(); } else fail(r); }); } }, 'Submit my code'));
      out.push(h('div', { class: 'panel', style: 'border:2px solid var(--gold)' }, panel));
    } else out.push(h('div', { class: 'notice notice-ok', role: 'note' }, h('strong', { text: 'Nothing to pay right now.' })));
    out.push(h('div', { class: 'panel' }, h('h3', { text: 'Invoices and payments' }), V.invoices.length ? V.invoices.map(function (i) {
      return h('div', { style: 'border-top:1px solid var(--line);padding:12px 0' }, h('div', { class: 'inline', style: 'justify-content:space-between' }, h('strong', { text: i.number + ' · ' + (i.kind === 'deposit' ? 'Deposit' : 'Final balance') }), D.badge(i.status === 'paid' ? 'Paid' : i.status === 'partially_paid' ? 'Part paid' : 'Unpaid', i.status === 'paid' ? 'green' : 'gold')),
        h('div', { class: 'muted small', text: 'Total ' + i.total + (i.status !== 'paid' ? ' · Outstanding ' + i.outstanding : '') + ' · Due ' + i.dueAt }),
        i.payments.length ? h('ul', { class: 'small', style: 'margin-top:6px' }, i.payments.map(function (p) { return h('li', { text: p.at + ': ' + p.amount + (p.reference ? ' (' + p.reference + ')' : '') + ' — ' + p.label }); })) : null);
    }) : h('p', { class: 'muted', text: 'No invoices yet.' })));
    out.push(h('div', { class: 'panel' }, h('h3', { text: 'Renewal in plain words' }), h('p', { text: 'From year two, ' + V.price.renewal + ' a year covers: ' + V.price.renewalScope.covers.join('; ').toLowerCase() + '. We remind you ' + V.price.renewalNoticeDays.join(', ') + ' days before it is due.' }), h('p', { class: 'muted small', text: 'Not included in renewal: ' + V.price.renewalScope.doesNotCover.join('; ').toLowerCase() + '.' })));
    return out;
  }

  // ---------- Domain ----------
  function domainTab() {
    return [h('div', { class: 'panel' }, h('h2', { text: 'Your domain' }), h('p', { class: 'muted', text: 'Your first-year .co.ke domain is included and is registered in your name. We never say a name is available until we have checked with the registry.' }),
      V.domains.length ? D.table([{ label: 'Name', key: 'name' }, { label: 'Availability', key: 'availability' }, { label: 'HTTPS', key: 'https' }, { label: 'Expires', render: function (d) { return d.expires || 'Not registered yet'; } }], V.domains, { label: 'Domains' }) : h('p', { class: 'muted', text: 'No domain names yet. Add up to three on the "Your content" tab.' })),
      h('div', { class: 'panel' }, h('h3', { text: 'What the stages mean' }), h('ul', { class: 'checks' }, ['Not yet checked: we have your request but have not asked the registry yet.', 'Available: the registry says the name is free. We will register it in your name.', 'HTTPS "Active": we have confirmed your site opens securely.'].map(function (x) { return h('li', { text: x }); })),
        h('p', { class: 'muted small', style: 'margin-top:10px', text: 'You own your domain. If you ever want a handover or transfer, ask from the Help tab and we will give you the steps.' }))];
  }

  // ---------- Help ----------
  function helpTab() {
    var kind = h('select', { id: 'hk' }, h('option', { value: 'support' }, 'A question or problem'), h('option', { value: 'change_request' }, 'A change to my live website'), h('option', { value: 'upgrade' }, 'I want to upgrade or add something bigger'));
    var subj = h('input', { id: 'hs', maxlength: 140 }), body = h('textarea', { id: 'hb', rows: 4, maxlength: 3000 });
    var err = h('div', { class: 'notice notice-err', role: 'alert', hidden: true, tabindex: '-1' });
    var list = h('div', null, h('p', { class: 'muted', text: 'Loading your messages...' }));
    D.api('GET', '/api/portal/orders/' + ref + '/messages', { headers: hdr() }).then(function (r) {
      D.clear(list);
      if (!r.ok || !r.data.length) { list.appendChild(h('p', { class: 'muted', text: 'No messages yet.' })); return; }
      r.data.forEach(function (t) { list.appendChild(h('div', { style: 'border-top:1px solid var(--line);padding:10px 0' }, h('strong', { text: t.subject }), ' ', D.badge(t.status.replace('_', ' '), 'grey'), t.messages.map(function (m) { return h('p', { class: 'small', style: 'margin:4px 0 0' }, h('span', { class: 'muted', text: (m.author_type === 'client' ? 'You' : 'QuickSite') + ' · ' + D.dateTime(m.at) + ': ' }), m.body); }))); });
    });
    var out = [h('div', { class: 'panel' }, h('h2', { text: 'Send us a message' }), err, D.field('hk', 'What is it about?', kind), D.field('hs', 'Subject', subj), D.field('hb', 'Message', body),
      h('button', { class: 'btn btn-gold', type: 'button', onclick: function () { D.api('POST', '/api/portal/orders/' + ref + '/messages', { json: { kind: kind.value, subject: subj.value, message: body.value }, headers: hdr() }).then(function (r) { if (r.ok) { D.toast('Message sent. We will reply here.'); render(); } else { D.clear(err); err.appendChild(h('strong', { text: D.errText(r) })); err.hidden = false; err.focus(); } }); } }, 'Send message')),
      h('div', { class: 'panel' }, h('h3', { text: 'Your messages' }), list)];
    var up = V.upgradeOptions;
    out.push(h('div', { class: 'panel' }, h('h3', { text: 'Want more?' }), up.next.length ? h('p', null, 'You can move to a bigger package: ' + up.next.map(function (p) { return p.name + ' (' + p.setup + ')'; }).join(', ') + '. Choose "upgrade" above and tell us what you need.') : null,
      h('p', null, 'For online checkout, logins, a booking system or anything custom, ', h('a', { href: up.customQuote, text: 'request a custom quote' }), '.')));
    if (V.canCancel) out.push(h('div', { class: 'panel' }, h('h3', { text: 'Cancel this order' }), h('p', { class: 'muted small', text: 'You can cancel before work has started. Refund terms for any payment already verified are being finalised, so contact us first if you have paid.' }),
      h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: function () { if (D.confirmAction('Cancel this order? This cannot be undone here.')) D.api('POST', '/api/portal/orders/' + ref + '/cancel', { json: {}, headers: hdr() }).then(function (r) { if (r.ok) { V = r.data; D.toast('Order cancelled.'); render(); } else D.toast(D.errText(r), 'err'); }); } }, 'Cancel my order')));
    return out;
  }

  function render() {
    var scroll = window.scrollY;
    D.clear(root);
    document.title = 'Order ' + V.ref + ' | QuickSite';
    document.getElementById('who').textContent = V.content.businessName || V.ref;
    root.appendChild(nav());
    var body = { overview: overview, content: contentTab, preview: previewTab, payments: paymentsTab, domain: domainTab, help: helpTab }[tab]();
    root.appendChild(h('div', { role: 'tabpanel' }, body));
    window.scrollTo(0, scroll);
  }

  (function () { var bar = document.querySelector('.app-bar .in'); if (bar) bar.insertBefore(D.themeButton(), bar.lastElementChild); })();
  function boot() {
    if (!parse()) {
      D.clear(root);
      root.appendChild(h('div', { class: 'panel narrow' }, h('h1', { text: 'Your QuickSite order' }), h('p', { class: 'muted', text: 'Open the private link we gave you when you placed your order. It looks like quicksite.co.ke/account/#/QX-... Keep that link private.' }), finder()));
      return;
    }
    draft = null; load(false);
  }
  window.addEventListener('hashchange', boot);
  boot();
})();
