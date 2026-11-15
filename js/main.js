(function () {
'use strict';
var S = window.SITE, T = window.I18N;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
var tgUrl = 'https://t.me/' + S.telegram.replace(/^@/, '');
var lang = 'ua';
var store = function (k, v, ss) { try { var st = ss ? sessionStorage : localStorage; if (v === undefined) return st.getItem(k); st.setItem(k, v); } catch (e) {} };
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function detect() { var s = store('lang'); if (T[s]) return s; var n = (navigator.language || 'uk').toLowerCase(); return n.indexOf('ru') == 0 ? 'ru' : n.indexOf('en') == 0 ? 'en' : 'ua'; }
function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
var arrow = '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>';
/* text slot: data-k="key" [data-i] [data-j] — filled on every language change */
function slot(tag, k, i, j, cls) { return '<' + tag + (cls ? ' class="' + cls + '"' : '') + ' data-k="' + k + '"' + (i != null ? ' data-i="' + i + '"' : '') + (j != null ? ' data-j="' + j + '"' : '') + '></' + tag + '>'; }

/* ---------- static content from config ---------- */
$('#brandText').textContent = S.brand;
$('#copyName').textContent = S.name;
$('#yr').textContent = new Date().getFullYear();
$('#techList').innerHTML = S.tech.map(function (t, i) { return '<li style="--i:' + i + '">' + esc(t) + '</li>'; }).join('');
$('#fMail').innerHTML = S.email ? '<a href="mailto:' + esc(S.email) + '">' + esc(S.email) + '</a>' : '';
$('#fTg').innerHTML = S.telegram ? '<a data-tg>Telegram: @' + esc(S.telegram) + '</a>' : '';
$('#socials').innerHTML = S.socials.filter(function (x) { return x.url; }).map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.label) + '</a>'; }).join('');

var flowIcons = ['<path d="M5 7h22v18H5zM5 8l11 9L27 8"/>','<circle cx="16" cy="16" r="10"/><path d="M16 2v5M16 25v5M2 16h5M25 16h5M12 13h.01M20 13h.01M12 20h8"/>','<rect x="5" y="4" width="22" height="24" rx="3"/><path d="M10 11h12M10 16h12M10 21h7"/>','<path d="M5 22l7-7 5 4L27 7M19 7h8v8"/>'];
$('#flow').innerHTML = [0, 1, 2, 3].map(function (i) { return '<li style="--i:' + i + '"><button type="button" data-flow-node="' + i + '" aria-pressed="' + (i === 0) + '"><span class="flow-icon"><svg viewBox="0 0 32 32" aria-hidden="true">' + flowIcons[i] + '</svg></span>' + slot('span', 'hero.flow', i) + '<small>0' + (i + 1) + '</small></button></li>'; }).join('');

$('#serviceList').innerHTML = S.services.map(function (s, i) {
  var k = 'svc.' + s.id, id = 'sv-' + s.id;
  return '<article class="sv" data-r style="--d:' + (i % 3) * .08 + 's">' +
    '<div class="sv-image photo-mask"><img src="' + esc(s.image) + '" alt="" width="1000" height="650" loading="lazy" decoding="async"><span class="sv-n">' + esc(s.n) + ' / EXPERTISE</span><a class="sv-arrow" href="/services/' + s.id + '/" aria-label="' + esc(s.id) + '">↗</a></div><div class="sv-body">' + slot('h3', k, 0) + slot('p', k, 1, null, 'sv-d') +
    '<div class="sv-more" id="' + id + '"><div><ul class="ticks" data-list="' + k + '" data-i="2"></ul>' +
    '<a class="link" href="#contact" data-pick="' + s.id + '"><span data-i18n="discuss"></span>' + arrow + '</a></div></div>' +
    '<button class="sv-tog" type="button" aria-expanded="false" aria-controls="' + id + '"><span data-i18n="more"></span><i aria-hidden="true"></i></button>' +
    '</div></article>';
}).join('');

$('#steps').innerHTML = [0, 1, 2, 3].map(function (i) {
  return '<li style="--i:' + i + '"><span class="st-n">0' + (i + 1) + '</span>' + slot('h3', 'proc', i, 0) + slot('p', 'proc', i, 1) + '</li>';
}).join('');

$('#track').innerHTML = S.projects.map(function (p, i) {
  var bg = p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async">' : '<i style="background:linear-gradient(150deg,hsl(' + p.hue + ',60%,86%),hsl(' + (p.hue + 40) + ',55%,68%))"></i>';
  return '<article class="card"><small>0' + (i + 1) + ' / ' + slot('span', 'svc.' + p.category, 0) + '</small><div class="cl"><div class="pv">' + bg +
    (p.demo ? '<span class="badge" data-i18n="demo"></span>' : '') + '</div><div>' +
    slot('h3', 'prj.' + p.id, 0) + slot('p', 'prj.' + p.id, 1) + '<p class="tags">' + p.tech.map(esc).join(' / ') + '</p>' +
    (p.url ? '<a class="link" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer"><span data-i18n="open"></span>' + arrow + '</a>' : '') +
    '</div></div></article>';
}).join('');

$('#productList').innerHTML = S.products.map(function (p, i) {
  var live = (p.status == 'available' || p.status == 'beta') && p.url;
  return '<article class="pd pd--' + p.status + '" data-r data-product="' + i + '" tabindex="0" style="--d:' + i * .08 + 's">' +
    '<span class="status"><i aria-hidden="true"></i><span data-i18n="status.' + p.status + '"></span></span>' +
    slot('h3', 'prod.' + p.id, 0) + slot('p', 'prod.' + p.id, 1) +
    (live ? '<a class="link" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer"><span data-i18n="prod.open"></span>' + arrow + '</a>'
          : '<a class="link" href="#contact" data-pick="saas"><span data-i18n="prod.notify"></span>' + arrow + '</a>') +
    '</article>';
}).join('');

$('#planList').innerHTML = S.plans.map(function (p, i) {
  var k = 'plan.' + p.id;
  var price = p.price != null ? '<span data-i18n="from"></span> <b>$' + money(p.price) + '</b> <span data-i18n="cur"></span>' : '<b class="sm" data-i18n="custom"></b>';
  return '<article class="plan' + (p.featured ? ' plan--hi' : '') + '" data-r style="--d:' + i * .08 + 's">' +
    slot('h3', k, 0) + slot('p', k, 1, null, 'pl-d') + '<p class="pl-price">' + price + '</p>' +
    '<ul class="ticks" data-list="' + k + '" data-i="2"></ul>' +
    '<a class="btn ' + (p.featured ? '' : 'btn--line ') + 'mag" href="#contact" data-pick-plan="' + p.id + '" data-i18n="price.cta"></a></article>';
}).join('');

$$('[data-tg]').forEach(function (a) { a.hidden = !S.telegram; if (S.telegram) { a.href = tgUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
if (!S.telegram && !S.email) $('.direct').hidden = true;

/* ---------- i18n ---------- */
function val(d, e) { var v = d[e.dataset.k || e.dataset.list]; if (v != null && e.dataset.i != null) v = v[+e.dataset.i]; if (v != null && e.dataset.j != null) v = v[+e.dataset.j]; return v; }
function split(el) {
  var txt = el.textContent.trim(), words = txt.split(/\s+/);
  el.setAttribute('aria-label', txt);
  el.innerHTML = words.map(function (w, i) { return '<span class="w" aria-hidden="true" style="--i:' + i + '"><span>' + esc(w) + '</span></span> '; }).join('');
}
function apply(l, first) {
  lang = l; store('lang', l); var d = T[l];
  document.documentElement.lang = l == 'ua' ? 'uk' : l;
  $$('[data-i18n]').forEach(function (e) { var v = d[e.dataset.i18n]; if (v != null) e.textContent = v; });
  $$('[data-i18n-ph]').forEach(function (e) { var v = d[e.dataset.i18nPh]; if (v != null) e.placeholder = v; });
  $$('[data-i18n-aria]').forEach(function (e) { var v = d[e.dataset.i18nAria]; if (v != null) e.setAttribute('aria-label', v); });
  $$('[data-k]').forEach(function (e) { var v = val(d, e); if (v != null) e.textContent = v; });
  $$('[data-list]').forEach(function (e) { var v = val(d, e) || []; e.innerHTML = v.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join(''); });
  $$('.sv-tog').forEach(function (b) { b.firstChild.textContent = d[b.getAttribute('aria-expanded') == 'true' ? 'less' : 'more']; });
  $('#aboutList').innerHTML = d.about.map(function (t, i) { return '<li style="--i:' + i + '">' + t + '</li>'; }).join('');
  $$('.split').forEach(split);
  $$('.lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.l == l); b.setAttribute('aria-pressed', b.dataset.l == l); });
  document.title = d['meta.title'] + ' — ' + S.brand;
  document.dispatchEvent(new CustomEvent('site:language', { detail: { lang: l } }));
  if (!first) requestAnimationFrame(function () {
    $$('.split').forEach(function (e) { if (inView(e)) e.classList.add('in'); });
    $$('.row').forEach(function (e) { if (e.classList.contains('in')) { e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); } });
  });
}
function inView(e) { var r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }
$$('.lang button').forEach(function (b) {
  b.addEventListener('click', function () {
    if (b.dataset.l == lang) return;
    document.body.classList.add('swap');
    setTimeout(function () { apply(b.dataset.l); document.body.classList.remove('swap'); }, RM ? 0 : 300);
  });
});
apply(detect(), true);

/* ---------- loader: full animation once per session ---------- */
$('#loaderName').innerHTML = S.name.split('').map(function (c, i) { return '<i style="--i:' + i + '">' + (c == ' ' ? '&nbsp;' : esc(c)) + '</i>'; }).join('');
var seen = store('seen', undefined, true);
if (seen) document.body.classList.add('no-loader');
store('seen', '1', true);
function ready() { document.body.classList.remove('is-loading'); io(); }
setTimeout(ready, RM || seen ? 0 : 1100);

/* ---------- reveal ---------- */
function io() {
  if (!('IntersectionObserver' in window)) { $$('[data-r],.split,.card').forEach(function (e) { e.classList.add('in'); }); return; }
  var o = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } }); }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('[data-r],.split,.card').forEach(function (e) {
    if (e.classList.contains('card')) e.style.transitionDelay = (Array.prototype.indexOf.call(e.parentNode.children, e) * .12) + 's';
    o.observe(e);
  });
}

/* ---------- header, progress ---------- */
var hdr = $('.hdr'), bar = $('.bar'), nv = $('.nav'), bg = $('.burger'), ly = 0;
addEventListener('scroll', function () {
  var y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
  hdr.classList.toggle('solid', y > 30);
  hdr.classList.toggle('hide', y > ly && y > 200 && !nv.classList.contains('open'));
  ly = y;
}, { passive: true });

/* ---------- menu ---------- */
function menu(o) { nv.classList.toggle('open', o); bg.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; if (innerWidth <= 860) { nv.inert = !o; if(o) nv.querySelector('a').focus(); } }
if (innerWidth <= 860) nv.inert = true;
addEventListener('resize', function () { nv.inert = innerWidth <= 860 && !nv.classList.contains('open'); if(innerWidth > 860) menu(false); });
document.addEventListener('keydown', function(e) { if(e.key !== 'Tab' || !nv.classList.contains('open')) return; var items = [bg].concat($$('a', nv)), index = items.indexOf(document.activeElement); if(e.shiftKey && index === 0) {e.preventDefault();items[items.length-1].focus();} else if(!e.shiftKey && index === items.length-1) {e.preventDefault();bg.focus();} });
bg.addEventListener('click', function () { menu(!nv.classList.contains('open')); });
addEventListener('keydown', function (e) { if (e.key == 'Escape' && nv.classList.contains('open')) { menu(false); bg.focus(); } });

/* ---------- service cards: expand ---------- */
$$('.sv-tog').forEach(function (b) {
  b.addEventListener('click', function () {
    var o = b.getAttribute('aria-expanded') != 'true';
    b.setAttribute('aria-expanded', o);
    b.closest('.sv').classList.toggle('open', o);
    b.firstChild.textContent = T[lang][o ? 'less' : 'more'];
  });
});

/* ---------- anchors (delegated) + preselect form fields ---------- */
function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
var planBudget = { start: '299-799', business: '799-1999', growth: '799-1999', custom: '1999+' };
document.addEventListener('click', function (ev) {
  var a = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!a) return;
  if (a.dataset.pick) $('#f-service').value = a.dataset.pick;
  if (a.dataset.pickPlan && planBudget[a.dataset.pickPlan]) $('#f-budget').value = planBudget[a.dataset.pickPlan];
  var id = a.getAttribute('href'), t = id == '#top' ? document.body : $(id);
  if (!t) return;
  ev.preventDefault(); menu(false);
  var y0 = scrollY, y1 = id == '#top' ? 0 : t.getBoundingClientRect().top + y0 - 70, t0 = null;
  var done = function () { if (id == '#main' || id == '#contact') { var f = id == '#contact' ? $('#f-name') : t; f.focus({ preventScroll: true }); } };
  if (RM) { scrollTo(0, y1); return done(); }
  (function st(ts) { t0 = t0 || ts; var p = Math.min((ts - t0) / 1100, 1); scrollTo(0, y0 + (y1 - y0) * ease(p)); if (p < 1) requestAnimationFrame(st); else done(); })(performance.now());
});

/* ---------- carousel ---------- */
var tr = $('#track'), pg = $('#prog');
$$('.ctrl button').forEach(function (b) { b.addEventListener('click', function () { tr.scrollBy({ left: +b.dataset.d * Math.min(600, tr.clientWidth * .8), behavior: RM ? 'auto' : 'smooth' }); }); });
tr.addEventListener('scroll', function () { var m = tr.scrollWidth - tr.clientWidth; pg.style.width = (20 + (m > 0 ? tr.scrollLeft / m : 0) * 80) + '%'; }, { passive: true });
tr.addEventListener('keydown', function (e) { if (e.key == 'ArrowRight') tr.scrollBy({ left: 400, behavior: RM ? 'auto' : 'smooth' }); if (e.key == 'ArrowLeft') tr.scrollBy({ left: -400, behavior: RM ? 'auto' : 'smooth' }); });
var dn = false, sx = 0, sl = 0;
tr.addEventListener('pointerdown', function (e) { if (e.pointerType != 'mouse' || e.target.closest('a')) return; dn = true; sx = e.clientX; sl = tr.scrollLeft; tr.style.scrollSnapType = 'none'; });
addEventListener('pointerup', function () { if (dn) { dn = false; tr.style.scrollSnapType = ''; } });
addEventListener('pointermove', function (e) { if (dn) tr.scrollLeft = sl - (e.clientX - sx); });

/* ---------- lead form ---------- */
(function initForm() {
  var f = $('#leadForm'), st = $('#fStatus'), btn = $('button[type=submit]', f), t0 = Date.now(), busy = false;
  var reTg = /^(@?[a-z0-9_]{5,32}|(https?:\/\/)?t\.me\/[a-z0-9_]{5,32})$/i, reMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function setErr(name, key) {
    var el = f.elements[name], box = el.closest('.fld'), m = $('.ferr', box);
    if (!key) { box.classList.remove('err'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); if (m) m.remove(); return; }
    box.classList.add('err'); el.setAttribute('aria-invalid', 'true');
    if (!m) { m = document.createElement('small'); m.className = 'ferr'; m.id = 'e-' + name; box.appendChild(m); el.setAttribute('aria-describedby', m.id); }
    m.dataset.i18n = key; m.textContent = T[lang][key];
  }
  function status(key, kind, withTg) {
    st.className = 'fstatus' + (kind ? ' is-' + kind : '');
    st.innerHTML = '<span data-i18n="' + key + '">' + esc(T[lang][key]) + '</span>' + (withTg && S.telegram ? ' <a class="link" href="' + tgUrl + '" target="_blank" rel="noopener noreferrer"><span data-i18n="tg">' + esc(T[lang].tg) + '</span>' + arrow + '</a>' : '');
  }
  function validate() {
    var v = function (n) { return f.elements[n].value.trim(); }, ok = true, first = null;
    var rules = {
      name: v('name').length < 2 ? 'err.required' : '',
      contact: !v('contact') ? 'err.required' : (reMail.test(v('contact')) || reTg.test(v('contact')) ? '' : 'err.contact'),
      service: v('service') ? '' : 'err.required',
      budget: v('budget') ? '' : 'err.required',
      message: !v('message') ? 'err.required' : (v('message').length < 10 ? 'err.short' : ''),
      consent: f.elements.consent.checked ? '' : 'err.consent'
    };
    Object.keys(rules).forEach(function (n) { setErr(n, rules[n]); if (rules[n]) { ok = false; first = first || f.elements[n]; } });
    if (first) first.focus();
    return ok;
  }
  f.addEventListener('input', function (e) { if (e.target.name && e.target.closest('.fld.err')) setErr(e.target.name, ''); });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || !validate()) return;
    if (f.elements.website.value) { f.reset(); return status('f.ok', 'ok'); } // honeypot: silent
    // No backend (static preview): say so honestly instead of firing a request that 404s.
    if (!S.api || !S.api.leads || !(window.SITE_RUNTIME && window.SITE_RUNTIME.api)) return status('f.noapi', 'warn', true);
    var body = {
      name: f.elements.name.value.trim(), contact: f.elements.contact.value.trim(),
      service: f.elements.service.value, budget: f.elements.budget.value,
      message: f.elements.message.value.trim(), consent: true, lang: lang,
      page: location.pathname, website: f.elements.website.value, elapsed_ms: Date.now() - t0
    };
    busy = true; btn.disabled = true; btn.textContent = T[lang]['f.sending']; status('f.sending');
    var ctl = 'AbortController' in window ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(S.api.leads, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl && ctl.signal })
      .then(function (r) {
        if (r.ok) { f.reset(); t0 = Date.now(); return status('f.ok', 'ok'); }
        if (r.status == 429) return status('f.rate', 'warn', true);
        if (r.status == 422) return r.json().then(function (j) {
          var map = { required: 'err.required', too_short: 'err.short', invalid: 'err.contact', consent_required: 'err.consent' };
          Object.keys((j && j.errors) || {}).forEach(function (n) { if (f.elements[n]) setErr(n, map[j.errors[n]] || 'err.required'); });
          status('f.err', 'err', true);
        });
        throw new Error('HTTP ' + r.status);
      })
      .catch(function () { status('f.err', 'err', true); })
      .then(function () { clearTimeout(to); busy = false; btn.disabled = false; btn.textContent = T[lang]['f.submit']; });
  });
})();

window.Platform = { get lang() { return lang; }, translate: apply, escape: esc };
if (RM) return;

/* ---------- mouse parallax + magnetic (desktop pointers only) ---------- */
var fine = matchMedia('(pointer:fine)').matches;
if (fine) {
  var mx = 0, my = 0, tx = 0, ty = 0, root = document.documentElement;
  addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; });
  (function loop() { if(!document.hidden && !document.body.classList.contains('motion-paused')) { mx += (tx - mx) * .05; my += (ty - my) * .05; root.style.setProperty('--mx', mx.toFixed(3)); root.style.setProperty('--my', my.toFixed(3)); } requestAnimationFrame(loop); })();
  $$('.mag').forEach(function (m) {
    m.addEventListener('pointermove', function (e) { var r = m.getBoundingClientRect(); m.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * .22 + 'px,' + (e.clientY - r.top - r.height / 2) * .35 + 'px)'; });
    m.addEventListener('pointerleave', function () { m.style.transform = ''; });
  });
}

/* ---------- particles ---------- */
var cv = $('#dots'), cx = cv.getContext('2d'), P = [], W, H, vis = true, dpr = Math.min(devicePixelRatio || 1, 2), lw = 0;
function size() {
  var r = cv.getBoundingClientRect(); if (r.width == lw && P.length) return; lw = r.width;
  W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); P = [];
  for (var i = 0; i < Math.min(55, W / 22 | 0); i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 });
}
size(); addEventListener('resize', size);
new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(cv);
(function draw() {
  requestAnimationFrame(draw); if (!vis || document.hidden || document.body.classList.contains('motion-paused')) return; cx.clearRect(0, 0, W, H);
  for (var i = 0; i < P.length; i++) {
    var p = P[i]; p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
    cx.fillStyle = 'rgba(138,31,45,.45)'; cx.beginPath(); cx.arc(p.x, p.y, 1.6, 0, 6.3); cx.fill();
    for (var j = i + 1; j < P.length; j++) { var q = P[j], d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 120) { cx.strokeStyle = 'rgba(138,31,45,' + (.16 * (1 - d / 120)) + ')'; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); } }
  }
})();
})();
