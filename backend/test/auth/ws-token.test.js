import assert from 'node:assert/strict';
import { test } from 'node:test';

import { registerAuthRoutes } from '../../src/routes/modules/auth.js';

function createReply() {
  return {
    statusCode: 200,
    payload: undefined,
    code(value) {
      this.statusCode = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return this;
    }
  };
}

function createRoutes() {
  const routes = new Map();
  const app = {
    get(path, optionsOrHandler, maybeHandler) {
      const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
      const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
      routes.set(`GET ${path}`, { options, handler });
    },
    post(path, optionsOrHandler, maybeHandler) {
      const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
      const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
      routes.set(`POST ${path}`, { options, handler });
    },
    put(path, optionsOrHandler, maybeHandler) {
      const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
      const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
      routes.set(`PUT ${path}`, { options, handler });
    },
    delete(path, optionsOrHandler, maybeHandler) {
      const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
      const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
      routes.set(`DELETE ${path}`, { options, handler });
    }
  };
  const requireAuth = async () => {};

  registerAuthRoutes(app, { sendToAdminConnections: () => {} }, {
    requireAuth,
    normalizeString: (value) => String(value ?? '').trim(),
    User: {},
    bcrypt: {},
    mongoose: {},
    fs: {},
    path: {},
    randomUUID: () => 'uuid'
  });

  return { routes, requireAuth };
}

test('registers authenticated websocket token API used by k6 tests', () => {
  const { routes, requireAuth } = createRoutes();
  const route = routes.get('GET /api/ws-token');

  assert.ok(route);
  assert.equal(route.options.preHandler, requireAuth);
});

test('websocket token API returns a fresh token for requested page', async () => {
  const { routes } = createRoutes();
  const reply = createReply();
  const issued = [];

  await routes.get('GET /api/ws-token').handler({
    query: { page: 'dashboard' },
    session: { user: { id: 'user-1', role: 'vendor' } },
    server: {
      issueWsToken(request, page) {
        issued.push({ user: request.session.user.id, page });
        return `token-for-${page}`;
      }
    }
  }, reply);

  assert.deepEqual(issued, [{ user: 'user-1', page: 'dashboard' }]);
  assert.equal(reply.statusCode, 200);
  assert.deepEqual(reply.payload, { ok: true, wsToken: 'token-for-dashboard' });
});

test('websocket token API defaults to dashboard page when page is omitted', async () => {
  const { routes } = createRoutes();
  const reply = createReply();

  await routes.get('GET /api/ws-token').handler({
    query: {},
    session: { user: { id: 'user-1', role: 'vendor' } },
    server: { issueWsToken: (_request, page) => `token-for-${page}` }
  }, reply);

  assert.deepEqual(reply.payload, { ok: true, wsToken: 'token-for-dashboard' });
});
