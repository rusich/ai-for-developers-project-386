# AGENTS.md — Call Booking (упрощённый Cal.com)

## Контекст проекта

Учебный проект курса «AI для программистов» (Hexlet). Цель — пройти полный цикл разработки небольшого веб-приложения с ИИ как рабочим инструментом. **Вся разработка ведётся через ИИ-агентов**: пользователь формулирует задачи, агент реализует, пользователь проверяет. В идеале пользователь не пишет код вручную.

Подход — **Design First**: сначала фиксируется API-контракт (TypeSpec → OpenAPI), затем фронтенд и бэкенд реализуются **независимо** по контракту. Контракт (`spec/main.tsp` + `spec/openapi/openapi.yaml`) — **единый источник правды** для обеих частей. При изменениях: обновить контракт → перекомпилировать → синхронно внести правки в обе части. Не анализировать чужую реализацию, опираться только на контракт (экономия токенов).

## Что за приложение

Сервис бронирования времени по мотивам Cal.com. Две роли, **без регистрации и авторизации**:

- **Владелец** (один предзаданный профиль, по умолчанию в админской части): создаёт типы событий, смотрит список предстоящих встреч (все типы в одном списке).
- **Гость**: смотрит список типов событий → выбирает тип → видит свободные слоты → бронирует.

## Зафиксированные решения (приняты с пользователем)

| Вопрос | Решение |
|---|---|
| Стек бэкенда | **Rust + axum + sqlx + PostgreSQL** + serde + validator |
| Стек фронтенда | **Vanilla HTML/JS + fetch** (без сборщиков, пользователь слаб во фронте) |
| Контракт | **TypeSpec** → OpenAPI 3.0 (НЕ utoipa-аннотации в коде) |
| Слоты | Фиксированные **30 минут**, окно **09:00–18:00 UTC**, **все 7 дней** недели, на **14 дней** вперёд от `from` (по умолчанию сегодня) |
| Часовой пояс | Сервер хранит/отдаёт **UTC**; UI конвертирует в локальный (`Intl.DateTimeFormat`) |
| Идентификация владельца | Заголовок **`X-Owner-Token`** = значению из env `OWNER_TOKEN`; отсутствует/неверен → 401 |
| `durationMinutes` | **Убран** из EventType (слоты всегда 30 мин) — осознанное упрощение, хотя в задании поле упоминалось |
| Отмена бронирования | **Нет** (бронирование финально) |
| Правило занятости | Unique по `start` в `bookings` → повторное бронирование того же времени → **409 Conflict** (даже для разных типов событий) |
| Ошибки | Единый формат **RFC7807**: `{ type, title, status, detail }` |
| Хранилище на шаге «Бэкенд» | **In-memory** (по заданию шага: БД не нужна, данные сбрасываются при перезапуске). Postgres + sqlx — отложено на этап деплоя |
| Порт бэкенда | **3000** (axum default); dev-стаб на Node — порт 4010 (fallback) |
| Деплой | Один Docker-контейнер: **axum раздаёт и API, и статику** (без отдельного nginx); postgres в docker-compose |

## Структура репозитория

```
spec/                    # TypeSpec-контракт (ИСТОЧНИК ПРАВДЫ)
  main.tsp               # спецификация API
  tspconfig.yaml         # конфиг компилятора
  package.json           # зависимости typespec
  openapi/openapi.yaml   # сгенерированный OpenAPI (артефакт, коммитится)
  tsp-output/            # промежуточный вывод компилятора (в .gitignore)
frontend/                # vanilla HTML/JS (без сборщиков)
  index.html             # страница гостя
  admin.html             # страница владельца
  css/styles.css
  js/api.js              # API-клиент по контракту (без DOM, работает и в Node)
  js/format.js           # форматирование дат: UTC → локальное время (Intl)
  js/app.js              # логика страницы гостя
  js/admin.js            # логика страницы владельца
  smoke-test.mjs         # smoke-тест API-клиента (node frontend/smoke-test.mjs [baseUrl] [token])
backend/                 # Rust + axum (in-memory на этом шаге)
  Cargo.toml
  src/{main,lib,models,state,slots,auth,error,cors,handlers}.rs
  tests/api.rs           # 10 интеграционных тестов + 4 юнит-теста слотов
tools/                   # dev-инструменты, node_modules в .gitignore
  stub-server.mjs        # stateful dev-стаб API на Node (fallback, порт 4010)
  (prism-cli)            # stateless-мок, только для проверки схем OpenAPI
docker/                  # (предстоит) Dockerfile, docker-compose.yml
```

## Команды

Основной способ — через `just` (justfile в корне, `just --list` покажет все команды):

```bash
just dev            # Rust-бэкенд (3000) + статика фронта (8080) одной командой, Ctrl+C гасит оба
just backend        # только Rust-бэкенд (cargo run, порт 3000)
just test           # cargo test бэкенда (14 тестов)
just stub           # только стаб API на Node (порт 4010, fallback, токен: dev-token)
just mock           # Prism-мок (stateless, только для проверки схем OpenAPI)
just serve          # только статика фронтенда
just test-smoke     # smoke-тест API-клиента против Rust-бэкенда (23 проверки)
just compile-spec   # перекомпиляция TypeSpec → spec/openapi/openapi.yaml
just install        # npm install в spec/ и tools/
```

Без `just` — вручную:

```bash
cd spec && npm run compile                          # перекомпиляция контракта
cd backend && cargo run                             # Rust-бэкенд (порт 3000, OWNER_TOKEN=... для смены токена)
node tools/stub-server.mjs 4010                     # стаб API на Node (fallback, OWNER_TOKEN=...)
cd frontend && python3 -m http.server 8080          # статика фронта
node frontend/smoke-test.mjs [baseUrl] [token]      # smoke-тест (по умолчанию :3000, dev-token)
cd backend && cargo test                            # тесты бэкенда
```

## Новая машина (продолжение разработки в новой сессии)

Вся разработка ведётся через ИИ-агентов в новых сессиях; сессия не сохраняется.
Контекст для продолжения: `AGENTS.md` (этот файл) + история коммитов. Код, решения
и команды зафиксированы здесь и в git — отдельный экспорт сессии не нужен.

**Требования к окружению:** Rust stable, Node ≥ 20 + npm, `just`, python3.

**Установка с нуля:**

```bash
git clone git@github.com:rusich/ai-for-developers-project-386.git
cd ai-for-developers-project-386
just install        # npm install в spec/ и tools/
just test           # cargo test бэкенда (14 тестов)
just test-smoke     # smoke-тест API-клиента (23 проверки)
just dev            # бэкенд 3000 + фронт 8080, Ctrl+C гасит оба
```

Продолжить с незакрытых пунктов чеклиста «Прогресс» (ниже): БД/миграции и деплой.

**Известный баг окружения (NixOS + rustup):** если `cargo build` падает с
`ld-wrapper.sh: No such file or directory`, обёртка lld в rustup сломана. Заменить её:

```bash
SYSROOT=$(rustc --print sysroot)
WRAPPER="$SYSROOT/lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/ld.lld"
UNWRAPPED="$SYSROOT/lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld-unwrapped/ld.lld"
printf '#!/usr/bin/env bash\nexec "%s" "$@"\n' "$UNWRAPPED" > "$WRAPPER"
chmod +x "$WRAPPER"
```

## Как запустить фронтенд против Rust-бэкенда (dev)

1. `just dev` (или два терминала: `just backend` + `just serve`)
2. В консоли браузера на странице: `localStorage.setItem('apiBase', 'http://127.0.0.1:3000')` и обновить страницу.
3. Для admin.html: токен `dev-token` (проверяется бэкендом; задаётся через env `OWNER_TOKEN`).

Стаб на Node (`tools/stub-server.mjs`, порт 4010) остаётся fallback'ом, если нужно проверить фронт без компиляции Rust.

**Rust-бэкенд** (`backend/`) — axum + in-memory хранилище, реализует контракт: слоты по правилам (30 мин, 09:00–18:00 UTC, 14 дней), бронирование с 409 на занятое время, owner-эндпоинты через `X-Owner-Token` = env `OWNER_TOKEN` (default `dev-token`), ошибки RFC7807, CORS-слой для dev (preflight 204 + `Access-Control-Allow-Private-Network: true`). Структура: `models` (DTO по контракту, camelCase), `slots` (генерация), `handlers` (8 эндпоинтов), `error` (RFC7807), `auth` (токен), `cors`, `state` (Mutex<Store>).

Стаб на Node (`tools/stub-server.mjs`) — fallback-реализация того же контракта для проверки фронта без компиляции Rust. Prism оставлен только для проверки схем OpenAPI (stateless, подставляет случайные строки — для ручной проверки в браузере не подходит).

**CORS-заголовки обязательны**: фронт (8080) и API (3000/4010) — разные origins. Бэкенд и стаб отвечают на preflight полным набором: эхо `Access-Control-Request-Headers`, `Access-Control-Allow-Private-Network: true` (Private Network Access в Chrome/Firefox), чистый 204. Без этого админка с заголовком `X-Owner-Token` блокируется браузером.

В проде (Docker) axum раздаёт статику с того же origin — `apiBase` не нужен (по умолчанию пустая строка = тот же origin).

## API-контракт (сводка)

| Метод | Путь | Роль | Назначение |
|---|---|---|---|
| GET | `/api/event-types` | все | список типов событий |
| GET | `/api/event-types/{id}` | все | детали типа |
| POST | `/api/event-types` | владелец | создать (тело: `EventTypeCreate`) |
| PUT | `/api/event-types/{id}` | владелец | обновить (тело: `EventTypeUpdate`) |
| DELETE | `/api/event-types/{id}` | владелец | удалить → 204 |
| GET | `/api/event-types/{id}/slots?from=ISO8601` | гость | слоты на 14 дней (`from` необязателен) |
| POST | `/api/bookings` | гость | забронировать (тело: `BookingRequest`) |
| GET | `/api/bookings` | владелец | предстоящие встречи |

Сущности: `EventType{id,title,description?}`, `Slot{start,end,available}`, `Booking{id,eventTypeId,start,end,attendeeName,attendeeEmail}`, `BookingRequest{eventTypeId,start,attendeeName,attendeeEmail}`.

## Важные правила для агентов

1. **Контракт правится только через `spec/main.tsp`**, затем `npm run compile` в `spec/`. Не править `openapi.yaml` вручную.
2. TypeSpec v1.15: декораторы с аргументами требуют скобок (`@header("X-Owner-Token")`), объектные аргументы — через `#{}` (`@service(#{title: ...})`), версия API — через `@info(#{version: ...})` из `@typespec/openapi`.
3. Список-эндпоинты возвращают `200` с `[]` при пустом результате (НЕ 404).
4. Реализация фронта и бэка — строго по контракту, без заглядывания в реализацию другой части.
5. Docker локально у пользователя пока не установлен — Docker-этап отложен; проверки через cargo/npm локально.
6. Язык общения с пользователем — **русский**.

## Прогресс

- [x] Этап 0–1: TypeSpec-контракт написан и скомпилирован (`spec/`), покрытие сценариев проверено
- [x] Этап 4: Frontend (`index.html` для гостя, `admin.html` для владельца), проверен против stateful-стаба (smoke-test.mjs: 23 ok)
- [x] Этап 3: Backend (axum + in-memory: 8 эндпоинтов, генерация слотов, X-Owner-Token, CORS, RFC7807)
- [x] Этап 5: Тесты (cargo test: 4 юнит слотов + 10 интеграционных; smoke-test.mjs против Rust: 23 ok)
- [ ] Этап 2: БД и миграции (sqlx, таблицы `event_types`, `bookings` с unique по `start`) — отложено на деплой
- [ ] Этап 6: Деплой (Dockerfile multi-stage, docker-compose с postgres)
