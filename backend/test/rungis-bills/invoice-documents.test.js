import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import {
  buildRungisFacturXInput,
  buildRungisInvoiceView,
  normalizePartySnapshot
} from '../../src/services/rungis-bills/invoice-data.js';

function party(overrides = {}) {
  return {
    organisation: 'Rungis Org',
    logoFilename: '',
    city: 'Paris',
    zipcode: '75001',
    physicalAddress: '1 rue du marché',
    phoneNumber: '0102030405',
    businessRegistrationId: 35600000000048,
    email: 'billing@example.test',
    vatId: 'FR12345678901',
    ...overrides
  };
}

test('normalizes user party snapshots for invoice rendering', () => {
  const snapshot = normalizePartySnapshot(party({ organisation: '  Admin  ' }));
  assert.equal(snapshot.organisation, 'Admin');
  assert.equal(snapshot.businessRegistrationId, '35600000000048');
  assert.equal(snapshot.vatId, 'FR12345678901');
});

test('builds a Rungis invoice view and matching Factur-X service line', () => {
  const bill = {
    _id: new mongoose.Types.ObjectId(),
    applicableYear: 2026,
    applicableMonth: 5,
    role: 'vendor',
    userUniqueId: '00024',
    userOrganisationName: 'Vendor Org',
    grossAmountBeforeTax: 1000,
    rungisFeeRate: 2.5,
    payableAmountBeforeTax: 25,
    vatRate: 20,
    vatAmount: 5,
    payableAmountIncludingVat: 30,
    currency: 'EUR',
    paid: false,
    generatedAt: new Date('2026-06-01T00:00:00Z'),
    adminPartySnapshot: normalizePartySnapshot(party({ organisation: 'Admin Org' })),
    userPartySnapshot: normalizePartySnapshot(party({ organisation: 'Vendor Org', businessRegistrationId: 44306184100047 }))
  };

  const invoice = buildRungisInvoiceView(bill);
  assert.equal(invoice.billIdentifier, 'RUNGIS-2026-05-vendor-00024');
  assert.equal(invoice.pdfUrl, `/api/rungis-bills/${String(bill._id)}/pdf`);

  const facturX = buildRungisFacturXInput(invoice);
  assert.equal(facturX.vendor.organisation, 'Admin Org');
  assert.equal(facturX.client.organisation, 'Vendor Org');
  assert.equal(facturX.bill.items.length, 1);
  assert.equal(facturX.bill.items[0].lineTotal, 25);
  assert.equal(facturX.bill.totalPriceIncludingVat, 30);
});
