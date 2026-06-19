# Contract: Client Ordering and Cart

- Client connects to /ws with a short-lived token.
- Client sends JSON messages shaped as { type: "api", requestId, action, payload }.
- Server responds with { type: "api:result", requestId, action, ok, data?, message? }.
- Server may emit scoped broadcast events for catalog, stock, dashboard, reminder, or bill-message updates.
