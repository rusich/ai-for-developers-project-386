# Call Booking — команды для разработки
# Список команд: just --list

# установка всех зависимостей
install:
    cd spec && npm install
    cd tools && npm install

# перекомпиляция контракта TypeSpec → OpenAPI
compile-spec:
    cd spec && npm run compile

# Stateful dev-стаб API по контракту (порт 4010)
stub:
    node tools/stub-server.mjs 4010

# Prism-мок API по контракту (порт 4010), stateless — только для проверки схем
mock:
    cd tools && npx prism mock ../spec/openapi/openapi.yaml -p 4010

# раздача статики фронтенда (порт 8080)
serve:
    cd frontend && python3 -m http.server 8080

# запуск стаба + фронтенда одной командой для проверки в браузере
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    node tools/stub-server.mjs 4010 &
    STUB_PID=$!
    cd frontend && python3 -m http.server 8080 &> /dev/null &
    SERVE_PID=$!
    trap 'kill $STUB_PID $SERVE_PID 2>/dev/null || true' EXIT
    sleep 2
    echo ''
    echo '  Гость:     http://127.0.0.1:8080'
    echo '  Владелец:  http://127.0.0.1:8080/admin.html  (токен: dev-token)'
    echo ''
    echo '  В консоли браузера (для работы через стаб):'
    echo '    localStorage.setItem("apiBase", "http://127.0.0.1:4010")'
    echo ''
    echo '  Ctrl+C — остановить оба процесса.'
    wait

# smoke-тест клиента против стаба или реального бэкенда
test-smoke:
    node frontend/smoke-test.mjs http://127.0.0.1:4010
