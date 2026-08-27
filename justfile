# Call Booking — команды для разработки
# Список команд: just --list

# установка всех зависимостей
install:
    cd spec && npm install
    cd tools && npm install

# перекомпиляция контракта TypeSpec → OpenAPI
compile-spec:
    cd spec && npm run compile

# Rust-бэкенд (порт 3000)
backend:
    cd backend && cargo run

# тесты бэкенда (cargo test)
test:
    cd backend && cargo test

# Stateful dev-стаб API на Node (порт 4010) — fallback, если Rust-бэкенд не нужен
stub:
    node tools/stub-server.mjs 4010

# Prism-мок API по контракту (порт 4010), stateless — только для проверки схем
mock:
    cd tools && npx prism mock ../spec/openapi/openapi.yaml -p 4010

# раздача статики фронтенда (порт 8080)
serve:
    cd frontend && python3 -m http.server 8080

# запуск Rust-бэкенда + фронтенда одной командой для проверки в браузере
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    # освобождаем порты, если остались висящие процессы от прошлого запуска
    for port in 3000 8080; do
        pids=$(lsof -ti tcp:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "  Порт $port занят (pid: $pids) — завершаю."
            kill $pids 2>/dev/null || true
            sleep 1
        fi
    done
    cd backend && cargo run &> /tmp/call-booking-backend.log &
    BACKEND_PID=$!
    cd frontend && python3 -m http.server 8080 &> /dev/null &
    SERVE_PID=$!
    trap 'kill $BACKEND_PID $SERVE_PID 2>/dev/null || true' EXIT
    sleep 3
    echo ''
    echo '  Гость:     http://127.0.0.1:8080'
    echo '  Владелец:  http://127.0.0.1:8080/admin.html  (токен: dev-token)'
    echo ''
    echo '  В консоли браузера (для работы с Rust-бэкендом):'
    echo '    localStorage.setItem("apiBase", "http://127.0.0.1:3000")'
    echo ''
    echo '  Ctrl+C — остановить оба процесса.'
    wait

# smoke-тест клиента против Rust-бэкенда (или стаба)
test-smoke:
    node frontend/smoke-test.mjs http://127.0.0.1:3000
