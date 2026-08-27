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
tools/                   # dev-инструменты, node_modules в .gitignore
  stub-server.mjs        # stateful dev-стаб API по контракту (in-memory, слоты по правилам)
  (prism-cli)            # stateless-мок, только для проверки схем OpenAPI
backend/                 # (предстоит) Rust + axum
docker/                  # (предстоит) Dockerfile, docker-compose.yml
```

## Команды

Основной способ — через `just` (justfile в корне, `just --list` покажет все команды):

```bash
just dev            # stateful-стаб API (4010) + статика фронта (8080) одной командой, Ctrl+C гасит оба
just stub           # только стаб API (node tools/stub-server.mjs, токен: dev-token)
just mock           # Prism-мок (stateless, только для проверки схем OpenAPI)
just serve          # только статика фронтенда
just test-smoke     # smoke-тест API-клиента против стаба/бэкенда (23 проверки)
just compile-spec   # перекомпиляция TypeSpec → spec/openapi/openapi.yaml
just install        # npm install в spec/ и tools/
```

Без `just` — вручную:

```bash
cd spec && npm run compile                          # перекомпиляция контракта
node tools/stub-server.mjs 4010                     # stateful-стаб API (OWNER_TOKEN=... для смены токена)
cd frontend && python3 -m http.server 8080          # статика фронта
node frontend/smoke-test.mjs [baseUrl] [token]      # smoke-тест (по умолчанию :4010, dev-token)
```

## Как запустить фронтенд против стаба (dev без бэкенда)

1. `just dev` (или два терминала: `just stub` + `just serve`)
2. В консоли браузера на странице: `localStorage.setItem('apiBase', 'http://127.0.0.1:4010')` и обновить страницу.
3. Для admin.html: токен `dev-token` (стаб проверяет значение; задаётся через env `OWNER_TOKEN`).

Стаб (`tools/stub-server.mjs`) — stateful: хранит данные в памяти до перезапуска, генерирует слоты по правилам контракта (30 мин, 09:00–18:00 UTC, 14 дней), выдаёт настоящие 401/400/404/409. Prism оставлен только для проверки схем OpenAPI (он stateless и подставляет случайные строки — для ручной проверки в браузере не подходит).

**CORS-заголовки в стабе обязательны**: фронт (8080) и API (4010) — разные origins. Стаб отвечает на preflight полным набором: эхо `Access-Control-Request-Headers`, `Access-Control-Allow-Private-Network: true` (Private Network Access в Chrome/Firefox), чистый 204. Без этого админка с заголовком `X-Owner-Token` блокируется браузером.

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
- [ ] Этап 2: БД и миграции (sqlx, таблицы `event_types`, `bookings` с unique по `start`)
- [ ] Этап 3: Backend (axum: хендлеры, генерация слотов, X-Owner-Token middleware, ServeDir для статики)
- [ ] Этап 5: Тесты (cargo test: генерация слотов, 409-конфликт, валидация, 401)
- [ ] Этап 6: Деплой (Dockerfile multi-stage, docker-compose с postgres)
