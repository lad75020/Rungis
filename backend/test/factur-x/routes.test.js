import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerBillRoutes } from '../../src/routes/modules/bills.js';
import { FacturXGenerationError } from '../../src/services/factur-x/invoice-data.js';

function createReply() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    code(value) { this.statusCode = value; return this; },
    type(value) { this.headers['content-type'] = value; return this; },
    header(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    send(value) { this.payload = value; return this; }
  };
}

function createDeps(overrides = {}) {
  const users = {
    vendor: { organisation: 'Vendor SAS', physicalAddress: '1 Market Street', zipcode: '75001', city: 'Paris', phoneNumber: '0102030405', email: 'vendor@example.com', businessRegistrationId: '35600000000048', vatId: 'FR12345678901', billMentions: 'Payment due within 30 days.' },
    client: { organisation: 'Client SARL', physicalAddress: '2 Client Avenue', zipcode: '75002', city: 'Paris', email: 'client@example.com', businessRegistrationId: '44306184100047' }
  };
  return {
    getRequestLanguage: () => 'en',
    getTranslationText: (_translations, _language, _key, fallback) => fallback,
    getUserLogoAbsolutePath: () => null,
    requireClientApi: async () => {},
    requireVendorApi: async () => {},
    sanitizeFilenamePart: (value) => String(value).replace(/[^a-z0-9-]/gi, '-'),
    getOrCreatePersistedBillUuid: async () => 'BILL-UUID',
    getVendorBillDetails: async () => ({
      ok: true,
      bill: {
        key: 'client::2026-06-19',
        day: '2026-06-19',
        clientId: 'client',
        clientUsername: 'client',
        orderedAt: '2026-06-19T08:00:00.000Z',
        deliveryDate: '2026-06-20T00:00:00.000Z',
        items: [{ merchandiseId: 'item-1', name: 'Tomatoes', category: 'Vegetables', unitPrice: 25, quantity: 1, lineTotal: 25 }],
        totalPrice: 25,
        currency: 'EUR'
      }
    }),
    getClientBillDetails: async () => ({
      ok: true,
      bill: {
        key: 'vendor::2026-06-19',
        day: '2026-06-19',
        vendorId: 'vendor',
        vendorName: 'Vendor SAS',
        orderedAt: '2026-06-19T08:00:00.000Z',
        deliveryDate: '2026-06-20T00:00:00.000Z',
        items: [{ merchandiseId: 'item-1', name: 'Tomatoes', category: 'Vegetables', unitPrice: 25, quantity: 1, lineTotal: 25 }],
        totalPrice: 25,
        currency: 'EUR'
      }
    }),
    sendBillPdf: async (reply) => reply.send(Buffer.from('pdf')),
    sendFacturXBill: async (reply, options) => reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${options.filename}"`)
      .header('Cache-Control', 'no-store')
      .send(Buffer.from('%PDF factur-x')),
    User: {
      findById(id) {
        return { select: () => ({ lean: async () => users[id] ?? null }) };
      }
    },
    ...overrides
  };
}

function createRoutes(deps) {
  const routes = new Map();
  registerBillRoutes({ get: (path, options, handler) => routes.set(path, { options, handler }) }, deps);
  return routes;
}

const server = { getTranslations: async () => ({}) };

test('registers vendor and client Factur-X endpoints with existing role guards', () => {
  const deps = createDeps();
  const routes = createRoutes(deps);

  assert.equal(routes.get('/api/bills/vendor/:key/factur-x').options.preHandler, deps.requireVendorApi);
  assert.equal(routes.get('/api/bills/client/:key/factur-x').options.preHandler, deps.requireClientApi);
});

test('vendor Factur-X route returns PDF attachment headers', async () => {
  const routes = createRoutes(createDeps());
  const reply = createReply();

  await routes.get('/api/bills/vendor/:key/factur-x').handler({
    server,
    session: { user: { id: 'vendor', organisation: 'Vendor SAS', physicalAddress: '1 Market Street', zipcode: '75001', city: 'Paris', businessRegistrationId: '35600000000048' } },
    params: { key: 'client::2026-06-19' },
    log: { error: () => {} }
  }, reply);

  assert.equal(reply.statusCode, 200);
  assert.equal(reply.headers['content-type'], 'application/pdf');
  assert.equal(reply.headers['cache-control'], 'no-store');
  assert.match(reply.headers['content-disposition'], /attachment; filename="vendor-bill-2026-06-19-client-factur-x\.pdf"/);
});

test('client Factur-X route returns PDF attachment headers', async () => {
  const routes = createRoutes(createDeps());
  const reply = createReply();

  await routes.get('/api/bills/client/:key/factur-x').handler({
    server,
    session: { user: { id: 'client', organisation: 'Client SARL', physicalAddress: '2 Client Avenue', zipcode: '75002', city: 'Paris', businessRegistrationId: '44306184100047' } },
    params: { key: 'vendor::2026-06-19' },
    log: { error: () => {} }
  }, reply);

  assert.equal(reply.statusCode, 200);
  assert.equal(reply.headers['content-type'], 'application/pdf');
  assert.equal(reply.headers['cache-control'], 'no-store');
  assert.match(reply.headers['content-disposition'], /attachment; filename="client-bill-2026-06-19-Vendor-SAS-factur-x\.pdf"/);
});

test('Factur-X routes pass seller VAT ID and bill mentions to generation', async () => {
  const capturedOptions = [];
  const routes = createRoutes(createDeps({
    sendFacturXBill: async (reply, options) => {
      capturedOptions.push(options);
      return reply.type('application/pdf').send(Buffer.from('%PDF factur-x'));
    }
  }));

  await routes.get('/api/bills/vendor/:key/factur-x').handler({
    server,
    session: { user: { id: 'vendor', organisation: 'Vendor SAS', physicalAddress: '1 Market Street', zipcode: '75001', city: 'Paris', businessRegistrationId: '35600000000048' } },
    params: { key: 'client::2026-06-19' },
    log: { error: () => {} }
  }, createReply());

  await routes.get('/api/bills/client/:key/factur-x').handler({
    server,
    session: { user: { id: 'client', organisation: 'Client SARL', physicalAddress: '2 Client Avenue', zipcode: '75002', city: 'Paris', businessRegistrationId: '44306184100047' } },
    params: { key: 'vendor::2026-06-19' },
    log: { error: () => {} }
  }, createReply());

  assert.equal(capturedOptions.length, 2);
  for (const options of capturedOptions) {
    assert.equal(options.vendor.vatId, 'FR12345678901');
    assert.equal(options.vendor.billMentions, 'Payment due within 30 days.');
  }
});

test('route returns JSON error when bill key is invalid or not found', async () => {
  const routes = createRoutes(createDeps({ getVendorBillDetails: async () => ({ ok: false, code: 400, message: 'Invalid bill selection.' }) }));
  const reply = createReply();

  await routes.get('/api/bills/vendor/:key/factur-x').handler({
    server,
    session: { user: { id: 'vendor' } },
    params: { key: 'bad' },
    log: { error: () => {} }
  }, reply);

  assert.equal(reply.statusCode, 400);
  assert.equal(reply.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(reply.payload.error, 'invalid_bill_key');
});

test('route returns safe JSON error and no PDF when generation validation fails', async () => {
  const routes = createRoutes(createDeps({
    sendFacturXBill: async () => {
      throw new FacturXGenerationError('Generated Factur-X document failed validation.', {
        statusCode: 500,
        errorCode: 'validation_failed',
        details: ['XMP fx:DocumentFileName is missing or invalid.']
      });
    }
  }));
  const reply = createReply();

  await routes.get('/api/bills/vendor/:key/factur-x').handler({
    server,
    session: { user: { id: 'vendor' } },
    params: { key: 'client::2026-06-19' },
    log: { error: () => {} }
  }, reply);

  assert.equal(reply.statusCode, 500);
  assert.equal(reply.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(reply.payload.error, 'validation_failed');
  assert.deepEqual(reply.payload.details, ['XMP fx:DocumentFileName is missing or invalid.']);
});
