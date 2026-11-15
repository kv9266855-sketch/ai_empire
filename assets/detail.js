/* Progressive enhancement: all page content and links work without JavaScript. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value));
  const pricingRoot = document.querySelector('[data-pricing-category]');
  const make = (tag, cls, content) => { const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el; };
  const safeLink = value => { try { const url=new URL(value,location.origin);return ['http:','https:'].includes(url.protocol) ? url.href : null; } catch {return null;} };
  function renderPrices(prices) {
    const plans = prices.filter(p => p.category===pricingRoot.dataset.pricingCategory && p.active!==false).sort((a,b)=>['start','growth','custom'].indexOf(a.tier)-['start','growth','custom'].indexOf(b.tier));
    if(!plans.length){ pricingRoot.replaceChildren(make('p','d-product-statement','Тарифы для этого направления уточняются. Оставьте заявку — подготовим предложение.'));return; }
    pricingRoot.replaceChildren(...plans.map(plan => {
      const article=make('article','d-plan');
      const price=make('p','d-price');price.append(make('small','','от'),document.createTextNode(money(plan.price_usd)));
      const list=make('ul');(Array.isArray(plan.features)?plan.features:[]).forEach(feature=>list.append(make('li','',feature)));
      const link=make('a','d-text-link','Обсудить пакет ↗');link.href='/?service='+encodeURIComponent(plan.category)+'&plan='+encodeURIComponent(plan.tier)+'#contact';
      article.append(make('h3','',plan.name),price,make('p','d-interval',plan.interval==='month'?'USD / месяц':'USD / проект'),make('p','d-plan-description',plan.description||''),list,link);return article;
    }));
    const status=document.querySelector('[data-price-status]');if(status)status.textContent='Актуальные предварительные тарифы из каталога. Итоговый объём и стоимость согласовываются после брифа.';
  }
  function catalogProduct(products) {
    const slug=document.body.dataset.product;if(!slug)return;
    const product=products.find(p=>p.slug===slug&&p.active!==false);if(!product)return;
    const label={soon:'Coming soon',beta:'Beta',available:'Available'}[product.status]||'Coming soon';
    document.querySelectorAll('[data-product-status]').forEach(el=>el.textContent=label);
    const blurb=document.querySelector('[data-product-description]');if(blurb&&product.description)blurb.textContent=product.description;
    if(product.status==='available'||product.status==='beta') {
      const href=safeLink(product.url);if(href)document.querySelectorAll('[data-product-link]').forEach(el=>{el.href=href;el.textContent='Открыть продукт ↗';});
      const message=document.querySelector('[data-product-availability]');if(message)message.textContent=product.status==='beta'?'Продукт в beta. Условия доступа и доступные возможности уточняйте в описании продукта.':'Продукт доступен. Откройте его, чтобы проверить актуальные возможности и условия.';
    }
  }
  // Only ask the API when FastAPI serves the page (js/runtime.js); static preview keeps the prerendered prices.
  if((pricingRoot||document.body.dataset.product)&&window.SITE_RUNTIME&&window.SITE_RUNTIME.api) {
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
    fetch('/api/v1/public/bootstrap',{signal:controller.signal,headers:{Accept:'application/json'}}).then(response=>{if(!response.ok)throw new Error('catalog');return response.json();}).then(data=>{if(pricingRoot&&Array.isArray(data.pricing))renderPrices(data.pricing);if(Array.isArray(data.products))catalogProduct(data.products);}).catch(()=>{const status=document.querySelector('[data-price-status]');if(status)status.textContent='Предварительные ориентиры. Сейчас каталог недоступен; актуальную стоимость уточним после заявки.';}).finally(()=>clearTimeout(timeout));
  }
  const filterButtons=[...document.querySelectorAll('[data-filter]')];
  filterButtons.forEach(button=>button.addEventListener('click',()=>{
    filterButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    document.querySelectorAll('[data-project-category]').forEach(item=>{item.hidden=button.dataset.filter!=='all'&&item.dataset.projectCategory!==button.dataset.filter;if(!item.hidden&&!reduced){item.classList.remove('d-animate-in');void item.offsetWidth;item.classList.add('d-animate-in');}});
    const count=[...document.querySelectorAll('[data-project-category]')].filter(el=>!el.hidden).length;
    const status=document.querySelector('[data-filter-status]');if(status)status.textContent='Показано примеров: '+count;
  }));
  const log=document.querySelector('[data-chat-log]');
  if(!log)return;
  let timer=null;let busy=false;
  const controls=[...document.querySelectorAll('[data-scenario]')];
  const add=(text,type='agent')=>{const message=make('p','d-bubble'+(type==='agent'?'':' d-bubble--'+type),text);if(!reduced)message.classList.add('d-animate-in');log.append(message);log.scrollTop=log.scrollHeight;};
  const greeting='Здравствуйте! Я демонстрационный AI-администратор. Выберите сценарий: запись, стоимость или разговор с менеджером.';
  const scripts={
    booking:{question:'Хочу записаться на консультацию.',answer:'Конечно. В рабочей версии я проверю календарь, предложу свободное время и передам подтверждённую запись в CRM.',event:'Демо: карточка «Консультация» подготовлена. Настоящая запись не создавалась.'},
    price:{question:'Сколько стоит AI-администратор?',answer:'Стоимость зависит от каналов общения, базы знаний и интеграций. Предварительные пакеты указаны ниже. Чтобы рассчитать ваш сценарий, расскажите о задаче в форме заявки.',event:'Демо: вопрос о тарифах классифицирован. Платные запросы к AI не выполнялись.'},
    human:{question:'Хочу поговорить с человеком.',answer:'В рабочей версии передам контекст менеджеру и отмечу, что вам нужен личный ответ. Для реальной связи воспользуйтесь формой «Обсудить проект».',event:'Демо: передача человеку. Уведомление менеджеру не отправлялось.'}
  };
  controls.forEach(button=>button.addEventListener('click',()=>{
    if(busy)return;busy=true;controls.forEach(el=>el.disabled=true);const scenario=scripts[button.dataset.scenario];
    add(scenario.question,'user');
    timer=setTimeout(()=>{add(scenario.answer);add(scenario.event,'system');busy=false;controls.forEach(el=>el.disabled=false);timer=null;},reduced?0:650);
  }));
  document.querySelector('[data-reset-chat]')?.addEventListener('click',()=>{if(timer)clearTimeout(timer);busy=false;controls.forEach(el=>el.disabled=false);log.replaceChildren();add(greeting);});
})();
