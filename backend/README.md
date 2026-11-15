# AI EMPIRE API

FastAPI API для публичной формы, PostgreSQL-каталога и owner workspace `/admin`.

## Запуск

В корне проекта скопируйте `.env.example` в `.env`, задайте новые `POSTGRES_PASSWORD` и `IP_HASH_SALT`, затем выполните:

```powershell
docker compose up --build
docker compose exec api python -m backend.app.cli create-owner --email you@example.com
```

Контейнер автоматически применяет Alembic-миграцию и создаёт только пустой системный каталог: USD-тарифы по категориям, услуги и продукты. Он не создаёт лиды, клиентов, финансовые операции и AI-задачи.

## API

- `GET /health`
- `POST /api/v1/leads` — входящая заявка; honeypot/слишком быстрые отправки отвечают `201`, но не сохраняются.
- `GET /api/v1/public/bootstrap` — опубликованные услуги, тарифы, портфолио, продукты и контент.
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
- `/api/v1/admin/*` — защищённые CRM, каталог, финансы, задачи, журналы и настройки.

Owner session хранится в `HttpOnly; SameSite=Strict` cookie. Любое изменение после авторизации требует заголовок `X-CSRF-Token`, полученный от `login` или `auth/me`. API хранит только SHA-256 сессии и salted hash IP; сырые IP и API-ключи не сохраняются.

## AI providers

Claude и Codex запускаются только владельцем из admin UI после настройки сервера. Они не вызываются автоматически из публичной формы. Задача резервирует лимит до запуска и допускает отмену; сервер ведёт журнал. Браузер не получает ключи.

Для Claude укажите `ANTHROPIC_API_KEY` и проверенные цены токенов. Для Codex задайте абсолютный `CODEX_EXECUTABLE` и выделенную серверную `CODEX_WORKSPACE`; ограничение поставщика нужно также настроить у самого поставщика, потому что CLI не может гарантировать жёсткий долларовый предел за запуск.

## Проверка

```powershell
cd backend
.\.venv\Scripts\python -m pytest
```

Интеграционные тесты используют SQLite только с `ENVIRONMENT=test`. Production lifespan немедленно отклоняет SQLite и требует PostgreSQL.
