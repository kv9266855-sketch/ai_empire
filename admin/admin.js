(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const API = '/api/v1';
  const state = { user: null, csrf: '', page: 'overview', section: 'content', offset: 0, limit: 50, generation: 0, rows: [], total: 0 };
  const pages = {
    overview: ['Overview', '◫', 'YOUR BUSINESS, CONNECTED', 'Реальные данные вашего бизнеса в одном месте.'],
    crm: ['CRM', '⊞', 'RELATIONSHIPS THAT MATTER', 'Заявки от первого контакта до совместного проекта.'],
    leads: ['Leads', '↙', 'EVERY CONVERSATION COUNTS', 'Заявки с сайта, контакты и история работы с ними.'],
    projects: ['Projects', '▤', 'FROM IDEA TO DELIVERY', 'Статусы, стоимость и детали ваших проектов.'],
    agents: ['AI Agents', '✳', 'INTELLIGENCE, WITH CONTROL', 'Claude и Codex: задачи, журналы и лимиты расходов.'],
    finance: ['Finance', '＄', 'A CLEAR FINANCIAL PICTURE', 'Поступления и расходы в USD. Только сохранённые операции.'],
    analytics: ['Analytics', '↗', 'UNDERSTAND THE SIGNAL', 'Динамика заявок и финансов из вашей базы данных.'],
    content: ['Content Manager', '≡', 'YOUR STORY, YOUR VOICE', 'Тексты, услуги, продукты, портфолио и фотографии сайта.'],
    pricing: ['Pricing Manager', '◇', 'VALUE, CLEARLY DEFINED', 'Публичные тарифы в USD. Изменения сохраняются в базе данных.'],
    settings: ['Settings', '⚙', 'SET THE BOUNDARIES', 'Лимиты AI, автоматизации и журнал действий владельца.']
  };
  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
  const statusLabels = { new: 'Новая', contacted: 'Связались', qualified: 'Квалифицирована', proposal: 'Предложение', won: 'Выиграна', lost: 'Закрыта', discovery: 'Анализ', in_progress: 'В работе', review: 'На проверке', completed: 'Завершён', paused: 'Пауза', queued: 'В очереди', running: 'Выполняется', succeeded: 'Выполнена', failed: 'Ошибка', cancelled: 'Отменена', stopped: 'Остановлена', soon: 'Coming soon', beta: 'Beta', available: 'Available' };
  const categories = { web: 'Сайты', assistants: 'AI-боты', automation: 'Автоматизация', saas: 'SaaS-подписки', leadgen: 'Лидогенерация', other: 'Другое' };
  const fields = {
    leads: [field('name', 'Имя', 'text', true, { max: 80 }), field('contact', 'Email или Telegram', 'text', true, { max: 120 }), field('service', 'Услуга', 'select', true, { options: categories }), field('budget', 'Бюджет', 'select', true, { options: { lt299: 'До $299', '299-799': '$299–799', '799-1999': '$799–1,999', '1999+': 'От $1,999', unknown: 'Не определён' } }), field('message', 'Описание задачи', 'textarea', true, { max: 2000 }), field('status', 'Статус', 'select', true, { options: Object.fromEntries(statuses.map(x => [x, statusLabels[x]])) }), field('notes', 'Внутренние заметки', 'textarea'), field('lang', 'Язык', 'select', true, { options: { ru: 'Русский', ua: 'Українська', en: 'English' } })],
    projects: [field('title', 'Название проекта', 'text', true, { max: 160 }), field('client', 'Клиент', 'text', true, { max: 160 }), field('status', 'Статус', 'select', true, { options: Object.fromEntries(['discovery', 'in_progress', 'review', 'completed', 'paused'].map(x => [x, statusLabels[x]])) }), field('value_usd', 'Стоимость, USD', 'number', true, { min: 0, step: '.01' }), field('description', 'Описание', 'textarea')],
    agents: [field('name', 'Название агента', 'text', true, { max: 100 }), field('provider', 'Провайдер', 'select', true, { options: { claude: 'Claude API', codex: 'Codex CLI' } }), field('model', 'Идентификатор модели', 'text', true, { help: 'Модель должна поддерживаться настроенным на сервере провайдером.' }), field('system_prompt', 'Системная инструкция', 'textarea', true), field('monthly_budget_usd', 'Месячный лимит, USD', 'number', true, { min: 0, step: '.01' }), field('max_output_tokens', 'Максимум выходных токенов', 'number', true, { min: 64, max: 32000, step: '1' }), field('enabled', 'Агент включён', 'checkbox')],
    finance: [field('kind', 'Тип операции', 'select', true, { options: { income: 'Поступление', expense: 'Расход' } }), field('amount_usd', 'Сумма, USD', 'number', true, { min: .01, step: '.01' }), field('description', 'Назначение', 'text', true, { max: 500 }), field('occurred_on', 'Дата', 'date', true)],
    content: [field('key', 'Ключ контента', 'text', true, { help: 'Ключ из словаря сайта, например hero.title или hero.sub. Отдельные ключи hero.image, about.image, immersion.image принимают путь загруженного фото; contact.email и contact.telegram — публичные контакты.', max: 120 }), field('lang', 'Язык', 'select', true, { options: { ru: 'Русский', ua: 'Українська', en: 'English', all: 'Все языки' } }), field('value', 'Текст / значение', 'textarea', true)],
    pricing: [field('category', 'Направление', 'select', true, { options: Object.fromEntries(Object.entries(categories).filter(([k]) => ['web', 'assistants', 'automation', 'saas'].includes(k))) }), field('tier', 'Пакет', 'select', true, { options: { start: 'START', growth: 'GROWTH', custom: 'CUSTOM' } }), field('name', 'Название тарифа', 'text', true, { max: 80 }), field('price_usd', 'Цена от, USD', 'number', true, { min: 0, step: '.01' }), field('interval', 'Период', 'select', true, { options: { once: 'Разовый платёж', month: 'В месяц' } }), field('description', 'Описание', 'textarea'), field('features', 'Что входит — по одному пункту на строку', 'lines'), field('active', 'Показывать на сайте', 'checkbox')],
    services: [field('slug', 'URL-идентификатор', 'text', true, { help: 'Используйте существующие идентификаторы: web, assistants, automation, leadgen, saas.' }), field('title', 'Название', 'text', true), field('description', 'Описание', 'textarea', true), field('features', 'Преимущества — по одному на строку', 'lines'), field('image', 'URL фотографии', 'text', false, { help: 'Загрузите фотографию ниже и скопируйте её путь.' }), field('active', 'Опубликовано', 'checkbox')],
    products: [field('slug', 'URL-идентификатор', 'text', true), field('title', 'Название', 'text', true), field('description', 'Описание', 'textarea', true), field('status', 'Статус', 'select', true, { options: { soon: 'Coming soon', beta: 'Beta', available: 'Available' } }), field('url', 'Ссылка на продукт', 'text'), field('image', 'URL фотографии', 'text'), field('active', 'Опубликовано', 'checkbox')],
    portfolio: [field('title', 'Название проекта', 'text', true), field('description', 'Описание', 'textarea', true), field('category', 'Направление', 'select', true, { options: categories }), field('image', 'URL фотографии', 'text'), field('url', 'Ссылка на проект', 'text'), field('technologies', 'Технологии — по одной на строку', 'lines'), field('demo', 'Демонстрационный проект (не клиентский кейс)', 'checkbox'), field('active', 'Опубликовано', 'checkbox')]
  };
  const resourceTitles = { leads: 'Заявка', projects: 'Проект', agents: 'AI-агент', finance: 'Финансовая операция', content: 'Контент', pricing: 'Тариф', services: 'Услуга', products: 'SaaS-продукт', portfolio: 'Проект портфолио', tasks: 'AI-задача' };
  function field(name, label, type, required = false, extra = {}) { return { name, label, type, required, ...extra }; }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'checked' || key === 'disabled' || key === 'required' || key === 'hidden') node[key] = !!value;
      else node.setAttribute(key, value);
    });
    children.flat(Infinity).forEach(child => { if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child))); });
    return node;
  }
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value) || 0);
  const date = value => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'Europe/Kyiv' }).format(new Date(value)) : '—';
  const dateTime = value => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' }).format(new Date(value)) : '—';
  const items = result => Array.isArray(result) ? result : result?.items || [];
  function safeImage(value) { return typeof value === 'string' && (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value)) ? value : ''; }
  function badge(value) { return el('span', { class: 'badge ' + (['won', 'completed', 'succeeded', 'available', 'enabled'].includes(value) ? 'good' : ['lost', 'failed', 'cancelled', 'stopped'].includes(value) ? 'bad' : ['queued', 'running', 'beta', 'paused', 'soon'].includes(value) ? 'warn' : '') }, statusLabels[value] || value); }
  function button(label, action, style = 'button-outline', small = false) { return el('button', { type: 'button', class: 'button ' + style + (small ? ' button-small' : ''), onclick: action }, label); }
  function notice(text) { return el('div', { class: 'notice' }, el('p', {}, text)); }
  function toast(message, error = false) { const node = el('div', { class: 'toast' + (error ? ' error' : '') }, message); $('#toasts').append(node); setTimeout(() => node.remove(), 6500); }
  function empty(title, message, action) { return el('div', { class: 'empty-state' }, el('span', { class: 'empty-icon', 'aria-hidden': 'true' }, '◌'), el('h3', {}, title), el('p', {}, message), action); }
  function errorText(data) {
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.error === 'string') return ({ invalid_credentials: 'Неверный email или пароль.', rate_limited: 'Слишком много попыток. Повторите позже.', unauthorized: 'Сессия завершилась. Войдите снова.', budget_exceeded: 'Задача превышает доступный лимит расходов.', provider_unavailable: 'Провайдер не настроен на сервере.', csrf_invalid: 'Сессия обновилась. Перезагрузите страницу.' })[data.error] || data.error;
    if (Array.isArray(data?.detail)) return data.detail.map(x => `${x.loc?.slice(-1)[0] || 'Поле'}: ${x.msg}`).join(' · ');
    if (data?.errors) return Object.entries(data.errors).map(([key, val]) => `${key}: ${val}`).join(' · ');
    return 'Не удалось выполнить запрос. Проверьте данные и подключение.';
  }
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(options.body); }
    if (options.method && options.method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(API + path, { ...options, headers, credentials: 'same-origin', signal: controller.signal });
      const data = response.status === 204 ? null : await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && !path.endsWith('/login')) showLogin();
        const error = new Error(errorText(data)); error.status = response.status; throw error;
      }
      $('#connectionStatus').classList.remove('error');
      return data;
    } catch (error) {
      $('#connectionStatus').classList.add('error');
      if (error.name === 'AbortError') throw new Error('Сервер не ответил вовремя. Повторите запрос.');
      if (error instanceof TypeError) throw new Error('Нет соединения с сервером. Запустите FastAPI и PostgreSQL.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function action(path, options, success, reload = true) {
    try { const result = await request(path, options); if (success) toast(success); if (reload) await renderPage(); return result; }
    catch (error) { toast(error.message, true); return null; }
  }
  function showLogin() { state.user = null; state.csrf = ''; state.generation++; $('#app').hidden = true; $('#loginScreen').hidden = false; if ($('#editorDialog').open) $('#editorDialog').close(); if ($('#detailDialog').open) $('#detailDialog').close(); }
  function showApp(auth) {
    state.user = auth.user; state.csrf = auth.csrf_token; $('#loginScreen').hidden = true; $('#app').hidden = false; $('#ownerName').textContent = auth.user.email;
    // Show the database the server actually reports, never an assumed one.
    fetch('/health', { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : Promise.reject(r)).then(health => { const status = $('#connectionStatus'); status.lastChild.textContent = ' ' + (health.database === 'postgresql' ? 'PostgreSQL' : 'SQLite · test mode'); status.classList.toggle('error', health.database !== 'postgresql'); }).catch(() => $('#connectionStatus').classList.add('error'));
    const page = location.hash.slice(1).split('/')[0]; state.page = pages[page] ? page : 'overview'; renderPage();
  }
  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault(); const submit = $('button[type=submit]', event.currentTarget); submit.disabled = true; $('#loginError').textContent = '';
    try { const auth = await request('/auth/login', { method: 'POST', body: { email: event.currentTarget.elements.email.value.trim(), password: event.currentTarget.elements.password.value } }); event.target.reset(); showApp(auth); }
    catch (error) { $('#loginError').textContent = error.message; } finally { submit.disabled = false; }
  });
  $('#logoutButton').addEventListener('click', async () => { try { await request('/auth/logout', { method: 'POST' }); showLogin(); } catch (error) { toast(error.message, true); } });
  $('#menuButton').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#menuButton').setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', event => { if (!event.target.closest('#sidebar,#menuButton')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  function closeMenu() { $('#sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded', 'false'); }
  Object.entries(pages).forEach(([key, page]) => $('#adminNav').append(el('a', { href: '#' + key, class: 'nav-link', 'data-page': key }, el('span', { class: 'nav-icon', 'aria-hidden': 'true' }, page[1]), page[0])));
  window.addEventListener('hashchange', () => { const page = location.hash.slice(1); if (!pages[page] || !state.user) return; state.page = page; state.offset = 0; closeMenu(); renderPage(); });
  function pageButton(label, handler, primary = false) { $('#pageActions').append(button(label, handler, primary ? 'button-primary' : 'button-outline')); }
  async function renderPage() {
    if (!state.user) return;
    const generation = ++state.generation; const page = pages[state.page];
    $('#breadcrumb').textContent = page[0]; $('#pageTitle').replaceChildren(page[0], el('span', {}, '.')); $('#pageEyebrow').textContent = page[2]; $('#pageDescription').textContent = page[3]; $('#pageActions').replaceChildren();
    document.querySelectorAll('.nav-link').forEach(link => { const active = link.dataset.page === state.page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    const content = $('#pageContent'); content.setAttribute('aria-busy', 'true'); content.replaceChildren(el('div', { class: 'loading' }, 'Загружаем данные…'));
    pageButton('↻ Обновить', renderPage);
    try {
      let node;
      if (state.page === 'overview') node = await renderOverview();
      else if (state.page === 'crm') node = await renderCRM();
      else if (state.page === 'agents') node = await renderAgents();
      else if (state.page === 'analytics') node = await renderAnalytics();
      else if (state.page === 'settings') node = await renderSettings();
      else if (state.page === 'content') node = await renderContent();
      else node = await renderResource(state.page);
      if (generation !== state.generation) return;
      content.replaceChildren(node); content.classList.remove('page-enter'); void content.offsetWidth; content.classList.add('page-enter'); $('#updatedAt').textContent = 'Обновлено ' + dateTime(new Date().toISOString());
    } catch (error) {
      if (generation !== state.generation) return;
      content.replaceChildren(el('div', { class: 'error-panel', role: 'alert' }, el('h3', {}, 'Данные недоступны'), el('p', {}, error.message), button('Повторить', renderPage)));
    } finally { if (generation === state.generation) content.setAttribute('aria-busy', 'false'); }
  }
  function stat(label, value, note, icon) { return el('article', { class: 'stat-card' }, el('div', { class: 'stat-label' }, label), el('span', { class: 'stat-icon', 'aria-hidden': 'true' }, icon), el('p', { class: 'stat-value' }, value), el('span', { class: 'stat-note' }, note)); }
  function panel(title, subtitle, child) { return el('section', { class: 'panel' }, el('div', { class: 'panel-head' }, el('h2', {}, title), el('span', {}, subtitle)), child); }
  async function renderOverview() {
    const [overview, analytics] = await Promise.all([request('/admin/overview'), request('/admin/analytics')]);
    const root = el('div');
    root.append(el('div', { class: 'stat-grid' }, stat('Всего заявок', overview.leads ?? 0, 'Из базы заявок', '↙'), stat('Проекты', overview.projects ?? 0, 'Сохранённые проекты', '▤'), stat('Поступления', money(overview.revenue_usd), 'Зарегистрированные операции', '↗'), stat('Расходы AI', money(overview.ai_spend_usd), 'Учтённое использование', '✳')));
    const recent = overview.recent_leads || [];
    const leadActivity = recent.length ? el('div', { class: 'activity' }, recent.slice(0, 5).map(lead => el('div', { class: 'activity-item' }, el('i', { class: 'activity-dot' }), el('div', {}, el('strong', {}, lead.name), el('div', {}, categories[lead.service] || lead.service), el('time', {}, dateTime(lead.created_at))), el('div', { style: 'margin-left:auto' }, badge(lead.status))))) : empty('Пока нет заявок', 'Новые заявки с публичной формы появятся здесь автоматически.');
    root.append(el('div', { class: 'dashboard-grid' }, panel('Поток заявок', 'За доступный период', barChart(analytics.leads_by_day || [], 'date', 'count')), panel('Последние обращения', recent.length + ' записей', leadActivity)));
    const recentTasks = overview.recent_tasks || [];
    root.append(panel('AI operations', `${overview.active_agents || 0} активных агентов`, recentTasks.length ? table(['Задача', 'Статус', 'Расход, USD', 'Создана'], recentTasks.slice(0, 5).map(task => [el('strong', {}, truncate(task.prompt || task.id, 70)), badge(task.status), money(task.cost_usd), dateTime(task.created_at)])) : empty('Задачи ещё не запускались', 'Настройте провайдера на сервере, добавьте агента и задайте лимит расходов.', el('a', { href: '#agents', class: 'button button-outline' }, 'Управлять агентами ↗'))));
    return root;
  }
  function truncate(value, max = 100) { const text = String(value ?? ''); return text.length > max ? text.slice(0, max) + '…' : text; }
  function table(headers, rows) {
    const body = el('tbody'); rows.forEach(row => body.append(el('tr', {}, row.map(cell => el('td', {}, cell)))));
    return el('div', { class: 'table-wrap' }, el('table', {}, el('thead', {}, el('tr', {}, headers.map(text => el('th', { scope: 'col' }, text)))), body));
  }
  function editActions(resource, record) { return el('div', { class: 'row-actions' }, button('Изменить', () => openEditor(resource, record), 'button-outline', true), button('Удалить', () => deleteRecord(resource, record), 'button-outline', true)); }
  async function deleteRecord(resource, record) {
    if (!confirm(`Удалить запись «${record.title || record.name || record.key || record.id}»? Это действие нельзя отменить.`)) return;
    await action(`/admin/${resource}/${encodeURIComponent(record.id)}`, { method: 'DELETE' }, 'Запись удалена.');
  }
  function statusSelect(lead) {
    const select = el('select', { class: 'table-status', 'aria-label': 'Статус заявки ' + lead.name }, statuses.map(value => el('option', { value }, statusLabels[value]))); select.value = lead.status;
    select.addEventListener('change', async () => { select.disabled = true; const next = select.value; const result = await action('/admin/leads/' + lead.id, { method: 'PATCH', body: { status: next } }, 'Статус заявки обновлён.', state.page === 'crm'); if (result) lead.status = next; else select.value = lead.status; select.disabled = false; }); return select;
  }
  function resourceTable(resource, records) {
    if (!records.length) return empty('Записей пока нет', 'Добавьте первую запись. Данные сохраняются в PostgreSQL.', button('Добавить запись ↗', () => openEditor(resource), 'button-primary'));
    if (resource === 'leads') return table(['Контакт', 'Услуга / бюджет', 'Статус', 'Получена', 'Действия'], records.map(row => [el('div', {}, el('strong', {}, row.name), el('span', { class: 'secondary' }, row.contact)), el('div', {}, categories[row.service] || row.service, el('span', { class: 'secondary' }, row.budget)), statusSelect(row), date(row.created_at), el('div', { class: 'row-actions' }, button('Открыть', () => showLead(row), 'button-outline', true), button('Изменить', () => openEditor(resource, row), 'button-outline', true))]));
    if (resource === 'projects') return table(['Проект', 'Клиент', 'Статус', 'Стоимость', 'Действия'], records.map(row => [el('strong', {}, row.title), row.client, badge(row.status), money(row.value_usd), editActions(resource, row)]));
    if (resource === 'finance') return table(['Дата', 'Тип', 'Назначение', 'Сумма', 'Действия'], records.map(row => [date(row.occurred_on), badge(row.kind === 'income' ? 'Поступление' : 'Расход'), row.description, money(row.amount_usd), editActions(resource, row)]));
    if (resource === 'pricing') return table(['Направление', 'Тариф', 'Цена, USD', 'Описание', 'Публикация', 'Действия'], records.map(row => [categories[row.category] || row.category, el('strong', {}, row.name), money(row.price_usd) + (row.interval === 'month' ? ' / мес.' : ''), truncate(row.description, 65), badge(row.active ? 'Опубликован' : 'Скрыт'), editActions(resource, row)]));
    if (resource === 'content') return table(['Ключ', 'Язык', 'Значение', 'Действия'], records.map(row => [el('strong', {}, row.key), row.lang.toUpperCase(), truncate(row.value, 110), editActions(resource, row)]));
    return table(['Фото', 'Название', resource === 'products' ? 'Статус' : 'Тип', 'Публикация', 'Действия'], records.map(row => [safeImage(row.image) ? el('img', { src: safeImage(row.image), alt: '', class: 'resource-thumb', loading: 'lazy' }) : '—', el('div', {}, el('strong', {}, row.title), el('span', { class: 'secondary' }, truncate(row.description, 75))), resource === 'products' ? badge(row.status) : resource === 'portfolio' ? badge(row.demo ? 'Demo Project' : 'Клиентский кейс') : row.slug, badge(row.active ? 'Опубликовано' : 'Скрыто'), editActions(resource, row)]));
  }
  async function renderResource(resource, embedded = false) {
    if (!embedded) pageButton('+ Добавить', () => openEditor(resource), true);
    const response = await request(`/admin/${resource}?limit=${state.limit}&offset=${state.offset}`); const records = items(response); state.rows = records; state.total = response.total ?? records.length;
    const root = el('div'); const container = el('div');
    const search = el('input', { type: 'search', placeholder: 'Поиск в загруженных записях…', 'aria-label': 'Поиск записей' });
    const filter = ['leads', 'pricing'].includes(resource) ? el('select', { 'aria-label': resource === 'pricing' ? 'Фильтр направления' : 'Фильтр статуса' }, el('option', { value: '' }, 'Все ' + (resource === 'pricing' ? 'направления' : 'статусы')), Object.entries(resource === 'pricing' ? categories : Object.fromEntries(statuses.map(x => [x, statusLabels[x]]))).map(([value, label]) => el('option', { value }, label))) : null;
    const count = el('span', { class: 'count-label' });
    const update = () => { const query = search.value.toLowerCase(); const filtered = records.filter(row => (!query || JSON.stringify(row).toLowerCase().includes(query)) && (!filter?.value || row[resource === 'pricing' ? 'category' : 'status'] === filter.value)); container.replaceChildren(filtered.length ? resourceTable(resource, filtered) : empty(records.length ? 'Ничего не найдено' : 'Записей пока нет', records.length ? 'Измените поисковый запрос или фильтр.' : 'Добавьте первую запись, чтобы начать работу.')); count.textContent = `${filtered.length} на странице / ${state.total} всего`; };
    search.addEventListener('input', update); filter?.addEventListener('change', update);
    root.append(el('div', { class: 'table-toolbar' }, search, filter, count), container); update();
    if (state.total > state.limit) { const prev = button('← Назад', () => { state.offset = Math.max(0, state.offset - state.limit); renderPage(); }, 'button-outline', true); prev.disabled = state.offset === 0; const next = button('Далее →', () => { state.offset += state.limit; renderPage(); }, 'button-outline', true); next.disabled = state.offset + state.limit >= state.total; root.append(el('div', { class: 'pagination' }, prev, `${state.offset + 1}–${Math.min(state.offset + state.limit, state.total)}`, next)); }
    if (resource === 'pricing') root.prepend(notice('Все суммы указаны в USD. Тарифы SaaS могут использовать месячный период. Публичная страница получает актуальные цены из базы.'));
    return root;
  }
  async function renderCRM() {
    pageButton('+ Добавить заявку', () => openEditor('leads'), true);
    const response = await request('/admin/leads?limit=200&offset=0'); const records = items(response);
    const root = el('div'); if (response.total > records.length) root.append(notice(`Показаны последние ${records.length} из ${response.total} заявок. Полный список доступен в Leads с пагинацией.`));
    root.append(el('div', { class: 'kanban' }, statuses.map(status => {
      const matching = records.filter(row => row.status === status);
      return el('section', { class: 'kanban-column', 'aria-label': statusLabels[status] }, el('h2', { class: 'kanban-title' }, statusLabels[status], el('span', {}, matching.length)), matching.length ? matching.map(row => el('article', { class: 'lead-card' }, el('h3', {}, row.name), el('p', {}, row.contact), el('p', {}, categories[row.service] || row.service), statusSelect(row), el('div', { class: 'card-bottom' }, date(row.created_at), el('button', { type: 'button', class: 'inline-link', onclick: () => showLead(row) }, 'Открыть')))) : el('p', { class: 'fine-print' }, 'Заявок на этом этапе нет.'));
    })));
    return root;
  }
  function showLead(row) {
    $('#detailTitle').textContent = row.name; const list = el('dl', { class: 'detail-grid' });
    [['Контакт', row.contact], ['Услуга', categories[row.service] || row.service], ['Бюджет', row.budget], ['Получена', dateTime(row.created_at)], ['Язык', row.lang], ['Страница', row.page], ['Статус', statusLabels[row.status] || row.status]].forEach(([key, value]) => list.append(el('dt', {}, key), el('dd', {}, value || '—')));
    $('#detailContent').replaceChildren(list, el('div', { class: 'detail-message' }, el('h3', {}, 'Сообщение'), row.message), el('div', { class: 'detail-message' }, el('h3', {}, 'Внутренние заметки'), row.notes || 'Пока нет заметок.'), el('div', { class: 'dialog-actions' }, button('Редактировать', () => { $('#detailDialog').close(); openEditor('leads', row); }, 'button-primary'))); $('#detailDialog').showModal();
  }
  async function renderAgents() {
    pageButton('+ Добавить агента', () => openEditor('agents'), true);
    pageButton('Остановить все задачи', async () => { if (confirm('Остановить все автоматические задачи и отключить автоматизации?')) await action('/admin/tasks/stop-all', { method: 'POST' }, 'Автоматизации остановлены.'); });
    const [agentsData, tasksData] = await Promise.all([request('/admin/agents?limit=100&offset=0'), request('/admin/tasks?limit=50&offset=0')]); const agents = items(agentsData), tasks = items(tasksData);
    const root = el('div', {}, notice('Провайдеры работают только на сервере. Запуск задачи требует явного лимита в USD. API-ключи и учётные данные Codex не передаются в браузер.'));
    root.append(agents.length ? el('div', { class: 'agent-grid' }, agents.map(agent => el('article', { class: 'agent-card' }, el('div', { class: 'agent-head' }, el('h2', {}, agent.name), badge(agent.enabled ? 'enabled' : 'paused')), el('p', { class: 'muted' }, (agent.provider === 'codex' ? 'Codex CLI' : 'Claude API') + ' · ' + agent.model), el('div', { class: 'agent-meta' }, el('div', {}, el('small', {}, 'Месячный лимит'), el('b', {}, money(agent.monthly_budget_usd))), el('div', {}, el('small', {}, 'Выходные токены / задача'), el('b', {}, agent.max_output_tokens))), el('div', { class: 'agent-controls' }, button('Новая задача ↗', () => openTask(agent), 'button-primary', true), button(agent.enabled ? 'Пауза' : 'Включить', () => action(`/admin/agents/${agent.id}/${agent.enabled ? 'stop' : 'start'}`, { method: 'POST' }, agent.enabled ? 'Агент остановлен.' : 'Агент включён.'), 'button-outline', true), button('Настройки', () => openEditor('agents', agent), 'button-outline', true))))) : panel('Ваши агенты', 'Нет подключённых агентов', empty('Создайте первого агента', 'Сначала настройте Claude API или Codex на сервере. Затем задайте модель, инструкцию и бюджет.', button('+ Добавить агента', () => openEditor('agents'), 'button-primary'))));
    root.append(el('div', { class: 'section-heading' }, el('h2', {}, 'Журнал задач'), el('span', { class: 'fine-print' }, `Последние ${tasks.length} задач`)));
    root.append(tasks.length ? table(['Задача', 'Агент', 'Статус', 'Резерв / расход', 'Создана', 'Действия'], tasks.map(task => [el('div', {}, el('strong', {}, truncate(task.prompt, 60)), el('span', { class: 'secondary' }, task.id)), agents.find(agent => agent.id === task.agent_id)?.name || truncate(task.agent_id, 14), badge(task.status), money(task.reserved_usd) + ' / ' + money(task.cost_usd), dateTime(task.created_at), el('div', { class: 'row-actions' }, button('Логи', () => showTask(task), 'button-outline', true), ['queued', 'running'].includes(task.status) ? button('Остановить', () => action(`/admin/tasks/${task.id}/cancel`, { method: 'POST' }, 'Запрошена остановка задачи.'), 'button-outline', true) : null)])) : empty('История пока пуста', 'Задачи появятся после явного запуска. Статусы здесь отражают реальные серверные операции.'));
    return root;
  }
  async function showTask(task) {
    $('#detailTitle').textContent = 'AI-задача'; $('#detailContent').replaceChildren(el('div', { class: 'loading' }, 'Загружаем журнал…')); $('#detailDialog').showModal();
    try {
      const logs = items(await request(`/admin/tasks/${task.id}/logs`)); const content = $('#detailContent');
      content.replaceChildren(badge(task.status), el('div', { class: 'detail-message' }, el('h3', {}, 'Инструкция'), task.prompt), el('div', { class: 'detail-message' }, el('h3', {}, 'Результат'), task.output || task.error || 'Результат пока отсутствует.'), el('div', { class: 'section-heading' }, el('h3', {}, 'Серверный журнал')), logs.length ? el('div', { class: 'log-list' }, logs.map(log => el('article', { class: 'log-entry' }, el('time', {}, dateTime(log.created_at) + ' · ' + log.level), el('pre', {}, log.message)))) : empty('Записей нет', 'Сервер ещё не создал записи журнала этой задачи.'));
    } catch (error) { $('#detailContent').replaceChildren(el('p', { class: 'form-error' }, error.message)); }
  }
  function openTask(agent) {
    if (!agent.enabled) { toast('Сначала включите агента.', true); return; }
    openEditor('tasks', null, [field('agent_id', 'Агент', 'select', true, { options: { [agent.id]: agent.name } }), field('prompt', 'Задача агенту', 'textarea', true), field('max_cost_usd', 'Максимальная стоимость задачи, USD', 'number', true, { min: .01, step: '.01', help: 'Сумма резервируется сервером из доступного бюджета до запуска.' })], { agent_id: agent.id, max_cost_usd: 1 });
  }
  function svgNode(tag, attrs = {}, text) { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); if (text !== undefined) node.textContent = text; return node; }
  function barChart(data, labelKey, valueKey, currency = false) {
    const cleaned = data.filter(row => Number.isFinite(Number(row[valueKey]))).slice(-14);
    if (!cleaned.length || cleaned.every(row => Number(row[valueKey]) === 0)) return empty('Пока недостаточно данных', 'График появится после сохранения реальных заявок или операций.');
    const width = 620, height = 235, left = 42, top = 20, baseline = 192, chartWidth = width - left - 12;
    const max = Math.max(...cleaned.map(row => Number(row[valueKey])), 1); const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': cleaned.map(row => `${row[labelKey]}: ${currency ? money(row[valueKey]) : row[valueKey]}`).join('; ') });
    for (let i = 0; i <= 4; i++) { const y = baseline - (baseline - top) * i / 4; svg.append(svgNode('line', { x1: left, x2: width, y1: y, y2: y, stroke: '#e5ddd4', 'stroke-width': 1 }), svgNode('text', { x: left - 9, y: y + 4, 'text-anchor': 'end' }, (max * i / 4).toFixed(currency ? 0 : max < 4 ? 1 : 0))); }
    cleaned.forEach((row, i) => { const step = chartWidth / cleaned.length; const barHeight = Math.max(1, Number(row[valueKey]) / max * (baseline - top)); const rect = svgNode('rect', { x: left + step * i + step * .2, y: baseline - barHeight, width: Math.max(3, step * .6), height: barHeight, class: 'chart-bar', style: '--i:' + i }); rect.append(svgNode('title', {}, `${row[labelKey]}: ${currency ? money(row[valueKey]) : row[valueKey]}`)); svg.append(rect); if (cleaned.length <= 8 || i % 2 === 0) svg.append(svgNode('text', { x: left + step * (i + .5), y: baseline + 24, 'text-anchor': 'middle' }, String(row[labelKey]).slice(5))); });
    return el('div', {}, svg, el('div', { class: 'chart-caption' }, el('span', {}, el('i'), currency ? 'USD' : 'Количество заявок')));
  }
  async function renderAnalytics() {
    const data = await request('/admin/analytics'); const root = el('div');
    root.append(el('div', { class: 'dashboard-grid' }, panel('Динамика заявок', 'Последние доступные даты', barChart(data.leads_by_day || [], 'date', 'count')), panel('Заявки по статусам', 'Все сохранённые заявки', (data.leads_by_status || []).length ? table(['Статус', 'Количество'], data.leads_by_status.map(row => [badge(row.status), String(row.count)])) : empty('Нет данных', 'Статистика появится после первой заявки.'))));
    root.append(panel('Поступления по месяцам', 'USD', barChart(data.revenue_by_month || [], 'month', 'amount', true)), el('p', { class: 'fine-print', style: 'margin-top:16px' }, 'Графики построены на заявках и финансовых операциях из PostgreSQL. Веб-аналитика посещений не собирается.')); return root;
  }
  async function renderContent() {
    const root = el('div'); const subnav = el('div', { class: 'subnav', role: 'tablist', 'aria-label': 'Тип контента' });
    const sections = { content: 'Тексты', services: 'Услуги', products: 'SaaS-продукты', portfolio: 'Портфолио', uploads: 'Фотографии' };
    Object.entries(sections).forEach(([key, title]) => subnav.append(el('button', { type: 'button', role: 'tab', 'aria-selected': state.section === key, tabindex: state.section === key ? '0' : '-1', onclick: () => { state.section = key; state.offset = 0; renderPage(); } }, title)));
    subnav.addEventListener('keydown', event => { const tabs = [...subnav.children]; const index = tabs.indexOf(document.activeElement); if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].click(); });
    root.append(subnav);
    if (state.section === 'uploads') root.append(renderUploads());
    else { pageButton('+ Добавить', () => openEditor(state.section), true); if (state.section === 'portfolio') root.append(notice('Демонстрационные проекты сохраняйте с отметкой Demo Project. Публикуйте клиентские кейсы только с подтверждёнными данными и разрешением клиента.')); root.append(await renderResource(state.section, true)); }
    return root;
  }
  function renderUploads() {
    const result = el('div', { class: 'upload-result', 'aria-live': 'polite' }); const input = el('input', { type: 'file', name: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', required: true });
    const submit = button('Загрузить фотографию ↗', async () => {
      if (!input.files[0]) { input.reportValidity(); return; }
      const file = input.files[0]; if (file.size > 10 * 1024 * 1024) { toast('Максимальный размер — 10 МБ.', true); return; }
      submit.disabled = true; const body = new FormData(); body.append('file', file);
      try { const response = await request('/admin/uploads', { method: 'POST', body }); const url = safeImage(response.url); result.replaceChildren(url ? el('img', { src: url, alt: 'Загруженная фотография' }) : null, el('strong', {}, 'Фотография загружена'), el('code', {}, response.url), el('p', { class: 'fine-print' }, 'Используйте этот URL в поле фотографии услуги, продукта или проекта.'), button('Скопировать URL', async () => { try { await navigator.clipboard.writeText(response.url); toast('URL скопирован.'); } catch (_) { toast('Выделите и скопируйте URL вручную.', true); } }, 'button-outline', true)); input.value = ''; toast('Фотография сохранена на сервере.'); }
      catch (error) { toast(error.message, true); } finally { submit.disabled = false; }
    }, 'button-primary');
    return panel('Библиотека фотографий', 'JPEG · PNG · WebP · AVIF', el('div', {}, el('p', { class: 'muted' }, 'Загружайте только изображения, права на использование которых у вас есть. Сервер проверяет файл и сохраняет оптимизированную копию.'), el('div', { class: 'upload-box' }, el('label', {}, 'Файл изображения, до 10 МБ', input), submit, result)));
  }
  async function renderSettings() {
    const [settings, audit] = await Promise.all([request('/admin/settings'), request('/admin/audit?limit=30&offset=0')]); const root = el('div');
    const budget = el('input', { name: 'monthly_budget_usd', type: 'number', min: '0', step: '.01', value: settings.monthly_budget_usd ?? 0, required: true });
    const automation = el('input', { name: 'automation_enabled', type: 'checkbox', checked: settings.automation_enabled });
    const save = el('button', { type: 'submit', class: 'button button-primary' }, 'Сохранить настройки ↗');
    const form = el('form', { class: 'settings-form', onsubmit: async event => { event.preventDefault(); save.disabled = true; await action('/admin/settings', { method: 'PATCH', body: { monthly_budget_usd: Number(budget.value), automation_enabled: automation.checked } }, 'Настройки сохранены.'); save.disabled = false; } }, el('label', {}, 'Общий месячный лимит AI, USD', budget), el('label', { class: 'checkbox-label', style: 'display:flex;align-items:center;gap:10px' }, automation, 'Автоматические задачи включены'), el('p', { class: 'fine-print' }, 'Лимит применяется на сервере. Отключение автоматизаций запрещает новые запуски; для немедленной остановки используйте кнопку ниже.'), save);
    root.append(el('div', { class: 'settings-grid' }, panel('Расходы и автоматизация', 'USD', form), panel('Контроль доступа', 'OWNER ONLY', el('div', {}, el('p', {}, 'Аккаунт: ', el('strong', {}, state.user.email)), el('p', { class: 'muted' }, 'Сессионная cookie недоступна JavaScript. Изменения защищены CSRF-токеном. Пароли и ключи провайдеров настраиваются на сервере.'), el('p', { class: 'fine-print' }, 'Для смены пароля используйте серверную команду управления владельцем.'), button('Остановить все задачи', async () => { if (confirm('Остановить активные задачи и отключить автоматизации?')) await action('/admin/tasks/stop-all', { method: 'POST' }, 'Запрошена остановка всех задач.'); }, 'button-danger')))));
    // Theme: public theme is stored in PostgreSQL and served to visitors via /js/runtime.js;
    // the admin's own look is a per-browser preference (visitors' saved choice always wins on their side).
    const publicTheme = el('select', { name: 'public_theme' }, el('option', { value: 'winter' }, 'Winter — зимний стиль'), el('option', { value: 'classic' }, 'Classic — классический стиль'));
    publicTheme.value = settings.public_theme || 'winter';
    const themeSave = el('button', { type: 'submit', class: 'button button-primary' }, 'Применить на сайте ↗');
    const themeForm = el('form', { class: 'settings-form', onsubmit: async event => { event.preventDefault(); themeSave.disabled = true; await action('/admin/settings', { method: 'PATCH', body: { public_theme: publicTheme.value } }, 'Публичная тема обновлена.'); themeSave.disabled = false; } }, el('label', {}, 'Активная тема публичного сайта', publicTheme), el('p', { class: 'fine-print' }, 'Применяется к новым посетителям. Посетитель, сам выбравший тему переключателем на сайте, сохраняет свой выбор.'), themeSave);
    const localThemes = el('div', { class: 'theme-choice', role: 'group', 'aria-label': 'Тема панели управления' }, ['winter', 'classic'].map(theme => el('button', { type: 'button', class: 'button button-outline button-small', 'aria-pressed': String(window.Theme && Theme.get() === theme), onclick: event => { if (!window.Theme) return; Theme.set(theme); event.currentTarget.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === event.currentTarget))); } }, theme === 'winter' ? '❄ Winter' : '◐ Classic')));
    root.append(el('div', { class: 'settings-grid', style: 'margin-top:24px' }, panel('Тема сайта', 'WINTER / CLASSIC', themeForm), panel('Тема этой панели', 'ЭТОТ БРАУЗЕР', el('div', {}, el('p', { class: 'muted' }, 'Влияет только на ваш браузер. Таблицы и формы остаются без декоративной анимации.'), localThemes))));
    const records = items(audit); root.append(el('div', { class: 'section-heading' }, el('h2', {}, 'Журнал действий'), el('span', { class: 'fine-print' }, `Последние ${records.length} записей`)), records.length ? table(['Время', 'Действие', 'Ресурс', 'Объект'], records.map(row => [dateTime(row.created_at), row.action, row.resource || row.entity_type || '—', row.resource_id || row.entity_id || '—'])) : empty('Журнал пуст', 'Авторизация и изменения будут отражены в журнале действий.'));
    return root;
  }
  let editor = null;
  function openEditor(resource, record = null, customFields, defaults = {}) {
    const definitions = customFields || fields[resource]; editor = { resource, record, definitions }; $('#editorTitle').textContent = (record ? 'Изменить: ' : 'Создать: ') + resourceTitles[resource]; $('#editorError').textContent = ''; $('#editorFields').replaceChildren();
    const initial = { active: true, demo: true, enabled: false, lang: 'ru', status: resource === 'projects' ? 'discovery' : resource === 'products' ? 'soon' : 'new', service: 'web', budget: 'unknown', category: 'web', tier: 'start', interval: 'once', price_usd: 299, value_usd: 0, monthly_budget_usd: 25, max_output_tokens: 1024, provider: 'claude', occurred_on: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }), ...defaults, ...(record || {}) };
    definitions.forEach(def => {
      let input;
      if (def.type === 'select') { input = el('select', { name: def.name, required: def.required }, Object.entries(def.options).map(([value, label]) => el('option', { value }, label))); input.value = initial[def.name] ?? Object.keys(def.options)[0]; }
      else if (['textarea', 'lines'].includes(def.type)) { input = el('textarea', { name: def.name, required: def.required, maxlength: def.max || 12000, rows: def.type === 'lines' ? 4 : 5 }); input.value = def.type === 'lines' ? (initial[def.name] || []).join('\n') : initial[def.name] ?? ''; }
      else { input = el('input', { name: def.name, type: def.type, required: def.required, min: def.min, max: def.type === 'number' ? def.max : undefined, maxlength: def.type !== 'number' ? def.max || 500 : undefined, step: def.step, checked: initial[def.name] === true }); if (def.type !== 'checkbox') input.value = initial[def.name] ?? ''; }
      $('#editorFields').append(el('label', { class: def.type === 'checkbox' ? 'checkbox-label' : '' }, def.type === 'checkbox' ? input : def.label + (def.required ? ' *' : ''), def.type === 'checkbox' ? def.label : input, def.help ? el('span', { class: 'field-help' }, def.help) : null));
    });
    $('#saveEditor').textContent = resource === 'tasks' ? 'Запустить задачу ↗' : 'Сохранить ↗'; $('#editorDialog').showModal();
  }
  $('#closeEditor').addEventListener('click', () => $('#editorDialog').close()); $('#cancelEditor').addEventListener('click', () => $('#editorDialog').close()); $('#closeDetail').addEventListener('click', () => $('#detailDialog').close());
  $('#editorForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!editor) return; const { resource, record, definitions } = editor; const body = {};
    definitions.forEach(def => { const input = event.currentTarget.elements[def.name]; body[def.name] = def.type === 'checkbox' ? input.checked : def.type === 'number' ? Number(input.value) : def.type === 'lines' ? input.value.split('\n').map(x => x.trim()).filter(Boolean) : input.value.trim(); });
    if (resource === 'leads' && !record) body.page = '/admin';
    $('#saveEditor').disabled = true; $('#editorError').textContent = '';
    try { await request(`/admin/${resource}${record ? '/' + encodeURIComponent(record.id) : ''}`, { method: record ? 'PATCH' : 'POST', body }); $('#editorDialog').close(); toast(resource === 'tasks' ? 'Задача поставлена в очередь.' : 'Изменения сохранены.'); await renderPage(); }
    catch (error) { $('#editorError').textContent = error.message; } finally { $('#saveEditor').disabled = false; }
  });
  request('/auth/me').then(showApp).catch(error => { showLogin(); if (error.status !== 401) $('#loginError').textContent = error.message; });
})();
