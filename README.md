# AI EMPIRE V3

Рабочая AI-бизнес-платформа: публичный сайт, FastAPI/PostgreSQL API и защищённый owner workspace на `/admin`.

## Что готово

- Премиальная кремово-винная дизайн-система с Unbounded, локальными оптимизированными WebP, SVG и Canvas.
- Hero с последовательным появлением слов, SVG-конвейер `Lead → AI Agent → CRM → Result` с движущимися сигналами и управлением, анимированные маски, параллакс, horizontal portfolio, вкладки SaaS и сценарная локальная демоверсия AI-администратора.
- Пять страниц услуг, три страницы AI-продуктов и портфолио. Демонстрации обозначены как Demo; нет вымышленных клиентов, отзывов или показателей.
- Публичные цены в USD: отдельные стартовые каталоги для сайтов, AI-ботов, автоматизации и SaaS (`START $299`, `GROWTH $799`, `CUSTOM $1,999`). PostgreSQL — источник цен и контента; публичная страница обновляет их через API. Статическая подстановка — только для локального предпросмотра без API.
- `/admin`: Overview, CRM, Leads, Projects, AI Agents, Finance, Analytics, Content Manager, Pricing Manager, Settings. Данные загружаются из защищённого API; при пустой базе интерфейс показывает пустые состояния, а не показатели.
- FastAPI, PostgreSQL, Alembic, сессия владельца в HttpOnly cookie, CSRF, журнал действий, антиспам/ограничение частоты, безопасная загрузка WebP, лимиты AI-задач и их остановка.

- **Winter Edition 2026**: темы Winter (по умолчанию) и Classic. Переключатель в шапке, выбор посетителя сохраняется. Публичную тему владелец меняет в `/admin` → Settings (хранится в PostgreSQL, миграция `0002_public_theme`). Снег на Canvas, Frost Network, Winter Showcase, Frozen Data, стеклянные карточки, зимняя админка. Без backend сайт не делает запросов к API.

Полный аудит, последовательность фаз и ключевые решения: [docs/V3_IMPLEMENTATION.md](docs/V3_IMPLEMENTATION.md). Источники WebP: [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md).

## Запуск

### Docker (рабочий режим)

1. Скопируйте `.env.example` в `.env`, задайте новый `POSTGRES_PASSWORD` и случайный `IP_HASH_SALT` длиной 32+ символов.
2. Запустите стек:

```powershell
docker compose up --build
```

3. В другом терминале создайте единственного владельца (пароль вводится скрыто):

```powershell
docker compose exec api python -m backend.app.cli create-owner --email you@example.com
```

Откройте [http://localhost:8000](http://localhost:8000) и [http://localhost:8000/admin](http://localhost:8000/admin). Миграция и пустой каталог USD применяются автоматически; заявки, финансовые записи и клиентские проекты не создаются.

### Локальный статический предпросмотр

```powershell
python -m http.server 5500
```

Откройте [http://localhost:5500](http://localhost:5500). Интерактивные демо работают, форма честно сообщает о недоступности API, а тарифы отображаются из предварительной локальной конфигурации. `/admin` и сохранение данных требуют FastAPI/PostgreSQL.

## Настройка перед выпуском

- Укажите реальный бренд, контакты и соцсети в [js/config.js](js/config.js); API-контакты также редактируются через Content Manager после первого входа.
- Задайте `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, `COOKIE_SECURE=true` в production и используйте HTTPS.
- Для Claude задайте ключ и стоимость токенов только в серверном `.env`. Для Codex укажите только заранее настроенный серверный исполняемый файл/рабочую папку. Браузер не получает ключи.
- Публичный API намеренно не создаёт реальные запусков AI; задачи запускаются только владельцем из `/admin`, резервируют бюджет и могут быть отменены.

## Проверки

```powershell
node --check js/main.js
node --check js/premium.js
node --check admin/admin.js
cd backend
.\.venv\Scripts\python -m pytest
```

Фактические результаты последней проверки — в `docs/VERIFICATION.md`.
