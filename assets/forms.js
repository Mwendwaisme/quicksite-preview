// Quote and contact forms: validate, post JSON to the API, show real success or real errors. No fake "sent".
(function () {
  'use strict';
  document.querySelectorAll('form[data-api]').forEach(function (form) {
    var summary = form.querySelector('[data-error-summary]');
    var status = form.querySelector('[data-status]');
    var base = (window.QS && window.QS.apiBase) || '';
    var button = form.querySelector('button[type=submit]');

    function clear() {
      form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
      form.querySelectorAll('.err').forEach(function (el) { el.remove(); });
      if (summary) { summary.hidden = true; summary.textContent = ''; }
      if (status) status.textContent = '';
    }
    function show(errors) {
      var names = Object.keys(errors || {});
      names.forEach(function (n) {
        var el = form.elements[n]; if (!el) return;
        el.setAttribute('aria-invalid', 'true');
        var holder = el.closest('.field') || el.closest('.check') || el.parentNode;
        var s = document.createElement('span'); s.className = 'err'; s.textContent = errors[n]; holder.appendChild(s);
      });
      if (summary) {
        summary.hidden = false; summary.textContent = '';
        var b = document.createElement('strong'); b.textContent = 'Please check the highlighted fields'; summary.appendChild(b);
        var ul = document.createElement('ul'); names.forEach(function (n) { var li = document.createElement('li'); li.textContent = errors[n]; ul.appendChild(li); }); summary.appendChild(ul);
        summary.focus();
      }
    }
    function collect() {
      var out = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if (el.type === 'checkbox') out[el.name] = el.checked;
        else out[el.name] = el.value;
      });
      return out;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); clear();
      var body = collect(); var local = {};
      if (!String(body.name || '').trim()) local.name = 'Please enter your name.';
      if (form.elements.phone && form.elements.email && !String(body.phone || '').trim() && !String(body.email || '').trim()) local.phone = 'Give us a phone number or an email so we can reply.';
      if (form.elements.category && !body.category) local.category = 'Please choose a project type.';
      if (form.elements.summary && String(body.summary || '').trim().length < 20) local.summary = 'Please describe the project in at least a sentence or two.';
      if (form.elements.message && String(body.message || '').trim().length < 10) local.message = 'Please write a short message.';
      if (!body.consent) local.consent = 'Please agree so we can use your details to reply.';
      if (Object.keys(local).length) { show(local); return; }
      button.setAttribute('aria-disabled', 'true'); button.disabled = true; if (status) status.textContent = 'Sending...';
      fetch(base + form.dataset.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          button.disabled = false; button.removeAttribute('aria-disabled');
          if (!res.ok) { if (res.j && res.j.details) show(res.j.details); else if (status) status.textContent = (res.j && res.j.error) || 'Something went wrong. Please try again.'; return; }
          var box = document.getElementById(form.id.replace('-form', '-success'));
          form.hidden = true;
          if (box) { box.textContent = ''; var t = document.createElement('strong'); t.textContent = 'Thank you. We have your request.'; box.appendChild(t);
            var p = document.createElement('p'); p.style.margin = '6px 0 0'; p.textContent = res.j.message || ('Your reference is ' + res.j.ref + '.'); box.appendChild(p);
            if (res.j.ref) { var r2 = document.createElement('p'); r2.style.margin = '6px 0 0'; r2.textContent = 'Reference: ' + res.j.ref; box.appendChild(r2); }
            box.hidden = false; box.focus(); }
        })
        .catch(function () { button.disabled = false; button.removeAttribute('aria-disabled'); if (status) status.textContent = 'We could not reach the server. Please check your connection and try again. Your text is still here.'; });
    });
  });
})();
