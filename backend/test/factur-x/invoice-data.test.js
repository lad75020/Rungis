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
  assert.equal(invoice.buyer.name, 'Client SARL');
  assert.equal(invoice.lines.length, 1);
  assert.equal(invoice.lines[0].unitCode, 'C62');
  assert.equal(invoice.lines[0].vatCategory, 'O');
  assert.equal(invoice.totals.amountDue, 25);
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
      return true;
    }
  );
});
