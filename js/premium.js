(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const text = (key, fallback) => ((window.I18N[window.Platform ? Platform.lang : 'ru'] || {})[key]) || fallback || key;
  let bootstrap = null;
  let activeCategory = 'web';
  let toastTimer;
  let flowTimer;

  function toast(message) {
    const element = $('#demoToast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 3500);
  }

  function applyRemoteCopy(content) {
    if (!content || typeof content !== 'object' || !window.I18N) return;
    ['ru', 'ua', 'en'].forEach(lang => {
      Object.assign(window.I18N[lang], content.all || {}, content[lang] || {});
    });
    if (window.Platform) Platform.translate(Platform.lang);
  }

  function categoryPriceRows() {
    const all = (bootstrap && Array.isArray(bootstrap.pricing)) ? bootstrap.pricing : [];
    return all.filter(row => row.active !== false && row.category === activeCategory);
  }

  function fallbackPriceRows() {
    return (window.SITE.plans || []).map(plan => ({
      id: plan.id, tier: plan.id === 'business' ? 'growth' : plan.id,
      name: plan.id === 'business' ? 'GROWTH' : plan.id.toUpperCase(),
      price_usd: plan.price, interval: activeCategory === 'saas' ? 'month' : 'once',
      description: ((window.I18N[Platform.lang] || {})['plan.' + plan.id] || [plan.id.toUpperCase(), '', []])[1],
      features: ((window.I18N[Platform.lang] || {})['plan.' + plan.id] || ['', '', []])[2]
    }));
  }

  function renderPricing() {
    const target = $('#planList');
    if (!target) return;
    const sourceRows = categoryPriceRows();
    const rows = sourceRows.length ? sourceRows : fallbackPriceRows();
    const source = $('#pricingSource');
    source.textContent = sourceRows.length ? text('price.db') : text('price.preview');
    target.replaceChildren();
    if (!rows.length) {
      const paragraph = document.createElement('p');
      paragraph.className = 'note';
      paragraph.textContent = text('price.unavailable');
      target.append(paragraph);
      return;
    }
    rows.sort((a, b) => ['start', 'growth', 'custom'].indexOf(a.tier) - ['start', 'growth', 'custom'].indexOf(b.tier)).forEach((row, index) => {
      const article = document.createElement('article');
      article.className = 'plan' + ((row.tier === 'growth' || index === 1) ? ' plan--hi' : '');
      const heading = document.createElement('h3'); heading.textContent = row.name || String(row.tier || 'CUSTOM').toUpperCase();
      const description = document.createElement('p'); description.className = 'pl-d'; description.textContent = row.description || '';
      const price = document.createElement('p'); price.className = 'pl-price';
      if (Number.isFinite(Number(row.price_usd))) {
        price.append(document.createTextNode(text('from') + ' '));
        const amount = document.createElement('b'); amount.textContent = '$' + Number(row.price_usd).toLocaleString('en-US');
        const interval = document.createElement('span'); interval.textContent = ' ' + (row.interval === 'month' ? text('price.month') : text('price.once'));
        price.append(amount, interval);
      } else price.textContent = text('custom');
      const list = document.createElement('ul'); list.className = 'ticks';
      (Array.isArray(row.features) ? row.features : []).forEach(feature => { const item = document.createElement('li'); item.textContent = feature; list.append(item); });
      const link = document.createElement('a'); link.className = 'btn ' + ((row.tier === 'growth' || index === 1) ? '' : 'btn--line '); link.href = '#contact'; link.dataset.pickPlan = row.tier || 'custom'; link.textContent = text('price.cta');
      article.append(heading, description, price, list, link); target.append(article);
    });
  }

  function renderProducts() {
    if (!bootstrap || !Array.isArray(bootstrap.products) || !bootstrap.products.length) return;
    const target = $('#productList'); if (!target) return;
    target.replaceChildren();
    bootstrap.products.filter(p => p.active !== false).forEach((product, index) => {
      const article = document.createElement('article'); article.className = 'pd pd--' + (product.status || 'soon'); article.tabIndex = 0; article.dataset.product = String(index);
      const status = document.createElement('span'); status.className = 'status'; const dot = document.createElement('i'); const label = document.createElement('span'); label.textContent = text('status.' + (product.status || 'soon')); status.append(dot, label);
      const heading = document.createElement('h3'); heading.textContent = product.title;
      const desc = document.createElement('p'); desc.textContent = product.description;
      const more = document.createElement('a'); more.className = 'link'; more.href = product.url || '/products/' + encodeURIComponent(product.slug || '') + '/'; more.textContent = product.status === 'available' || product.status === 'beta' ? text('prod.open') : text('prod.detail');
      article.append(status, heading, desc, more); target.append(article);
    });
    showProduct(0);
  }

  function productItems() {
    const remote = bootstrap && Array.isArray(bootstrap.products) ? bootstrap.products.filter(p => p.active !== false) : [];
    if (remote.length) return remote;
    return ((window.SITE && SITE.products) || []).map(p => {
      const copy = text('prod.' + p.id, []);
      return { slug: p.id, title: Array.isArray(copy) ? copy[0] : p.id, description: Array.isArray(copy) ? copy[1] : '', url: '/products/' + p.id + '/' };
    });
  }

  // Small illustrative UI per product. Purely decorative (aria-hidden); no data implied.
  const productUi = {
    adminbot: () => ['<p class="pu-msg">' + escape(text('pui.bot.q')) + '</p>', '<p class="pu-msg pu-msg--ai">' + escape(text('pui.bot.a')) + '</p>', '<p class="pu-chip">' + escape(text('pui.bot.task')) + '</p>'],
    leadfinder: () => [70, 52, 38].map((w, i) => '<p class="pu-row"><span>' + escape(text('pui.lead.row')) + ' ' + (i + 1) + '</span><i style="--w:' + w + '%"></i></p>'),
    proposal: () => ['<p class="pu-doc"><b>' + escape(text('pui.doc.title')) + '</b></p>', '<p class="pu-line" style="--w:92%"></p>', '<p class="pu-line" style="--w:76%"></p>', '<p class="pu-line" style="--w:58%"></p>', '<p class="pu-chip">' + escape(text('pui.doc.ready')) + '</p>']
  };

  function showProduct(index) {
    const products = productItems();
    if (!products[index]) return;
    $$('.pd').forEach((element, itemIndex) => { const current = itemIndex === index; element.classList.toggle('active', current); element.setAttribute('aria-current', current ? 'true' : 'false'); });
    const product = products[index];
    const update = () => {
      $('#productName').textContent = product.title;
      $('#productDescription').textContent = product.description;
      const link = $('#productLink'); link.href = product.url || '/products/' + encodeURIComponent(product.slug || '') + '/';
      $('#productWidget').textContent = product.title;
      const image = $('#productShowcase img');
      if (product.image) image.src = product.image;
      const ui = $('#productUi');
      if (ui) { const build = productUi[product.slug] || productUi.leadfinder; ui.innerHTML = build().map((html, i) => html.replace(/^<p([^>]*)>/, (m, attrs) => attrs.includes('style="') ? '<p' + attrs.replace('style="', 'style="--k:' + i + ';') + '>' : '<p' + attrs + ' style="--k:' + i + '">')).join(''); ui.classList.remove('play'); void ui.offsetWidth; ui.classList.add('play'); }
    };
    const box = $('.product-description');
    if (reduced || !box || !box.animate || !$('#productName').textContent) { update(); return; }
    box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
      update();
      box.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    };
  }

  // Demo-only agent controls: they change the illustration, never real agents.
  const agentState = { off: new Set(), load: 2 };
  function renderAgents(announceAgent) {
    const pipeline = $('.pipeline-canvas'); if (!pipeline) return;
    const blocked = agentState.off.size ? Math.min(...agentState.off) : 0;
    $$('#flow li').forEach((item, index) => { item.classList.toggle('is-off', agentState.off.has(index)); item.classList.toggle('is-waiting', blocked > 0 && index >= blocked && !agentState.off.has(index)); });
    const clip = $('#wireClipRect'); if (clip) clip.setAttribute('width', blocked ? String(250 * blocked) : '1000');
    pipeline.style.setProperty('--sig', ['6s', '4s', '2.4s'][agentState.load - 1]);
    pipeline.classList.toggle('is-blocked', blocked > 0);
    const active = 3 - agentState.off.size;
    const status = $('#agentStatus'); if (status) status.textContent = text('agents.active').replace('{n}', active);
    const out = $('#agentLoadOut'); if (out) out.textContent = text('agents.levels', [])[agentState.load - 1] || '';
    if (announceAgent) {
      const name = (text('hero.flow', [])[announceAgent] || '');
      toast((agentState.off.has(announceAgent) ? text('agents.paused') : text('agents.resumed')).replace('{a}', name));
    }
  }
  function setupAgents() {
    $$('.agent-switches [role=switch]').forEach(button => button.addEventListener('click', () => {
      const id = Number(button.dataset.agent); const on = button.getAttribute('aria-checked') === 'true';
      button.setAttribute('aria-checked', String(!on));
      if (on) agentState.off.add(id); else agentState.off.delete(id);
      renderAgents(id);
    }));
    const load = $('#agentLoad');
    if (load) load.addEventListener('input', () => { agentState.load = Number(load.value) || 2; renderAgents(0); });
    renderAgents(0);
  }

  function setupProducts() {
    document.addEventListener('click', event => { const card = event.target.closest('.pd'); if (card && !event.target.closest('a')) showProduct(Number(card.dataset.product)); });
    document.addEventListener('keydown', event => { const card = event.target.closest('.pd'); if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showProduct(Number(card.dataset.product)); } });
  }

  function selectFlow(index, announce) {
    $$('#flow [data-flow-node]').forEach((button, itemIndex) => button.setAttribute('aria-pressed', String(index === itemIndex)));
    const details = text('flow.details', []);
    $('#flowIndex').textContent = '0' + (index + 1) + ' / ' + (text('hero.flow', [])[index] || 'SYSTEM');
    $('#flowDetail').textContent = Array.isArray(details) ? details[index] : '';
    if (announce) toast((text('flow.toast', [])[index]) || 'Demo event');
  }

  function setupFlow() {
    $$('#flow [data-flow-node]').forEach(button => button.addEventListener('click', () => selectFlow(Number(button.dataset.flowNode), false)));
    const run = $('#runFlow'); if (!run) return;
    run.addEventListener('click', () => {
      clearInterval(flowTimer); let index = 0; selectFlow(index, true); run.disabled = true;
      flowTimer = setInterval(() => { index += 1; if (index > 3) { clearInterval(flowTimer); run.disabled = false; return; } selectFlow(index, true); }, reduced ? 0 : 1250);
    });
    selectFlow(0, false);
  }

  const chatState = { scenario: 'booking', step: 0, timer: null };
  function appendMessage(value, kind) { const node = document.createElement('p'); node.className = 'message' + (kind ? ' ' + kind : ''); node.textContent = value; $('#chatMessages').append(node); $('#chatMessages').scrollTop = 9999; }
  function typeThen(value, callback) {
    const typing = document.createElement('p'); typing.className = 'message typing'; typing.setAttribute('aria-label', 'AI is preparing a response'); typing.innerHTML = '<i></i><i></i><i></i>'; $('#chatMessages').append(typing);
    clearTimeout(chatState.timer); chatState.timer = setTimeout(() => { typing.remove(); appendMessage(value); if (callback) callback(); }, reduced ? 0 : 530);
  }
  function setOptions(options) {
    const target = $('#chatOptions'); target.replaceChildren();
    options.forEach(option => { const button = document.createElement('button'); button.type = 'button'; button.textContent = option; button.addEventListener('click', () => respond(option)); target.append(button); });
  }
  function resetChat() {
    clearTimeout(chatState.timer); chatState.step = 0; $('#chatMessages').replaceChildren();
    appendMessage((text('chat.greetings', {})[chatState.scenario]) || 'Hello.'); setOptions(text('chat.options', []));
  }
  function respond(value) {
    appendMessage(value, 'user'); $('#chatOptions').replaceChildren();
    if (chatState.step === 0) { chatState.step = 1; typeThen(text('chat.followup'), () => setOptions(text('chat.next', []))); }
    else { chatState.step = 2; typeThen(text('chat.finish'), () => { setOptions([text('chat.restart')]); toast(text('chat.notice')); }); }
  }
  function setupDemo() {
    $$('.demo-scenarios button').forEach(button => button.addEventListener('click', () => { chatState.scenario = button.dataset.scenario; $$('.demo-scenarios button').forEach(item => { const selected = item === button; item.classList.toggle('on', selected); item.setAttribute('aria-pressed', String(selected)); }); resetChat(); }));
    $('#resetDemo').addEventListener('click', resetChat);
    $('#demoForm').addEventListener('submit', event => { event.preventDefault(); const input = $('#demoMessage'); const value = input.value.trim(); if (!value) return; input.value = ''; appendMessage(value, 'user'); $('#chatOptions').replaceChildren(); typeThen(text('chat.free'), () => setOptions(text('chat.options', []))); });
    resetChat();
  }

  function setupMotionToggle() {
    const button = $('#motionToggle'); if (!button) return;
    let stopped = false;
    button.addEventListener('click', () => { stopped = !stopped; document.body.classList.toggle('motion-paused', stopped); button.setAttribute('aria-pressed', String(stopped)); button.textContent = text(stopped ? 'motion.resume' : 'motion.pause'); });
  }

  function setupGsap() {
    if (reduced || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.from('.hero-visual', { opacity: 0, y: 36, duration: 1.15, ease: 'power3.out', delay: .3 });
    gsap.from('.hero-topline,.hero-bottom', { opacity: 0, duration: .7, stagger: .12, delay: .2 });
    gsap.utils.toArray('.photo-mask img[data-parallax]').forEach(image => gsap.to(image, { yPercent: 9, ease: 'none', scrollTrigger: { trigger: image.parentElement, start: 'top bottom', end: 'bottom top', scrub: .7 } }));
    // Scheme assembles on scroll: frame, wire draws, nodes snap in, then controls.
    const assemble = gsap.timeline({ scrollTrigger: { trigger: '.pipeline-canvas', start: 'top 72%' } });
    assemble.from('.pipeline-canvas', { clipPath: 'inset(0 100% 0 0)', duration: .9, ease: 'power3.out' })
      .fromTo('.pipeline-lines .wire', { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, '-=.35')
      .from('#flow li', { opacity: 0, y: 28, scale: .94, duration: .6, stagger: .14, ease: 'back.out(1.6)' }, '<.1')
      .from('#flow .flow-icon', { rotate: -90, duration: .5, stagger: .14, ease: 'power2.out' }, '<')
      .from('.agent-console > *', { opacity: 0, y: 16, duration: .5, stagger: .1, ease: 'power2.out' }, '-=.2');
    // Masked photo reveal: frame opens, image settles from a slight zoom.
    gsap.utils.toArray('.photo-mask').forEach(mask => {
      if (mask.closest('.hero')) return;
      // Clip the image, not the mask: masks keep their brand corner-cut polygons.
      const image = mask.querySelector('img'); if (!image) return;
      const tl = gsap.timeline({ scrollTrigger: { trigger: mask, start: 'top 88%' } });
      tl.fromTo(image, { clipPath: 'inset(12% 10% 12% 10%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'power3.out', clearProps: 'clipPath' })
        .from(image, Object.assign({ scale: 1.22, duration: 1.6, ease: 'power3.out' }, image.hasAttribute('data-parallax') ? {} : { clearProps: 'transform' }), 0);
    });
    gsap.fromTo('.hero-photo img', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut', delay: .35, clearProps: 'clipPath' });
    // Section transitions: the wine rule under each label tracks scroll progress.
    gsap.utils.toArray('.section-label').forEach(label => gsap.fromTo(label, { '--p': 0 }, { '--p': 1, ease: 'none', scrollTrigger: { trigger: label, start: 'top 92%', end: 'top 45%', scrub: .5 } }));
    gsap.utils.toArray('.sec, .system-section').forEach(section => gsap.from(section, { opacity: .35, y: 40, duration: 1, ease: 'power2.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: section, start: 'top 90%' } })); // clearProps: a leftover transform would break pinned children (position:fixed)
    gsap.from('.product-showcase', { opacity: 0, y: 36, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '#products', start: 'top 58%' } });
  }

  async function loadBootstrap() {
    const endpoint = window.SITE && SITE.api && SITE.api.bootstrap;
    // Static preview has no backend: keep local preview data, make no request.
    if (!endpoint || !(window.SITE_RUNTIME && SITE_RUNTIME.api)) return;
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data || typeof data !== 'object') return;
      bootstrap = data; applyRemoteCopy(data.content);
      if (Array.isArray(data.products) && data.products.length) renderProducts();
      renderPricing();
    } catch (_) { /* Static preview remains useful offline. */ }
  }

  function setupPricing() {
    $$('.pricing-tabs [role=tab]').forEach(button => button.addEventListener('click', () => {
      activeCategory = button.dataset.priceCategory;
      $$('.pricing-tabs [role=tab]').forEach(item => { const selected = item === button; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; });
      $('#planList').setAttribute('aria-labelledby', button.id); renderPricing();
    }));
    $$('.pricing-tabs').forEach(list => list.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const tabs = $$('[role=tab]', list); const current = tabs.indexOf(document.activeElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click(); }));
    renderPricing();
  }

  document.addEventListener('site:language', () => { renderPricing(); if (bootstrap && bootstrap.products && bootstrap.products.length) renderProducts(); else showProduct(Math.max(0, $$('.pd').findIndex(card => card.classList.contains('active')))); selectFlow(0, false); resetChat(); renderAgents(0); });
  setupFlow(); setupProducts(); setupDemo(); setupPricing(); setupMotionToggle(); setupAgents(); showProduct(0); setupGsap(); loadBootstrap();
})();
