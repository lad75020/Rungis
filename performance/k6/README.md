Rungis k6 performance tests

Prerequisites:
- k6 CLI available on PATH. On macOS: brew install k6
- npm install has installed project dev dependencies, including @types/k6 for editor support.
- The app is running locally. For repeatable local load runs, start it with long secrets and the test-only page limiter bypass:

HOST=127.0.0.1 PORT=3199 E2E_DISABLE_PAGE_RATE_LIMIT=1 SESSION_SECRET=rungis-functional-session-secret-32-chars-minimum JWT_SECRET=rungis-functional-jwt-secret-32-chars-minimum npm start

Commands:
- npm run perf:smoke
  One-iteration HTTP smoke coverage for public, client, vendor, and admin pages/APIs.

- npm run perf:websocket
  WebSocket connect/welcome/ping/pong smoke coverage for client, vendor, and admin sessions.

- npm run perf:test
  Fast local gate that runs HTTP smoke then WebSocket smoke.

- npm run perf:load
  Small local authenticated API load profile. Defaults to 5 VUs with 10s ramp-up, 20s steady state, and 10s ramp-down.

Useful environment overrides:
- K6_BASE_URL=http://127.0.0.1:3199
- K6_TARGET_VUS=10
- K6_RAMP_UP=30s
- K6_STEADY_STATE=2m
- K6_RAMP_DOWN=30s
- K6_PASSWORD=...
- K6_CLIENT_USERNAME=...
- K6_CLIENT_PASSWORD=...
- K6_VENDOR_USERNAME=...
- K6_VENDOR_PASSWORD=...
- K6_ADMIN_USERNAME=...
- K6_ADMIN_PASSWORD=...

The tests avoid mutating business data; they log in, read protected pages/APIs, request websocket tokens, validate websocket ping/pong, then log out.
