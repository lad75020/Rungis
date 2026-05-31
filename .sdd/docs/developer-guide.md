# Developer Guide

## Development Environment Setup

### Prerequisites

- Node.js capable of running modern ES modules and `node:sqlite`. The current environment used Node v24.8.0 during documentation.
- npm workspaces. The root package uses npm workspaces for `backend` and `frontend`.
- MongoDB reachable from the backend through `MONGO_URL`.
- Redis reachable from the backend through `REDIS_URL`.
- A browser that supports the WebAuthn/passkey APIs if testing access keys.

### First-Time Setup

1. Enter the repository:

```bash
cd /Volumes/WDBlack4TB/Code/rungis
```

2. Install all workspace dependencies:

```bash
npm install
```

3. Create the backend environment file from the example:

```bash
cp backend/.env.example backend/.env
```

4. Edit `backend/.env` with local MongoDB, Redis, session, JWT, host, and port values. Do not commit real secret values.

5. Build the Angular frontend into the backend static directory:

```bash
npm run build
```

6. Start the backend:

```bash
npm run start
```

7. Open the login page in a browser. Use the configured host and port from the backend environment.

### Development Mode

Run frontend watch mode and backend watch mode together:

```bash
npm run dev
```

This runs:

- `npm --workspace frontend run watch`
- `npm --workspace backend run dev`

The Angular watch build writes into `backend/src/public/angular`, while Fastify serves that directory.

### Updating Your Environment

After pulling changes:

```bash
npm install
npm run build
npm --workspace frontend run test
```

## Project Structure

```text
rungis/
  package.json                      # Workspace scripts
  backend/
    package.json                    # Fastify runtime dependencies
    scripts/                        # Data seed and migration scripts
    src/server.js                   # Backend bootstrap
    src/lib/                        # Shared backend infrastructure helpers
    src/models/                     # Mongoose models
    src/routes/index.js             # Shared business logic and route context
    src/routes/modules/             # Route modules by domain
    src/views/                      # EJS page shells
    src/i18n/translations.json      # English and French copy
    src/public/                     # Static assets, uploads, Angular output
  frontend/
    angular.json                    # Angular build target and output path
    src/app/app.ts                  # Main standalone Angular component
    src/app/app.html                # All page templates
    src/app/app.types.ts            # Frontend type definitions
    src/app/app.constants.ts        # Supported pages and constants
    src/app/app.spec.ts             # Angular/Vitest tests
  .sdd/docs/                        # Generated documentation
```

Start reading in this order:

1. `README.md` for product scope.
2. `backend/src/server.js` for runtime bootstrap.
3. `backend/src/routes/index.js` for shared guards, business helpers, billing logic, and route context.
4. `backend/src/routes/modules/*.js` for route surfaces.
5. `frontend/src/app/app.types.ts` for UI data shapes.
6. `frontend/src/app/app.ts` and `frontend/src/app/app.html` for UI behavior.
7. `backend/src/models/*.js` for persistence structure.

## Coding Conventions

### Module Style

- Backend code uses ES modules through `"type": "module"` in `backend/package.json`.
- Frontend code uses TypeScript with Angular standalone components.
- Shared backend helpers live in `backend/src/routes/index.js` or `backend/src/lib/*`.
- Route modules export one registration function, such as `registerAuthRoutes` or `registerWebsocketRoutes`.

### Naming

- JavaScript and TypeScript variables and functions use camelCase.
- TypeScript types use PascalCase.
- Route modules use kebab-free lowercase file names by domain, for example `auth.js` and `management.js`.
- MongoDB model names use PascalCase exports such as `User`, `Merchandise`, `ValidatedOrder`, `Bill`, `Refund`, and `Cart`.
- WebSocket action names use colon-separated namespaces, such as `order:cart:add` and `dashboard:client-bills:comment`.

### State and Data Patterns

- Backend request handlers normalize strings through shared helpers before validation.
- API access control is role-specific: admin, vendor, client, or authenticated user.
- Dangerous object keys are rejected in API and websocket payloads to reduce NoSQL/prototype pollution risks.
- Active carts are Redis-backed JSON documents keyed by client and delivery date.
- Persistent domain data is represented by Mongoose schemas.
- Application settings use key/value rows in SQLite rather than environment variables.
- Angular state is mostly signal-based inside the `App` component.

### Error Handling

- REST API handlers return JSON objects with `ok: false` and a human-readable `message` for expected errors.
- Page guards redirect unauthenticated users to `/login` and role mismatches to the appropriate page.
- WebSocket API actions return `api:result` with `ok`, `data`, or `message`.
- Invalid WebSocket payloads and missing/invalid tokens are rejected early.

### Formatting and Strictness

- Frontend TypeScript is strict: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `strictInjectionParameters`, `strictInputAccessModifiers`, and `strictTemplates` are enabled.
- Frontend includes Prettier as a dev dependency and `.prettierrc` exists.
- No backend linter or formatter script is defined in `backend/package.json`.

## Testing

### Test Structure

- Frontend unit tests live in `frontend/src/app/app.spec.ts`.
- The frontend test runner is provided by Angular build tooling and Vitest dependencies.
- Current tests cover component creation, toast behavior, websocket reconnect alert handling, admin statistics sorting/pagination, vendor bill message handling, and client bill comment submission behavior.
- No backend test script is defined in `backend/package.json`.

### Running Tests

```bash
# Run frontend unit tests from the root workspace
npm --workspace frontend run test

# Run the production frontend build
npm run build
```

### Writing New Tests

- Add component behavior tests to `frontend/src/app/app.spec.ts` or split into new `*.spec.ts` files if the app is decomposed later.
- Prefer testing signal state and public component methods rather than DOM internals when the behavior is state-driven.
- Mock `sendWsApi` for websocket-driven UI behavior.
- Use representative user roles in test data because many UI paths are role-specific.

## Adding New Features

### Add a New Server-Rendered Page

1. Add the page name to `SUPPORTED_PAGES` in `frontend/src/app/app.constants.ts`.
2. Add the page name to the `PageName` union in `frontend/src/app/app.types.ts`.
3. Add an EJS page shell under `backend/src/views/` if the page needs a dedicated shell.
4. Register a route in `backend/src/routes/modules/pages.js` with the correct page guard.
5. Add Angular template and component logic in `app.html` and `app.ts`.
6. Add translations in `backend/src/i18n/translations.json`.
7. Add tests for page state, role behavior, and any API calls.

### Add a New REST API Endpoint

1. Choose or create a route module under `backend/src/routes/modules/`.
2. Apply the correct guard from `routes/index.js`: admin, vendor, client, or authenticated.
3. Validate request body, params, and query values. Shared preHandler rejects dangerous object keys for API routes.
4. Use Mongoose models and shared helpers from the route context where possible.
5. Return consistent JSON responses with `ok`, `data`, and `message` fields as appropriate.
6. Add a matching frontend fetch call or service helper in `frontend/src/app/app.ts`.
7. Add UI state, translations, and tests.

### Add a New WebSocket API Action

1. Add a new action branch in `backend/src/routes/modules/websocket.js` under the correct namespace.
2. Enforce the required user role and validate object ids and payload values.
3. Return an `api:result` response through the provided `respond` helper.
4. Broadcast follow-up events through the route context when other connected pages need updates.
5. Add a matching `sendWsApi` call in `frontend/src/app/app.ts`.
6. Add or update TypeScript types in `frontend/src/app/app.types.ts`.
7. Add tests for the frontend state updates.

### Add a New Mongoose Entity

1. Create `backend/src/models/<entity>.model.js`.
2. Define required fields, defaults, indexes, and collection name.
3. Import the model in `backend/src/routes/index.js` or a focused route module.
4. Add mapping helpers that strip MongoDB internals before sending to the frontend.
5. Add TypeScript types for frontend data shapes.
6. Add migration or seed scripts only if needed.

## Important Pitfalls

- Do not read or copy real values from `backend/.env` into docs, tests, or examples.
- Do not rely on frontend role checks alone. Enforce role checks in backend handlers.
- Keep Angular build output pointed at `backend/src/public/angular`; otherwise the backend page shells will not find current assets.
- Keep app settings persistent by preserving the SQLite data path across backend restarts.
- If scaling beyond one backend process, review the in-process daily billing scheduler to avoid multiple processes running the same scheduled job.
- Avoid adding token-like credential placeholders to docs or logs. Describe secret values in prose instead.
