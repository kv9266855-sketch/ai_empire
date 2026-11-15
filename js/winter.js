/* AI EMPIRE — Winter Edition effects.
   Every effect: runs only in the winter theme, pauses when hidden/off-screen or when the
   visitor pauses animations, draws a still frame under prefers-reduced-motion,
   and never sits above interactive content (pointer-events: none / z-index -1). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const lowPower = innerWidth < 768 || !finePointer || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const isWinter = () => (window.Theme ? Theme.get() : document.documentElement.getAttribute('data-theme')) === 'winter';
  const motionPaused = () => document.body.classList.contains('motion-paused');
  const canAnimate = () => isWinter() && !reduced && !document.hidden && !motionPaused();
  const t = (key, fallback) => {
    const dict = window.I18N && window.Platform ? window.I18N[Platform.lang] : null;
    const value = dict && dict[key];
    return value == null ? fallback : value;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const dprCap = lowPower ? 1.25 : 1.75;

  /* ================= SNOW ================= */
  const Snow = (() => {
    const canvas = $('#snow'); if (!canvas || !canvas.getContext) return { sync() {} };
    const ctx = canvas.getContext('2d');
    // depth layers: far (small, slow, soft) → near (larger, faster, crisper)
    const LAYERS = [
      { r: [.7, 1.3], vy: [.18, .36], amp: [.15, .35], alpha: .5, share: .55, depth: .25, soft: 1.9 },
      { r: [1.3, 2.1], vy: [.36, .62], amp: [.25, .55], alpha: .7, share: .32, depth: .55, soft: 1.5 },
      { r: [2.1, 3.2], vy: [.62, .95], amp: [.35, .8], alpha: .82, share: .13, depth: 1, soft: 1.25 }
    ];
    const sprites = LAYERS.map(layer => {
      const size = 48, c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'), grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(.22 / layer.soft, 'rgba(214,227,238,.95)');
      grad.addColorStop(.55, 'rgba(170,192,210,.38)');
      grad.addColorStop(1, 'rgba(170,192,210,0)');
      g.fillStyle = grad; g.fillRect(0, 0, size, size); return c;
    });
    let flakes = [], w = 0, h = 0, dpr = 1, raf = 0, last = 0, born = 0, scrollV = 0, lastY = scrollY;
    const mouse = { x: -1e4, y: -1e4 };
    function make(layerIndex, anywhere) {
      const L = LAYERS[layerIndex];
      return { l: layerIndex, x: Math.random() * w, y: anywhere ? Math.random() * h : rand(-40, -6), r: rand(L.r[0], L.r[1]),
        vy: rand(L.vy[0], L.vy[1]), amp: rand(L.amp[0], L.amp[1]), ph: Math.random() * 6.28, ps: rand(.4, 1.1), a: 0, ta: L.alpha * rand(.65, 1) };
    }
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, dprCap); w = innerWidth; h = innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(lowPower ? 42 : 140, (w * h) / (lowPower ? 15000 : 9500)));
      while (flakes.length < target) { const roll = Math.random(); flakes.push(make(roll < LAYERS[0].share ? 0 : roll < LAYERS[0].share + LAYERS[1].share ? 1 : 2, true)); }
      flakes.length = target;
      if (!raf) draw(1);
    }
    function step(dt) {
      scrollV *= Math.pow(.88, dt * 60);
      const wind = Math.sin(performance.now() / 9000) * .18;
      for (const f of flakes) {
        const L = LAYERS[f.l];
        f.ph += f.ps * dt;
        f.x += (Math.sin(f.ph) * f.amp + wind * L.depth) * dt * 60 * .5;
        f.y += f.vy * dt * 60 - scrollV * L.depth;
        const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400 && d2 > 1) { const d = Math.sqrt(d2), push = (1 - d / 120) * 1.6 * L.depth; f.x += dx / d * push * dt * 60; f.y += dy / d * push * dt * 30; }
        if (f.a < f.ta) f.a = Math.min(f.ta, f.a + dt * .7);
        if (f.y > h + 12 || f.x < -30 || f.x > w + 30 || f.y < -60) Object.assign(f, make(f.l, false), f.y < -60 ? { y: h + 6 } : {});
      }
    }
    function draw(alpha) {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        const s = f.r * 4.2; ctx.globalAlpha = (raf ? f.a : f.ta) * alpha;
        ctx.drawImage(sprites[f.l], f.x - s / 2, f.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      step(dt); draw(Math.min(1, (now - born) / 2200)); // whole field fades in over ~2s
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      if (!isWinter()) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, w, h); return; }
      if (canAnimate()) { if (!raf) { last = performance.now(); if (!born) born = last; raf = requestAnimationFrame(frame); } }
      else { cancelAnimationFrame(raf); raf = 0; draw(1); } // still frame (reduced motion / paused)
    }
    let resizeTimer;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }, { passive: true });
    addEventListener('scroll', () => { const y = scrollY; scrollV = Math.max(-5, Math.min(5, scrollV + (y - lastY) * .035)); lastY = y; }, { passive: true });
    if (finePointer) {
      addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
      document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    }
    resize();
    return { sync };
  })();

  /* ================= HERO ICE LINES ================= */
  function drawIceLines() {
    if (!isWinter() || reduced || !window.gsap) return;
    gsap.fromTo('.ice-lines path', { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.4, stagger: .18, ease: 'power2.out', delay: .5, overwrite: true });
    gsap.fromTo('.ice-lines circle', { opacity: 0, scale: 0, transformOrigin: '50% 50%' }, { opacity: .7, scale: 1, duration: .6, stagger: .2, delay: 1.6, overwrite: true });
    gsap.fromTo('.hero-frost', { opacity: 0 }, { opacity: 1, duration: 2, ease: 'power1.out', overwrite: true });
  }

  /* ================= SNOW AROUND THE AI SCHEME ================= */
  function setupSchemeFlakes() {
    const host = $('.pipeline-canvas'); if (!host) return;
    const box = document.createElement('div'); box.className = 'scheme-flakes'; box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < (lowPower ? 8 : 16); i++) {
      const flake = document.createElement('i');
      flake.style.cssText = `left:${rand(2, 98)}%;--s:${rand(2, 5).toFixed(1)}px;--t:${rand(5, 10).toFixed(1)}s;--delay:${-rand(0, 10).toFixed(1)}s;--dx:${rand(-40, 40).toFixed(0)}px;--y:${rand(10, 140).toFixed(0)}`;
      box.append(flake);
    }
    host.prepend(box);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => entries.forEach(e => host.classList.toggle('in-view', e.isIntersecting))).observe(host);
    else host.classList.add('in-view');
  }

  /* ================= ICE GLASS: border light follows pointer ================= */
  function setupGlassGlow() {
    if (!finePointer) return;
    let pending = null;
    document.addEventListener('pointermove', e => {
      if (!isWinter()) return;
      const card = e.target.closest && e.target.closest('.sv,.plan,.pd'); if (!card) return;
      pending = { card, x: e.clientX, y: e.clientY };
      requestAnimationFrame(() => {
        if (!pending) return; const r = pending.card.getBoundingClientRect();
        pending.card.style.setProperty('--gx', (pending.x - r.left) + 'px'); pending.card.style.setProperty('--gy', (pending.y - r.top) + 'px'); pending = null;
      });
    }, { passive: true });
  }

  /* ================= FROST NETWORK ================= */
  const Network = (() => {
    const canvas = $('#frostNetwork'); const legend = $('#networkLegend');
    if (!canvas || !canvas.getContext) return { sync() {}, relabel() {} };
    const ctx = canvas.getContext('2d');
    const NODES = [
      { id: 'site', x: .14, y: .3 }, { id: 'telegram', x: .12, y: .72 }, { id: 'email', x: .32, y: .88 },
      { id: 'knowledge', x: .4, y: .14 }, { id: 'agent', x: .46, y: .5, core: true }, { id: 'crm', x: .72, y: .34, core: true },
      { id: 'calendar', x: .84, y: .7 }, { id: 'team', x: .62, y: .84 }, { id: 'analytics', x: .9, y: .16 }
    ];
    const EDGES = [['site', 'agent'], ['telegram', 'agent'], ['email', 'agent'], ['knowledge', 'agent'], ['agent', 'crm'], ['agent', 'calendar'], ['crm', 'team'], ['crm', 'analytics'], ['calendar', 'team'], ['site', 'crm']];
    const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
    // faint "ice dust": tiny satellite points linked to the nearest node
    const dust = Array.from({ length: lowPower ? 18 : 34 }, () => { const x = Math.random(), y = Math.random(); let best = NODES[0], bd = 9; NODES.forEach(n => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }); return { x, y, to: best, r: rand(.6, 1.6) }; });
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = false, selected = null, hover = null, spawnAt = 0, signals = [];
    const P = n => ({ x: n.x * w, y: n.y * h });
    const linked = id => EDGES.filter(e => e.includes(id));
    function label(id) { const names = t('net.nodes', {}); return (names && names[id]) || id; }
    function resize() {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      dpr = Math.min(devicePixelRatio || 1, dprCap); w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now());
    }
    function spawn(now) {
      const focus = selected || hover; const pool = focus ? linked(focus) : EDGES;
      const edge = pool[Math.floor(Math.random() * pool.length)];
      const forward = focus ? edge[0] === focus : Math.random() < .8;
      signals.push({ a: byId[forward ? edge[0] : edge[1]], b: byId[forward ? edge[1] : edge[0]], p: 0, v: rand(.35, .6) });
      spawnAt = now + (focus ? 260 : 520) * (lowPower ? 1.6 : 1);
    }
    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      const focus = selected || hover; const hot = focus ? new Set(linked(focus).flat()) : null;
      ctx.lineWidth = 1;
      dust.forEach(d => { const a = { x: d.x * w, y: d.y * h }, b = P(d.to); ctx.strokeStyle = 'rgba(185,201,213,.32)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = 'rgba(150,175,195,.7)'; ctx.beginPath(); ctx.arc(a.x, a.y, d.r, 0, 6.29); ctx.fill(); });
      EDGES.forEach(([ia, ib]) => {
        const a = P(byId[ia]), b = P(byId[ib]); const lit = focus && (ia === focus || ib === focus);
        ctx.strokeStyle = lit ? 'rgba(130,29,50,.75)' : 'rgba(150,175,195,.75)'; ctx.lineWidth = lit ? 1.6 : 1;
        ctx.shadowColor = lit ? 'rgba(130,29,50,.4)' : 'rgba(220,234,245,1)'; ctx.shadowBlur = lit ? 8 : 6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.shadowBlur = 0;
      signals.forEach(s => {
        const a = P(s.a), b = P(s.b), x = a.x + (b.x - a.x) * s.p, y = a.y + (b.y - a.y) * s.p;
        const tail = Math.max(0, s.p - .14), tx = a.x + (b.x - a.x) * tail, ty = a.y + (b.y - a.y) * tail;
        const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, 'rgba(130,29,50,0)'); g.addColorStop(1, 'rgba(130,29,50,.85)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 10); glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(.35, 'rgba(160,40,64,.85)'); glow.addColorStop(1, 'rgba(160,40,64,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.29); ctx.fill();
      });
      const pulse = (Math.sin(now / 700) + 1) / 2;
      NODES.forEach(n => {
        const p = P(n), r = n.core ? 9 : 6, on = focus === n.id, near = hot && hot.has(n.id);
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (3.2 + (reduced ? 0 : pulse * .8)));
        halo.addColorStop(0, on ? 'rgba(130,29,50,.28)' : 'rgba(220,234,245,.95)'); halo.addColorStop(1, 'rgba(220,234,245,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, 6.29); ctx.fill();
        ctx.fillStyle = n.core || on ? '#821d32' : '#fafbff'; ctx.strokeStyle = near || on ? '#821d32' : '#9fb3c4'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.29); ctx.fill(); ctx.stroke();
        ctx.font = `${on ? 600 : 500} ${w < 420 ? 9 : 10}px Unbounded, Arial, sans-serif`; ctx.fillStyle = hot && !near && !on ? 'rgba(25,38,50,.35)' : '#192632';
        ctx.textAlign = p.x > w * .8 ? 'right' : p.x < w * .2 ? 'left' : 'center';
        const text = String(label(n.id)).toUpperCase(); const ty = p.y + (n.y > .8 ? -r - 12 : r + 18);
        const tx = ctx.textAlign === 'right' ? p.x + r : ctx.textAlign === 'left' ? p.x - r : p.x;
        ctx.fillText(text, tx, ty);
      });
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      if (now > spawnAt) spawn(now);
      signals.forEach(s => { s.p += s.v * dt; }); signals = signals.filter(s => s.p < 1);
      draw(now); raf = requestAnimationFrame(frame);
    }
    function sync() {
      const run = visible && canAnimate();
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!run && isWinter()) draw(performance.now());
    }
    function nodeAt(x, y) { let best = null, bd = 30 * 30; NODES.forEach(n => { const p = P(n), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = n.id; } }); return best; }
    function announce() {
      $$('button', legend).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.node === selected)));
      const live = $('#netLive'); if (!live) return;
      live.textContent = selected ? t('net.links', '{a}: {b}').replace('{a}', label(selected)).replace('{b}', linked(selected).map(e => label(e[0] === selected ? e[1] : e[0])).join(', ')) : '';
      if (!raf) draw(performance.now());
    }
    function select(id) { selected = selected === id ? null : id; spawnAt = 0; announce(); }
    function relabel() {
      if (!legend) return;
      legend.replaceChildren(...NODES.map(n => { const b = document.createElement('button'); b.type = 'button'; b.dataset.node = n.id; if (n.core) b.dataset.core = ''; b.setAttribute('aria-pressed', String(selected === n.id)); const i = document.createElement('i'); i.setAttribute('aria-hidden', 'true'); b.append(i, document.createTextNode(label(n.id))); b.addEventListener('click', () => select(n.id)); return b; }));
      if (!$('#netLive')) { const live = document.createElement('p'); live.id = 'netLive'; live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); legend.after(live); }
      if (w) draw(performance.now());
    }
    canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); const id = nodeAt(e.clientX - r.left, e.clientY - r.top); if (id !== hover) { hover = id; canvas.style.cursor = id ? 'pointer' : 'default'; if (!raf) draw(performance.now()); } });
    canvas.addEventListener('pointerleave', () => { hover = null; if (!raf) draw(performance.now()); });
    canvas.addEventListener('click', e => { const r = canvas.getBoundingClientRect(); const id = nodeAt(e.clientX - r.left, e.clientY - r.top); if (id) select(id); });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) resize(); sync(); }, { rootMargin: '80px' }).observe(canvas);
    else visible = true;
    relabel();
    return { sync, relabel };
  })();

  /* ================= WINTER SHOWCASE ================= */
  const Showcase = (() => {
    const viewport = $('#showcaseViewport'), track = $('#showcaseTrack');
    if (!viewport || !track) return { sync() {}, relabel() {} };
    const projects = (window.SITE && SITE.projects) || [];
    const interludes = ['/assets/images/winter-peaks.webp', '/assets/images/winter-forest.webp'];
    let tween = null, triggers = [];
    function build() {
      const parts = [];
      projects.forEach((p, i) => {
        parts.push(`<figure class="sc-panel" data-project="${i}"><div class="sc-media"><img src="${Platform.escape(p.image)}" alt="" loading="lazy" decoding="async">${p.demo ? '<span class="sc-badge" data-sc="demo"></span>' : ''}</div><figcaption class="sc-cap"><span class="micro">0${i + 1}</span><h3 data-sc="title"></h3><p data-sc="desc"></p>${p.url ? `<a href="${Platform.escape(p.url)}" data-sc="open"></a>` : ''}</figcaption></figure>`);
        if (interludes[i]) parts.push(`<figure class="sc-panel sc-panel--interlude" aria-hidden="true"><div class="sc-media"><img src="${interludes[i]}" alt="" loading="lazy" decoding="async"></div><figcaption class="sc-cap"><span class="micro">FIG. 0${i + 2}</span><p data-sc="interlude" data-i="${i}"></p></figcaption></figure>`);
      });
      parts.push('<div class="sc-end"><span class="micro">❄ AI EMPIRE</span><h3 data-sc="end"></h3><a class="btn btn--line" href="/portfolio/"><span data-sc="all"></span></a></div>');
      track.innerHTML = parts.join('');
      relabel();
    }
    function relabel() {
      $$('.sc-panel[data-project]', track).forEach(panel => {
        const p = projects[Number(panel.dataset.project)]; const copy = t('prj.' + p.id, []) || [];
        const set = (k, v) => { const el = $(`[data-sc="${k}"]`, panel); if (el) el.textContent = v; };
        set('title', copy[0] || ''); set('desc', copy[1] || ''); set('demo', t('demo', 'Demo')); set('open', t('open', 'Open') + ' ↗');
        panel.setAttribute('aria-label', copy[0] || '');
      });
      $$('[data-sc="interlude"]', track).forEach(el => { el.textContent = (t('show.interlude', []) || [])[Number(el.dataset.i)] || ''; });
      const end = $('[data-sc="end"]', track); if (end) end.textContent = t('show.end', '');
      const all = $('[data-sc="all"]', track); if (all) all.textContent = t('work.all', '');
    }
    function teardown() {
      triggers.forEach(tr => tr.kill()); triggers = [];
      if (tween) { tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); tween = null; }
      if (window.gsap) gsap.set([track, ...$$('.sc-media img', track)], { clearProps: 'transform,clipPath' });
    }
    function sync() {
      teardown();
      const pinned = isWinter() && !reduced && window.gsap && window.ScrollTrigger && matchMedia('(min-width: 861px) and (pointer: fine)').matches;
      viewport.classList.toggle('is-native', !pinned);
      const hint = $('#showcase [data-i18n^="show."]');
      if (hint) { hint.dataset.i18n = pinned ? 'show.hint' : 'show.swipe'; hint.textContent = t(hint.dataset.i18n, ''); }
      if (!isWinter()) return;
      if (!pinned) {
        // Native horizontal scroll with snap; reveal panels as they enter.
        $$('.sc-media img', track).forEach(img => { img.style.opacity = ''; });
        return;
      }
      gsap.registerPlugin(ScrollTrigger);
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      tween = gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: { trigger: '#showcase', start: 'top 14%', end: () => '+=' + distance(), pin: true, scrub: .8, invalidateOnRefresh: true, refreshPriority: 1, anticipatePin: 1 } });
      $$('.sc-panel', track).forEach(panel => {
        const img = $('.sc-media img', panel);
        const reveal = gsap.fromTo(img, { clipPath: 'inset(0% 0% 0% 100%)', scale: 1.15 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.1, ease: 'power3.out', scrollTrigger: { containerAnimation: tween, trigger: panel, start: 'left 92%', toggleActions: 'play none none reverse' } });
        const drift = gsap.fromTo(img, { xPercent: -5 }, { xPercent: 5, ease: 'none', scrollTrigger: { containerAnimation: tween, trigger: panel, start: 'left right', end: 'right left', scrub: true } });
        triggers.push(reveal.scrollTrigger, drift.scrollTrigger);
      });
    }
    build();
    return { sync, relabel };
  })();

  /* ================= FROZEN DATA ================= */
  const FrozenData = (() => {
    const section = $('#data'); if (!section) return { relabel() {} };
    const kpiRoot = $('#frostKpis'), bars = $('#frostBars'), ring = $('#frostRing');
    const DEMO_BARS = [12, 18, 15, 22, 19, 9, 6];
    const DEMO_SHARE = [46, 28, 16, 10];
    const COLORS = ['#821d32', '#192632', '#9fb3c4', '#dceaf5'];
    let shown = false;
    function startPrice() {
      const rendered = $$('#planList .pl-price b').map(b => Number(b.textContent.replace(/[^0-9.]/g, ''))).filter(Number.isFinite);
      const local = ((window.SITE && SITE.plans) || []).map(p => p.price);
      const all = rendered.length ? rendered : local; return all.length ? Math.min(...all) : 299;
    }
    function kpis() {
      return [
        { v: ((window.SITE && SITE.services) || []).length || 5 },
        { v: 4 }, { v: 3 }, { v: startPrice(), prefix: '$' }
      ];
    }
    function render() {
      const labels = t('data.kpi', []) || [];
      kpiRoot.innerHTML = kpis().map((k, i) => `<div class="frost-kpi" style="--k:${i}"><b data-count="${k.v}" data-prefix="${k.prefix || ''}">${shown || reduced ? (k.prefix || '') + k.v.toLocaleString('en-US') : (k.prefix || '') + '0'}</b><span>${Platform.escape(labels[i] || '')}</span></div>`).join('');
      const days = t('data.days', []) || [];
      const W = 520, H = 220, base = 182, max = Math.max(...DEMO_BARS), step = (W - 40) / DEMO_BARS.length;
      const grid = [0, 1, 2, 3].map(i => { const y = base - (base - 20) * i / 3; return `<line class="fd-grid" x1="30" x2="${W}" y1="${y}" y2="${y}"/>`; }).join('');
      const rects = DEMO_BARS.map((v, i) => { const bh = v / max * (base - 24); return `<rect class="fd-bar" style="--i:${i}" x="${(40 + step * i + step * .22).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${(step * .56).toFixed(1)}" height="${bh.toFixed(1)}"/><text x="${(40 + step * (i + .5)).toFixed(1)}" y="${base + 22}" text-anchor="middle">${Platform.escape(days[i] || '')}</text>`; }).join('');
      bars.style.setProperty('--k', 4);
      bars.innerHTML = `<figcaption><span>${Platform.escape(t('data.chart1', ''))}</span><em>DEMO</em></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${Platform.escape(t('data.chart1', ''))} — ${Platform.escape(t('data.demoAria', ''))}: ${DEMO_BARS.map((v, i) => (days[i] || i + 1) + ' ' + v).join(', ')}"><defs><linearGradient id="fdGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9b2a42"/><stop offset="1" stop-color="#dceaf5"/></linearGradient></defs>${grid}${rects}</svg>`;
      const channels = t('data.channels', []) || []; const R = 62, C = 2 * Math.PI * R; let acc = 0;
      const segs = DEMO_SHARE.map((v, i) => { const len = C * v / 100, off = -acc; acc += len; return `<circle class="fd-ring-seg" style="--i:${i};--len:${len.toFixed(1)}px;--gap:${(C - len).toFixed(1)}px;--c:${C.toFixed(1)}px" cx="90" cy="90" r="${R}" stroke="${COLORS[i]}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 90 90)"/>`; }).join('');
      ring.style.setProperty('--k', 5);
      ring.innerHTML = `<figcaption><span>${Platform.escape(t('data.chart2', ''))}</span><em>DEMO</em></figcaption><svg viewBox="0 0 180 180" role="img" aria-label="${Platform.escape(t('data.chart2', ''))} — ${Platform.escape(t('data.demoAria', ''))}: ${DEMO_SHARE.map((v, i) => (channels[i] || '') + ' ' + v + '%').join(', ')}"><circle class="fd-ring-track" cx="90" cy="90" r="${R}"/>${segs}<text x="90" y="86" text-anchor="middle" style="font:500 22px Unbounded,Arial,sans-serif;fill:#192632">100%</text><text x="90" y="106" text-anchor="middle">${Platform.escape(t('data.total', ''))}</text></svg><div class="fd-legend">${DEMO_SHARE.map((v, i) => `<span><i style="background:${COLORS[i]}"></i>${Platform.escape(channels[i] || '')} — ${v}%</span>`).join('')}</div>`;
    }
    function countUp() {
      $$('[data-count]', kpiRoot).forEach(el => {
        const target = Number(el.dataset.count), prefix = el.dataset.prefix || '', t0 = performance.now();
        if (reduced) { el.textContent = prefix + target.toLocaleString('en-US'); return; }
        (function tick(now) { const k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 3); el.textContent = prefix + Math.round(target * e).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(tick); })(t0);
      });
    }
    render();
    if (!reduced && 'IntersectionObserver' in window) {
      section.classList.add('fd-armed');
      const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) { shown = true; section.classList.add('fd-in'); setTimeout(countUp, 350); io.disconnect(); } }, { threshold: .2 });
      io.observe(section);
    } else shown = true;
    return { relabel: render };
  })();

  /* ================= THEME SWITCH ================= */
  function syncThemeButtons() { $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(window.Theme && b.dataset.themeSet === Theme.get()))); }
  $$('[data-theme-set]').forEach(b => b.addEventListener('click', () => window.Theme && Theme.set(b.dataset.themeSet)));
  function syncAll() { Snow.sync(); Network.sync(); }
  document.addEventListener('site:theme', () => {
    syncThemeButtons(); syncAll(); Showcase.sync(); drawIceLines();
    if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
  });
  document.addEventListener('site:language', () => { Network.relabel(); Showcase.relabel(); FrozenData.relabel(); });
  document.addEventListener('visibilitychange', syncAll);
  new MutationObserver(syncAll).observe(document.body, { attributes: true, attributeFilter: ['class'] }); // "pause animations" toggle

  syncThemeButtons(); setupSchemeFlakes(); setupGlassGlow(); syncAll(); Showcase.sync(); drawIceLines();
  if (window.ScrollTrigger) addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
