# Configuration Guide

## Overview

Rungis is configured primarily through backend environment variables loaded by `dotenv` in `backend/src/server.js`. Runtime defaults are defined in `backend/src/lib/runtime-config.js`. Additional application settings are stored in a local SQLite database managed by `backend/src/lib/app-settings-store.js` and can be changed through admin UI/API flows.

Configuration sources:

1. Backend environment variables from the process environment and `backend/.env`.
2. Runtime defaults in `backend/src/lib/runtime-config.js` when environment values are absent.
3. SQLite application settings for operational app settings such as bill overdue days and active style profile.
4. Request-derived values for WebAuthn origin/RP fallback when WebAuthn environment variables are not set.

## Environment Variables

### Server

| Variable | Type | Default | Required | Description | Evidence |
|----------|------|---------|----------|-------------|----------|
| `HOST` | string | `127.0.0.1` | No | Fastify listen host. `backend/.env.example` uses `0.0.0.0`. | `runtime-config.js`, `.env.example` |
| `PORT` | integer | `3199` | No | Fastify listen port. Invalid or missing values fall back to the default. | `runtime-config.js` |
| `NODE_ENV` | string | `development` | No | Controls environment-specific behavior such as secure session cookies in production. | `runtime-config.js`, `server.js` |
| `TRUST_PROXY` | boolean | false | No | Enables Fastify trust-proxy behavior when set to `1`, `true`, `yes`, or `on`. | `runtime-config.js` |

### Data Stores

| Variable | Type | Default | Required | Description | Evidence |
|----------|------|---------|----------|-------------|----------|
| `MONGO_URL` | string | `mongodb://192.168.1.80:27017/rungis` | Recommended | MongoDB connection string used by Mongoose. | `runtime-config.js`, `server.js` |
| `REDIS_URL` | string | `redis://192.168.1.80:6379/5` | Recommended | Redis connection string used for sessions and transient state. | `runtime-config.js`, `server.js` |
| `APP_SETTINGS_SQLITE_PATH` | string path | `backend/data/app-settings.sqlite` | No | Overrides the local SQLite app settings file path. Empty value uses the default. | `app-settings-store.js`, `.env.example` |

### Secrets and Authentication

| Variable | Type | Default | Required | Description | Evidence |
|----------|------|---------|----------|-------------|----------|
| `SESSION_SECRET` | string | development fallback string | Yes in production | Secret for Fastify session cookie signing. Use a long random value in production. | `runtime-config.js`, `server.js` |
| `JWT_SECRET` | string | development fallback string | Yes in production | Secret for Fastify JWT, including websocket token signing. Use a long random value in production. | `runtime-config.js`, `server.js` |

### WebAuthn and Passkeys

| Variable | Type | Default | Required | Description | Evidence |
|----------|------|---------|----------|-------------|----------|
| `WEBAUTHN_RP_ID` | string | Request hostname or `localhost` | No | Relying party id used for WebAuthn registration/authentication. | `routes/index.js` |
| `WEBAUTHN_ORIGIN` | comma-separated string list | Request protocol plus host | No | Allowed origins for WebAuthn verification. Supports multiple comma-separated origins. | `routes/index.js` |
| `WEBAUTHN_RP_NAME` | string | `Rungis Portal` | No | Display name for the WebAuthn relying party. | `routes/index.js` |
| `WEBAUTHN_REQUIRE_USER_VERIFICATION` | boolean | false | No | Requires WebAuthn user verification when set to `1`, `true`, or `yes`. | `routes/index.js` |

## Configuration Files

### `backend/.env`

The backend loads environment values with `dotenv.config()` from the current process working directory. The repository includes `backend/.env.example` with the expected keys. Keep the real `backend/.env` local and private.

Example shape:

```env
PORT=3000
HOST=0.0.0.0
MONGO_URL=mongodb://127.0.0.1:27017/rungis
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=use-a-long-random-session-secret
JWT_SECRET=use-a-long-random-jwt-secret
NODE_ENV=development
APP_SETTINGS_SQLITE_PATH=
```

### `frontend/angular.json`

Important settings:

- Production build output path is `../backend/src/public/angular`.
- Main browser entry is `src/main.ts`.
- Primary CSS bundle is injected as `styles` from `src/styles-primary.css`.
- Secondary CSS bundle is non-injected as `styles-secondary` from `src/styles-secondary.css`.
- Production initial budget warns at 500 kB and errors at 1 MB.

### SQLite app settings database

Default path: `backend/data/app-settings.sqlite`.

Table created automatically:

```text
app_settings
  key TEXT PRIMARY KEY
  value_text TEXT
  value_number REAL
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
```

Known setting keys:

| Key | Type | Default | Description | Evidence |
|-----|------|---------|-------------|----------|
| `billOverdueDays` | number | 30 | Number of days after which unsettled bills are considered overdue. | `routes/index.js` |
| `appStyleProfile` | string | `primary` | Active global style profile. Accepted values normalize to `primary` or `secondary`. | `routes/index.js` |

## Validation Rules

| Config or setting | Rule | Error or fallback behavior | Evidence |
|-------------------|------|----------------------------|----------|
| `PORT` | Must parse as a positive integer. | Falls back to default port. | `runtime-config.js` |
| Boolean env values | Enabled only when value is `1`, `true`, `yes`, or `on` for `TRUST_PROXY`; WebAuthn user verification accepts `1`, `true`, or `yes`. | Any other value is false. | `runtime-config.js`, `routes/index.js` |
| `APP_SETTINGS_SQLITE_PATH` | Empty or missing uses the default data path. | Parent directory is created recursively. | `app-settings-store.js` |
| `billOverdueDays` | Normalized by backend helper; invalid or missing value falls back to 30. | Admin API should persist normalized value. | `routes/index.js` |
| `appStyleProfile` | Only `primary` and `secondary` are accepted. | Unknown value falls back to `primary`. | `routes/index.js` |
| WebAuthn origins | `WEBAUTHN_ORIGIN` is split by comma and empty entries are ignored. | If no configured origin remains, request protocol and host are used. | `routes/index.js` |

## Deployment Profiles

### Development

- `NODE_ENV=development`.
- Host may be `127.0.0.1` or `0.0.0.0` for LAN testing.
- Session cookie is not marked secure unless `NODE_ENV` is `production`.
- Development fallback secrets exist in code but should still be overridden locally.

### Production

- Set `NODE_ENV=production` so session cookies are marked secure.
- Set strong random values for `SESSION_SECRET` and `JWT_SECRET`.
- Set explicit `MONGO_URL` and `REDIS_URL` values for production services.
- Set `TRUST_PROXY` when behind a trusted reverse proxy or TLS terminator.
- Set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` explicitly for the production domain.
- Persist `backend/data/app-settings.sqlite` or set `APP_SETTINGS_SQLITE_PATH` to a durable path.
- Persist `backend/src/public/uploads` if user logos and merchandise images must survive deployments.

## Operational Settings Managed in the UI

Admins can manage the overdue-bill threshold and active application style profile through REST endpoints in `backend/src/routes/modules/management.js`:

- `GET /api/admin/settings/bill-overdue-days`
- `PUT /api/admin/settings/bill-overdue-days`
- `GET /api/admin/settings/app-style-profile`
- `PUT /api/admin/settings/app-style-profile`

These endpoints write to the SQLite app settings store, not to environment variables.
