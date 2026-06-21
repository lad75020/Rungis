import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

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

function queryWithLean(value, onSelect = () => {}) {
  return {
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    select(fields) {
      onSelect(fields);
      return this;
    },
    async lean() {
      return value;
    }
  };
}

function parseSiretValue(value) {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!/^\d{14}$/.test(normalized)) {
    return { ok: false, message: 'SIRET must be a mandatory 14-digit integer.' };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    return { ok: false, message: 'SIRET must be a mandatory 14-digit integer.' };
  }

  return { ok: true, value: parsed };
}

function hasDangerousInputKeys(value, seen = new Set()) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => hasDangerousInputKeys(entry, seen));
  }
  return Object.entries(value).some(([key, nestedValue]) => {
    return key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'prototype' || key === 'constructor' || hasDangerousInputKeys(nestedValue, seen);
  });
}

function mapAdminManagedUser(user) {
  return {
    id: user._id.toString(),
    role: user.role,
    username: user.username,
    uniqueId: user.uniqueId ?? '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    organisation: user.organisation,
    city: user.city ?? '',
    zipcode: user.zipcode ?? '',
    email: user.email,
    physicalAddress: user.physicalAddress ?? '',
    phoneNumber: user.phoneNumber ?? '',
    businessDescription: user.businessDescription ?? '',
    vatId: user.vatId ?? '',
    billMentions: user.billMentions ?? '',
    logoFilename: user.logoFilename ?? '',
    logoUrl: user.logoFilename ? `/uploads/logos/${user.logoFilename}` : '',
    businessRegistrationId: user.businessRegistrationId,
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function registerRoutesWith(User, overrides = {}) {
  const requireAdminApi = () => {};
  const app = createApp();
  registerManagementRoutes(app, {}, {
    User,
    bcrypt: {
      async hash(password, rounds) {
        assert.equal(rounds, 12);
        return `hashed:${password}`;
      }
    },
    hasDangerousInputKeys,
    mapAdminManagedUser,
    mongoose,
    normalizeString: (value) => (typeof value === 'string' ? value.trim() : ''),
    parseSiretValue,
    requireAdminApi,
    generateAdminUserUniqueId: async () => '54321',
    ...overrides
  });
  return { app, requireAdminApi };
}

function validAdminUserPayload(overrides = {}) {
  return {
    role: 'vendor',
    username: 'market-vendor',
    firstName: 'Market',
    lastName: 'Vendor',
    organisation: 'Marché Primeur',
    city: 'Paris',
    zipcode: '75001',
    email: 'vendor@example.test',
    physicalAddress: '1 rue du Marché',
    phoneNumber: '+33123456789',
    businessRegistrationId: '35600000000048',
    businessDescription: 'Fresh produce',
    vatId: 'FR12345678901',
    billMentions: 'Payment due',
    logoFilename: '',
    password: '11Test00!!',
    ...overrides
  };
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
    role: { $in: ['vendor', 'client', 'admin'] },
    organisation: { $regex: '^Mar', $options: 'i' }
  });
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.body.ok, true);
  assert.equal(reply.body.users[0].id, userId);
  assert.equal(reply.body.users[0].isActive, true);
  assert.equal('passwordHash' in reply.body.users[0], false);
});

test('admin user create hashes password, forces disabled default, and omits secrets', async () => {
  const userId = new mongoose.Types.ObjectId();
  const createdAt = new Date('2026-06-20T10:00:00Z');
  const updatedAt = new Date('2026-06-20T11:00:00Z');
  let duplicateFilter;
  let createdDocument;
  const User = {
    findOne(filter) {
      duplicateFilter = filter;
      return queryWithLean(null);
    },
    async create(document) {
      createdDocument = document;
      return {
        _id: userId,
        ...document,
        createdAt,
        updatedAt
      };
    }
  };
  const { app, requireAdminApi } = registerRoutesWith(User);
  const route = app.routes.find((entry) => entry.method === 'POST' && entry.path === '/api/admin/users');
  assert.equal(route.options.preHandler, requireAdminApi);

  const reply = createReply();
  await route.handler({ body: validAdminUserPayload({ isActive: true }) }, reply);

  assert.equal(reply.statusCode, 201);
  assert.deepEqual(duplicateFilter, {
    $or: [{ username: 'market-vendor' }, { email: 'vendor@example.test' }]
  });
  assert.equal(createdDocument.uniqueId, '54321');
  assert.equal(createdDocument.isActive, false);
  assert.equal(createdDocument.passwordHash, 'hashed:11Test00!!');
  assert.equal('password' in createdDocument, false);
  assert.equal(reply.body.user.isActive, false);
  assert.equal(reply.body.user.id, userId.toString());
  assert.equal('password' in reply.body.user, false);
  assert.equal('passwordHash' in reply.body.user, false);
  assert.equal(JSON.stringify(reply.body).includes('hashed:'), false);
});

test('admin user create rejects dangerous and protected payload keys', async () => {
  const { app } = registerRoutesWith({});
  const route = app.routes.find((entry) => entry.method === 'POST' && entry.path === '/api/admin/users');
  const reply = createReply();

  await route.handler({ body: validAdminUserPayload({ uniqueId: '12345', passwordHash: 'plaintext', $set: { role: 'admin' } }) }, reply);

  assert.equal(reply.statusCode, 400);
  assert.equal(reply.body.ok, false);
  assert.equal(reply.body.message, 'User form contains unsupported fields.');
});

test('admin user create rejects duplicate username or email without hashing password', async () => {
  let hashCalled = false;
  const User = {
    findOne(filter) {
      assert.deepEqual(filter, {
        $or: [{ username: 'market-vendor' }, { email: 'vendor@example.test' }]
      });
      return queryWithLean({ username: 'market-vendor', email: 'other@example.test', uniqueId: '99999' });
    }
  };
  const { app } = registerRoutesWith(User, {
    bcrypt: {
      async hash() {
        hashCalled = true;
        return 'hash';
      }
    }
  });
  const route = app.routes.find((entry) => entry.method === 'POST' && entry.path === '/api/admin/users');
  const reply = createReply();

  await route.handler({ body: validAdminUserPayload() }, reply);

  assert.equal(reply.statusCode, 409);
  assert.equal(reply.body.fieldErrors.username, 'Username is already used.');
  assert.equal(hashCalled, false);
});

test('admin user load rejects malformed ids and returns 404 for unknown users', async () => {
  const User = {
    findById() {
      return queryWithLean(null);
    }
  };
  const { app } = registerRoutesWith(User);
  const route = app.routes.find((entry) => entry.method === 'GET' && entry.path === '/api/admin/users/:id');

  const malformedReply = createReply();
  await route.handler({ params: { id: 'not-an-id' } }, malformedReply);
  assert.equal(malformedReply.statusCode, 400);

  const notFoundReply = createReply();
  await route.handler({ params: { id: new mongoose.Types.ObjectId().toString() } }, notFoundReply);
  assert.equal(notFoundReply.statusCode, 404);
});

test('admin user update validates duplicates, hashes optional replacement password, and updates active state', async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const createdAt = new Date('2026-06-20T10:00:00Z');
  const updatedAt = new Date('2026-06-20T11:00:00Z');
  let duplicateFilter;
  let updateDocument;
  const User = {
    findById(id) {
      assert.equal(id, userId);
      return queryWithLean({ _id: userId });
    },
    findOne(filter) {
      duplicateFilter = filter;
      return queryWithLean(null);
    },
    findByIdAndUpdate(id, update, options) {
      assert.equal(id, userId);
      updateDocument = update;
      assert.deepEqual(options, { new: true, runValidators: true });
      return queryWithLean({
        _id: { toString: () => userId },
        ...update.$set,
        createdAt,
        updatedAt
      });
    }
  };
  const { app } = registerRoutesWith(User);
  const route = app.routes.find((entry) => entry.method === 'PUT' && entry.path === '/api/admin/users/:id');
  const reply = createReply();

  await route.handler({
    params: { id: userId },
    body: validAdminUserPayload({ role: 'client', username: 'updated-client', email: 'updated@example.test', isActive: true, password: '22Change!!' })
  }, reply);

  assert.deepEqual(duplicateFilter, {
    $or: [{ username: 'updated-client' }, { email: 'updated@example.test' }],
    _id: { $ne: userId }
  });
  assert.equal(updateDocument.$set.isActive, true);
  assert.equal('uniqueId' in updateDocument.$set, false);
  assert.equal(updateDocument.$set.passwordHash, 'hashed:22Change!!');
  assert.equal('password' in updateDocument.$set, false);
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.body.user.isActive, true);
  assert.equal('passwordHash' in reply.body.user, false);
});

test('admin user update rejects duplicate email values for other users', async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const User = {
    findById() {
      return queryWithLean({ _id: userId });
    },
    findOne() {
      return queryWithLean({ username: 'other', email: 'updated@example.test', uniqueId: '99999' });
    }
  };
  const { app } = registerRoutesWith(User);
  const route = app.routes.find((entry) => entry.method === 'PUT' && entry.path === '/api/admin/users/:id');
  const reply = createReply();

  await route.handler({
    params: { id: userId },
    body: validAdminUserPayload({ username: 'updated-client', email: 'updated@example.test', isActive: false, password: '' })
  }, reply);

  assert.equal(reply.statusCode, 409);
  assert.equal(reply.body.fieldErrors.email, 'Email is already used.');
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
