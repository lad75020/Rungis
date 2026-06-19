import test from 'node:test';
import assert from 'node:assert/strict';

import { registerRungisBillRoutes } from '../../src/routes/modules/rungis-bills.js';

function createApp() {
  const routes = [];
  return {
    routes,
    get(path, options, handler) {
      routes.push({ method: 'GET', path, options, handler });
    }
  };
}

test('registers current, detail, PDF, and Factur-X user routes behind the user guard', () => {
  const app = createApp();
  const requireRungisBillUserApi = () => {};
  registerRungisBillRoutes(app, {
    getUserLogoUrl: () => '',
    requireRungisBillUserApi,
    RungisBill: {},
    sendFacturXBill: async () => {},
    sanitizeFilenamePart: (value) => String(value)
  });

  assert.deepEqual(app.routes.map((route) => `${route.method} ${route.path}`), [
    'GET /api/rungis-bills/current',
    'GET /api/rungis-bills/:billId',
    'GET /api/rungis-bills/:billId/pdf',
    'GET /api/rungis-bills/:billId/factur-x'
  ]);
  for (const route of app.routes) {
    assert.equal(route.options.preHandler, requireRungisBillUserApi);
  }
});
