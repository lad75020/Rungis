# Deployment Guide

## Prerequisites

### Software Requirements

| Software | Minimum or observed version | Purpose | Evidence |
|----------|-----------------------------|---------|----------|
| Node.js | Modern Node with ES modules and `node:sqlite`; observed v24.8.0 | Backend runtime and frontend build tooling | `server.js`, local verification |
| npm | Workspace-capable npm; observed v11.6.0 | Install, build, and run scripts | root `package.json` |
| MongoDB | Compatible with Mongoose 8 | Persistent application data | `backend/package.json`, `server.js` |
| Redis | Compatible with redis client 5 | Sessions, live carts, reminders, transient state | `backend/package.json`, `server.js` |

### Infrastructure Requirements

The repository does not include Docker, compose, Kubernetes, systemd, launchd, or CI/CD deployment files. A deployment must provide:

- A persistent Node.js process running the backend.
- Reachable MongoDB service.
- Reachable Redis service.
- Persistent storage for the SQLite settings database.
- Persistent storage for uploaded logos and item images in `backend/src/public/uploads`.
- Optional reverse proxy and TLS termination for production.
- A domain and HTTPS origin for production WebAuthn/passkey support.

### Required Credentials and Secrets

Production deployments must provide secret values in the environment, preferably through the host secret manager:

- `SESSION_SECRET`: long random value for session signing.
- `JWT_SECRET`: long random value for JWT signing.
- MongoDB credentials if the `MONGO_URL` requires authentication.
- Redis credentials if the `REDIS_URL` requires authentication.

Do not store real secret values in repository files or documentation.

## Build and Release

### Install Dependencies

```bash
cd /Volumes/WDBlack4TB/Code/rungis
npm install
```

For reproducible installs in automation, prefer:

```bash
npm ci
```

### Build Production Assets

```bash
npm run build
```

This runs the frontend workspace build. The Angular output path is `backend/src/public/angular`, as defined in `frontend/angular.json`.

### Run Verification Before Release

```bash
npm run build
npm --workspace frontend run test
```

The repository does not define a backend test script. Backend verification should include a startup check against real MongoDB and Redis services and a health check request.

### Artifact Contents

A deployment artifact must include at least:

- `backend/src/server.js`
- `backend/src/lib`
- `backend/src/models`
- `backend/src/routes`
- `backend/src/views`
- `backend/src/i18n`
- `backend/src/public/angular` after `npm run build`
- `backend/package.json`
- root `package.json` and lockfile or a prepared `node_modules` depending on deployment strategy

Uploaded files under `backend/src/public/uploads` are runtime data. Treat them as persistent volume data, not disposable build output.

## Deployment Process

### Manual Deployment

1. Provision or select a host with Node.js, MongoDB access, and Redis access.
2. Copy or check out the repository on the host.
3. Install dependencies:

```bash
npm ci
```

4. Configure backend environment values. Use `backend/.env.example` as the key list, but provide production values through environment management.
5. Build frontend assets:

```bash
npm run build
```

6. Start the backend:

```bash
npm run start
```

7. Verify the health endpoint:

```bash
curl http://127.0.0.1:3199/health
```

Use the actual configured host and port.

### Process Supervision

The repository does not define a process manager. In production, run `npm run start` through a supervisor such as launchd, systemd, PM2, Docker, or another platform supervisor. The supervisor should:

- Set the required environment variables.
- Restart the process after crashes.
- Preserve logs.
- Stop gracefully so Fastify can close SQLite, Redis, and MongoDB connections.

### Reverse Proxy

If deploying behind a reverse proxy:

- Terminate TLS at the proxy or at the Node process.
- Forward WebSocket upgrade requests for `/ws`.
- Set `TRUST_PROXY` only when the proxy is trusted.
- Set production WebAuthn variables to the public HTTPS origin.

### Rollback

No automated rollback mechanism is defined. Manual rollback procedure:

1. Stop the running backend process.
2. Restore the previous application build or previous release directory.
3. Preserve the current MongoDB data, Redis data, SQLite settings database, and uploads unless the rollback explicitly requires restoring backups.
4. Start the previous backend version.
5. Run the health check and smoke-test login, dashboard, stock, order, and billing pages.

## Health Checks and Monitoring

### Health Endpoint

| Endpoint | Method | Expected response | Checks |
|----------|--------|-------------------|--------|
| `/health` | GET | JSON with `ok: true`, `uptime`, and `now` | Process is running and route registration completed |

The health endpoint does not verify MongoDB or Redis connectivity after startup. Startup itself connects to Redis and MongoDB before listening.

### Suggested Smoke Checks

After deployment:

1. Request `/health` and confirm `ok: true`.
2. Request `/login` and confirm the page shell loads.
3. Log in as an admin and open `/admin`.
4. Log in as a vendor and open `/stocks` and `/dashboard`.
5. Log in as a client and open `/order` and `/dashboard`.
6. Confirm `/ws` connects from a page and receives a welcome event.
7. Generate or open a bill PDF if billing data exists.

### Logging

Fastify logging is enabled in `server.js`, with `logLevel: 'warn'`. The daily bill job logs completion and failure events. Redis client errors are logged through Fastify.

Recommended monitoring:

- Process uptime and restart count.
- `/health` status.
- HTTP 5xx rate.
- WebSocket disconnect and error rates.
- MongoDB and Redis connectivity.
- Disk space for uploads and SQLite settings.
- Daily billing job failures.

## Operational Procedures

### Build Frontend Assets

```bash
npm run build
```

### Start Backend

```bash
npm run start
```

### Run Development Watchers

```bash
npm run dev
```

### Seed and Migration Scripts

The backend includes scripts:

- `backend/scripts/seed-users.js`
- `backend/scripts/seed-merchandises.js`
- `backend/scripts/migrate-users-profile-fields.js`

Run them only after reviewing the target database connection from the environment.

### Daily Bill Generation

Daily bill generation is scheduled in-process by `createRouteContext`. Admins can also trigger one run through:

- `POST /api/admin/bills/run-daily-generation`

Operational concern: if multiple backend processes run simultaneously, each process may schedule the daily generation timer. The bill upsert uses the unique day/vendor/client key, but operators should still review multi-process scheduling before horizontal scaling.

### Data Backup

Back up these data sources:

- MongoDB database defined by `MONGO_URL`.
- Redis data if live carts, session continuity, or reminders must survive restarts.
- SQLite settings file at `APP_SETTINGS_SQLITE_PATH` or `backend/data/app-settings.sqlite`.
- Uploaded files under `backend/src/public/uploads`.

### Security Checklist for Production

- Use HTTPS for all public traffic.
- Set `NODE_ENV=production` so session cookies are secure.
- Use strong `SESSION_SECRET` and `JWT_SECRET` values.
- Restrict MongoDB and Redis network access.
- Configure WebAuthn RP id and origin explicitly for the public domain.
- Preserve and review the CSP nonce behavior before adding external scripts.
- Ensure uploaded files are served only from expected static paths.
