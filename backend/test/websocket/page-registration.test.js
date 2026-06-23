import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';

import { registerWebsocketRoutes } from '../../src/routes/modules/websocket.js';
import { registerPageRoutes } from '../../src/routes/modules/pages.js';

function createSocket() {
  const handlers = new Map();
  return {
    readyState: 1,
    sent: [],
    closed: null,
    send(payload) {
      this.sent.push(JSON.parse(payload));
    },
    close(code, reason) {
      this.closed = { code, reason };
    },
    ping() {},
    on(event, handler) {
      handlers.set(event, handler);
    },
    emitMessage(payload) {
      handlers.get('message')?.(Buffer.from(JSON.stringify(payload)));
    },
    emitClose() {
      handlers.get('close')?.();
    }
  };
}

function createContext() {
  const orderConnections = new Map();
  const stockConnections = new Map();
  const adminConnections = new Map();
  const clientDashboardConnections = new Map();
  const vendorDashboardConnections = new Map();

  return {
    adminConnections,
    broadcastClientUnpaidReminders: async () => {},
    broadcastOrderCatalogRemove: async () => {},
    broadcastOrderCatalogUpsert: async () => {},
    broadcastOrderPriceUpdate: async () => {},
    broadcastStocksSnapshot: async () => {},
    clientDashboardConnections,
    dropAdminConnection: (socket) => adminConnections.delete(socket),
    dropClientDashboardConnection: (socket) => clientDashboardConnections.delete(socket),
    dropOrderConnection: (socket) => orderConnections.delete(socket),
    dropStockConnection: (socket) => stockConnections.delete(socket),
    dropVendorDashboardConnection: (socket) => vendorDashboardConnections.delete(socket),
    orderConnections,
    redisClient: {},
    sendToVendorDashboardConnections: () => {},
    stockConnections,
    vendorDashboardConnections
  };
}

function createDeps() {
  return {
    hasDangerousInputKeys: () => false,
    mongoose,
    normalizeString: (value) => String(value ?? '').trim()
  };
}

test('websocket ping re-registers a vendor socket for the active routed page', async () => {
  const routes = new Map();
  const app = {
    get(path, options, handler) {
      routes.set(path, { options, handler });
    }
  };
  const context = createContext();
  const vendorId = new mongoose.Types.ObjectId().toString();

  registerWebsocketRoutes(app, context, createDeps());

  const socket = createSocket();
  await routes.get('/ws').handler(socket, {
    query: { token: 'valid-token' },
    server: {
      jwt: {
        verify: async () => ({
          sub: vendorId,
          role: 'vendor',
          page: 'dashboard'
        })
      }
    },
    log: { error: () => {} }
  });

  assert.deepEqual(context.vendorDashboardConnections.get(socket), { vendorId });
  assert.equal(context.stockConnections.has(socket), false);

  socket.emitMessage({ type: 'ping', page: 'stocks' });

  assert.equal(context.vendorDashboardConnections.has(socket), false);
  assert.deepEqual(context.stockConnections.get(socket), { vendorId });
  assert.equal(socket.sent.at(-1).type, 'pong');

  socket.emitClose();
});


test('dedicated bill page routes use role-specific page guards', async () => {
  const routes = new Map();
  const guard = (name) => async () => name;
  const deps = {
    buildPagePayload: async (_request, page) => ({ page }),
    redirectForSessionUser: () => '/dashboard',
    requireAdminPage: guard('admin'),
    requireAuth: guard('auth'),
    requireClientPage: guard('client'),
    requirePageRateLimit: guard('rate'),
    requireVendorPage: guard('vendor')
  };
  const app = {
    get(path, options, handler) {
      routes.set(path, { options, handler });
    }
  };

  registerPageRoutes(app, deps);

  assert.deepEqual(routes.get('/client-bills').options.preHandler, [deps.requirePageRateLimit, deps.requireClientPage]);
  assert.deepEqual(routes.get('/vendor-bills').options.preHandler, [deps.requirePageRateLimit, deps.requireVendorPage]);

  const clientReply = { view: (template, payload) => ({ template, payload }) };
  const vendorReply = { view: (template, payload) => ({ template, payload }) };
  assert.deepEqual(await routes.get('/client-bills').handler({}, clientReply), {
    template: 'client-bills.ejs',
    payload: { title: 'Client Bills', appConfig: { page: 'client-bills' } }
  });
  assert.deepEqual(await routes.get('/vendor-bills').handler({}, vendorReply), {
    template: 'vendor-bills.ejs',
    payload: { title: 'Vendor Bills', appConfig: { page: 'vendor-bills' } }
  });
});
