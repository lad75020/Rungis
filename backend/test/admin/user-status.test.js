import test from 'node:test';
import assert from 'node:assert/strict';

import { registerManagementRoutes } from '../../src/routes/modules/management.js';

function createApp() {
  const routes = [];
  const app = { routes };
  for (const method of ['get', 'put', 'post', 'patch', 'delete']) {
    app[method] = (path, options, handler) => {
      routes.push({ method: method.toUpperCase(), path, options, handler });
    };
  }
  return app;
}

function createReply() {
  return {
    statusCode: 200,
    body: null,
    code(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload) {
      this.body = payload;
      return payload;
    }
  };
}

function mapAdminManagedUser(user) {
  return {
    id: user._id.toString(),
    role: user.role,
    username: user.username,
    organisation: user.organisation,
    email: user.email,
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function registerRoutesWith(User) {
  const requireAdminApi = () => {};
  const app = createApp();
  registerManagementRoutes(app, {}, {
    User,
    mapAdminManagedUser,
    normalizeString: (value) => (typeof value === 'string' ? value.trim() : ''),
    requireAdminApi
  });
  return { app, requireAdminApi };
}

test('admin user search matches organization prefixes only', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const createdAt = new Date('2026-06-20T10:00:00Z');
  const updatedAt = new Date('2026-06-20T11:00:00Z');
  let receivedFilter;
  const User = {
    find(filter) {
      receivedFilter = filter;
      return {
        sort(value) {
          assert.deepEqual(value, { organisation: 1, username: 1 });
          return this;
        },
        limit(value) {
          assert.equal(value, 25);
          return this;
        },
        select(value) {
          assert.equal(value.isActive, 1);
          return this;
        },
        async lean() {
          return [
            {
              _id: { toString: () => userId },
              role: 'vendor',
              username: 'market-vendor',
              organisation: 'Marché Primeur',
              email: 'vendor@example.test',
              isActive: true,
              createdAt,
              updatedAt
            }
          ];
        }
      };
    }
  };
  const { app, requireAdminApi } = registerRoutesWith(User);
  const route = app.routes.find((entry) => entry.method === 'GET' && entry.path === '/api/admin/users/search');
  assert.equal(route.options.preHandler, requireAdminApi);

  const reply = createReply();
  await route.handler({ query: { organization: ' Mar' } }, reply);

  assert.deepEqual(receivedFilter, {
    role: { $in: ['vendor', 'client'] },
    organisation: { $regex: '^Mar', $options: 'i' }
  });
  assert.equal(reply.statusCode, 200);
  assert.deepEqual(reply.body, {
    ok: true,
    users: [
      {
        id: userId,
        role: 'vendor',
        username: 'market-vendor',
        organisation: 'Marché Primeur',
        email: 'vendor@example.test',
        isActive: true,
        createdAt,
        updatedAt
      }
    ]
  });
});

test('admin user active toggle updates vendor and client accounts', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const createdAt = new Date('2026-06-20T10:00:00Z');
  const updatedAt = new Date('2026-06-20T11:00:00Z');
  let receivedUpdate;
  const User = {
    findById(id) {
      assert.equal(id, userId);
      return {
        async lean() {
          return {
            _id: { toString: () => userId },
            role: 'client',
            username: 'client-one',
            organisation: 'Marché Client',
            email: 'client@example.test',
            isActive: true,
            createdAt,
            updatedAt
          };
        }
      };
    },
    findByIdAndUpdate(id, update, options) {
      assert.equal(id, userId);
      receivedUpdate = update;
      assert.deepEqual(options, { new: true });
      return {
        select(value) {
          assert.equal(value.organisation, 1);
          return this;
        },
        async lean() {
          return {
            _id: { toString: () => userId },
            role: 'client',
            username: 'client-one',
            organisation: 'Marché Client',
            email: 'client@example.test',
            isActive: false,
            createdAt,
            updatedAt
          };
        }
      };
    }
  };
  const { app, requireAdminApi } = registerRoutesWith(User);
  const route = app.routes.find((entry) => entry.method === 'PATCH' && entry.path === '/api/admin/users/:id/active');
  assert.equal(route.options.preHandler, requireAdminApi);

  const reply = createReply();
  await route.handler({ params: { id: userId }, body: { isActive: false } }, reply);

  assert.deepEqual(receivedUpdate, { $set: { isActive: false } });
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.body.ok, true);
  assert.equal(reply.body.message, 'User disabled.');
  assert.equal(reply.body.user.id, userId);
  assert.equal(reply.body.user.isActive, false);
});

test('admin user active toggle rejects non-boolean state', async () => {
  const { app } = registerRoutesWith({});
  const route = app.routes.find((entry) => entry.method === 'PATCH' && entry.path === '/api/admin/users/:id/active');
  const reply = createReply();

  await route.handler({ params: { id: '507f1f77bcf86cd799439011' }, body: { isActive: 'false' } }, reply);

  assert.equal(reply.statusCode, 400);
  assert.deepEqual(reply.body, { ok: false, message: 'User active state must be a boolean.' });
});
