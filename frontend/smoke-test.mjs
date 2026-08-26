// Smoke-тест API-клиента против Prism-мока (или реального бэкенда).
// Запуск: node frontend/smoke-test.mjs [baseUrl]   (по умолчанию http://127.0.0.1:4010)

import {
  setApiBaseUrl,
  listEventTypes,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType,
  getSlots,
  createBooking,
  listBookings,
  request,
  ApiError,
} from './js/api.js';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4010';
setApiBaseUrl(baseUrl);

const TOKEN = 'test-owner-token';
let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function expectApiError(name, promise, status) {
  try {
    await promise;
    check(name, false, `(ожидался ${status}, запрос прошёл)`);
  } catch (err) {
    check(
      name,
      err instanceof ApiError && err.status === status
        && typeof err.type === 'string' && typeof err.title === 'string'
        && typeof err.detail === 'string',
      `(получено: ${err.status ?? err.message})`,
    );
  }
}

// Принудительный выбор кода ответа в Prism-моке (Prefer: code=NNN)
const preferCode = (code) => ({ Prefer: `code=${code}` });

console.log(`Smoke-тест против ${baseUrl}\n`);

// ── Гость: типы событий ────────────────────────────────────
const types = await listEventTypes();
check('GET /api/event-types → массив', Array.isArray(types));
check(
  'EventType имеет id/title',
  types.length === 0 || (typeof types[0].id === 'string' && typeof types[0].title === 'string'),
);

const someId = types[0]?.id ?? 'any-id';
const single = await getEventType(someId);
check('GET /api/event-types/{id} → объект с id', typeof single.id === 'string');

// ── Гость: слоты ───────────────────────────────────────────
const slots = await getSlots(someId);
check('GET /api/event-types/{id}/slots → массив', Array.isArray(slots));
check(
  'Slot имеет start/end/available',
  slots.length === 0 || (
    typeof slots[0].start === 'string'
    && typeof slots[0].end === 'string'
    && typeof slots[0].available === 'boolean'
  ),
);

const slotsWithFrom = await getSlots(someId, new Date().toISOString());
check('slots с ?from= → массив', Array.isArray(slotsWithFrom));

// ── Гость: бронирование ────────────────────────────────────
const booking = await createBooking({
  eventTypeId: someId,
  start: new Date().toISOString(),
  attendeeName: 'Иван Иванов',
  attendeeEmail: 'ivan@example.com',
});
check(
  'POST /api/bookings → Booking с id/start/end',
  typeof booking.id === 'string'
    && typeof booking.start === 'string'
    && typeof booking.end === 'string',
);

// ── Владелец: CRUD типов ───────────────────────────────────
const created = await createEventType(TOKEN, { title: 'Консультация', description: '30 минут' });
check('POST /api/event-types → созданный тип', typeof created.id === 'string' && typeof created.title === 'string');

const updated = await updateEventType(TOKEN, created.id ?? 'x', { title: 'Новое название' });
check('PUT /api/event-types/{id} → обновлённый тип', typeof updated.id === 'string');

const del = await deleteEventType(TOKEN, created.id ?? 'x');
check('DELETE /api/event-types/{id} → 204 (null)', del === null);

// ── Владелец: список встреч ────────────────────────────────
const bookings = await listBookings(TOKEN);
check('GET /api/bookings → массив', Array.isArray(bookings));

// ── Ошибки по контракту ────────────────────────────────────
// Prism-мок не валидирует токен и не знает про занятые слоты, поэтому коды ошибок
// выбираем принудительно через Prefer: code=NNN (запрос при этом должен быть
// валидным по контракту, иначе Prism ответит своей ошибкой валидации 400/422).
// Так проверяем, что клиент корректно парсит RFC7807-ответы с каждым статусом.
await expectApiError(
  '401 → ApiError с полями type/title/status/detail',
  request('/api/bookings', { ownerToken: TOKEN, extraHeaders: preferCode(401) }),
  401,
);
await expectApiError(
  '400 → ApiError с полями type/title/status/detail',
  request('/api/bookings', { method: 'POST', body: {}, extraHeaders: preferCode(400) }),
  400,
);
await expectApiError(
  '404 → ApiError с полями type/title/status/detail',
  request('/api/event-types/some-id', { extraHeaders: preferCode(404) }),
  404,
);
await expectApiError(
  '409 → ApiError с полями type/title/status/detail',
  request('/api/bookings', {
    method: 'POST',
    body: {
      eventTypeId: 'some-id',
      start: new Date().toISOString(),
      attendeeName: 'Иван',
      attendeeEmail: 'ivan@example.com',
    },
    extraHeaders: preferCode(409),
  }),
  409,
);

console.log(`\nИтог: ${passed} ok, ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
