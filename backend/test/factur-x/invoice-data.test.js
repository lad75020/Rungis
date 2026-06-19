import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { normalizeBillToFacturXData } from '../../src/services/factur-x/invoice-data.js';

const fixtures = JSON.parse(await readFile(new URL('../../fixtures/factur-x/bills.fixture.json', import.meta.url), 'utf8'));

test('normalizes complete bill data into EN 16931 Factur-X invoice data', () => {
  const invoice = normalizeBillToFacturXData({
    role: 'vendor',
    title: 'Vendor Bill',
    ...fixtures.simple
  });

  assert.equal(invoice.profile, 'EN 16931');
  assert.equal(invoice.invoiceId, 'BILL-2026-06-19-001');
  assert.equal(invoice.issueDate, '20260619');
  assert.equal(invoice.deliveryDate, '20260620');
  assert.equal(invoice.seller.name, 'Vendor SAS');
  assert.equal(invoice.seller.legalRegistrationId, '1234567890123');
  assert.equal(invoice.seller.taxRegistrationId, 'FR12345678901');
  assert.deepEqual(invoice.includedNotes, ['Payment <due> & "safe" within 30 days.']);
  assert.equal(invoice.buyer.name, 'Client SARL');
  assert.equal(invoice.lines.length, 1);
  assert.equal(invoice.lines[0].unitCode, 'C62');
  assert.equal(invoice.lines[0].vatCategory, 'S');
  assert.equal(invoice.lines[0].vatRate, 5.5);
  assert.equal(invoice.lines[0].vatExemptionReason, '');
  assert.equal(invoice.vatBreakdowns[0].taxAmount, 1.38);
  assert.equal(invoice.totals.amountDue, 26.38);
});

test('derives a French seller VAT ID from SIRET when the vendor VAT field is empty', () => {
  const invoice = normalizeBillToFacturXData({
    role: 'vendor',
    title: 'Vendor Bill',
    ...fixtures.simple,
    vendor: {
      ...fixtures.simple.vendor,
      businessId: '9132963425358',
      vatId: ''
    }
  });

  assert.equal(invoice.seller.legalRegistrationId, '9132963425358');
  assert.equal(invoice.seller.taxRegistrationId, 'FR72913296342');
});

test('preserves refund and penalty signs while reconciling totals', () => {
  const invoice = normalizeBillToFacturXData({
    role: 'vendor',
    title: 'Vendor Bill',
    ...fixtures.refund
  });

  assert.deepEqual(invoice.lines.map((line) => line.lineTotal), [20, -5, 2]);
  assert.equal(invoice.lines[1].quantity, -1);
  assert.equal(invoice.lines[1].unitPrice, 5);
  assert.equal(invoice.totals.lineNetAmount, 17);
  assert.equal(invoice.totals.amountDue, 17);
});

test('fails closed when legal party data is incomplete', () => {
  assert.throws(
    () => normalizeBillToFacturXData({ role: 'vendor', title: 'Vendor Bill', ...fixtures.missingLegal }),
    (error) => {
      assert.equal(error.errorCode, 'missing_invoice_data');
      assert.equal(error.statusCode, 422);
      assert.ok(error.details.some((detail) => detail.includes('Seller address')));
      assert.ok(error.details.some((detail) => detail.includes('Seller SIRET')));
      assert.ok(error.details.some((detail) => detail.includes('Seller VAT ID')));
      return true;
    }
  );
});
