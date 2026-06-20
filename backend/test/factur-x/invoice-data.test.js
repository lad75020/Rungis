import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { normalizeBillToFacturXData } from '../../src/services/factur-x/invoice-data.js';
import { buildFacturXXml, renderFacturXReadablePdf } from '../../src/services/factur-x/generator.js';

const fixtures = JSON.parse(await readFile(new URL('../../fixtures/factur-x/bills.fixture.json', import.meta.url), 'utf8'));
const execFileAsync = promisify(execFile);

async function extractPdfText(buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rungis-factur-x-pdf-'));
  const pdfPath = path.join(directory, 'invoice.pdf');

  try {
    await writeFile(pdfPath, buffer);
    const { stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-']);
    return stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

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
  assert.equal(invoice.seller.legalRegistrationId, '35600000000048');
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
      businessId: '91329634253580',
      vatId: ''
    }
  });

  assert.equal(invoice.seller.legalRegistrationId, '91329634253580');
  assert.equal(invoice.seller.taxRegistrationId, 'FR72913296342');
});

test('rejects final SIRET values that are not exactly 14 plain digits', () => {
  for (const businessId of ['3560000000004', '356000000000480', '356 000 000 00048', '3560000000004A']) {
    assert.throws(
      () => normalizeBillToFacturXData({
        role: 'vendor',
        title: 'Vendor Bill',
        ...fixtures.simple,
        vendor: { ...fixtures.simple.vendor, businessId }
      }),
      (error) => {
        assert.equal(error.errorCode, 'missing_invoice_data');
        assert.ok(error.details.some((detail) => detail.includes('Seller SIRET must be a 14-digit number.')));
        return true;
      }
    );
  }
});

test('does not use category as a visible Factur-X line description fallback', () => {
  const invoice = normalizeBillToFacturXData({
    role: 'vendor',
    title: 'Vendor Bill',
    ...fixtures.simple,
    bill: {
      ...fixtures.simple.bill,
      items: [{
        ...fixtures.simple.bill.items[0],
        reference: '',
        comment: '',
        category: 'Vegetables'
      }]
    }
  });

  assert.equal(invoice.lines[0].category, 'Vegetables');
  assert.equal(invoice.lines[0].description, '');
  assert.doesNotMatch(buildFacturXXml(invoice), /Vegetables/);
});

test('renders readable Factur-X bill mentions after totals and omits category text', async () => {
  const invoice = normalizeBillToFacturXData({
    role: 'vendor',
    title: 'Vendor Bill',
    ...fixtures.simple
  });

  const text = await extractPdfText(await renderFacturXReadablePdf(invoice));

  assert.match(text, /Bill mentions/);
  assert.ok(text.indexOf('Bill mentions') > text.indexOf('Totals'));
  assert.ok(text.indexOf('Payment <due> & "safe" within 30 days.') > text.indexOf('Grand total'));
  assert.doesNotMatch(text, /Vegetables/);
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
