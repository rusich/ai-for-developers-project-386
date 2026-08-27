### Hexlet tests and linter status:
[![Actions Status](https://github.com/rusich/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/rusich/ai-for-developers-project-386/actions)

### Status:
[![CI](https://github.com/rusich/ai-for-developers-project-386/actions/workflows/ci.yml/badge.svg)](https://github.com/rusich/ai-for-developers-project-386/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/rusich/ai-for-developers-project-386?label=release)](https://github.com/rusich/ai-for-developers-project-386/releases)
[![Release Please](https://github.com/rusich/ai-for-developers-project-386/actions/workflows/release-please.yml/badge.svg)](https://github.com/rusich/ai-for-developers-project-386/actions/workflows/release-please.yml)

## Публичное приложение

- **Гость (бронирование):** https://ai-for-developers-project-386-production-6607.up.railway.app
- **Владелец (админка):** https://ai-for-developers-project-386-production-6607.up.railway.app/admin.html — токен `dev-token`

Деплой: Railway, из GitHub по `docker/Dockerfile` (один контейнер: axum раздаёт и API, и статику). Запуск по порту из `PORT`. Хранилище пока in-memory — данные сбрасываются при каждом деплое.

## Docker

```bash
just docker-build   # docker build -f docker/Dockerfile -t call-booking .
just docker-run     # docker run --rm -p 3000:3000 -e OWNER_TOKEN=dev-token call-booking
```
