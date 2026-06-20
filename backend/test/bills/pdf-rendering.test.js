import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { sendBillPdf } from '../../src/routes/index.js';

const execFileAsync = promisify(execFile);

function collectPdfFromSender(options) {
  const reply = {
    headers: {},
    header(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    send(doc) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }
  };

  return sendBillPdf(reply, options);
}

async function extractPdfText(buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rungis-bill-pdf-'));
  const pdfPath = path.join(directory, 'bill.pdf');

  try {
    await writeFile(pdfPath, buffer);
    const { stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-']);
    return stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const labels = {
  billId: 'Bill ID',
  orderedAt: 'Ordered at',
  deliveryDate: 'Delivery date',
  vendor: 'Vendor',
  client: 'Client',
  organisation: 'Organisation',
  address: 'Address',
  zipcode: 'Zipcode',
  city: 'City',
  phone: 'Phone',
  businessId: 'SIRET',
  vatId: 'VAT ID',
  billMentions: 'Bill mentions',
  item: 'Item',
  category: 'Category',
  unitPrice: 'Unit price',
  unitPriceIncludingVat: 'Unit price incl. VAT',
  qty: 'Qty',
  lineTotal: 'Line total',
  lineTotalIncludingVat: 'Line total incl. VAT',
  total: 'Total',
  totalIncludingVat: 'Total incl. VAT'
};

test('daily bill PDF puts bill mentions at the bottom and omits category column', async () => {
  const text = await extractPdfText(await collectPdfFromSender({
    filename: 'bill.pdf',
    title: 'Vendor Bill',
    labels,
    billIdentifier: 'BILL-2026-06-19-001',
    orderedAt: '2026-06-19T08:00:00.000Z',
    deliveryDate: '2026-06-20T00:00:00.000Z',
    topLogoPath: '',
    vendor: {
      organisation: 'Vendor SAS',
      address: '1 Market Street',
      zipcode: '75001',
      city: 'Paris',
      phoneNumber: '0102030405',
      businessId: '35600000000048',
      vatId: 'FR12345678901',
      billMentions: 'Payment due within 30 days.\nBank transfer only.'
    },
    client: {
      organisation: 'Client SARL',
      address: '2 Client Avenue',
      zipcode: '75002',
      city: 'Paris',
      businessId: '44306184100047'
    },
    items: [{
      name: 'Tomatoes',
      reference: 'TOM-001',
      category: 'Vegetables',
      unitPrice: 12.5,
      unitPriceIncludingVat: 13.19,
      quantity: 2,
      lineTotal: 25,
      lineTotalIncludingVat: 26.38,
      vatRate: 5.5
    }],
    totalPrice: 25,
    totalPriceIncludingVat: 26.38,
    currency: 'EUR'
  }));

  assert.doesNotMatch(text, /Category/);
  assert.doesNotMatch(text, /Vegetables/);
  assert.match(text, /Bill mentions/);
  assert.match(text, /Payment due within 30 days\./);
  assert.ok(text.indexOf('Bill mentions') > text.indexOf('Total incl. VAT'));
});
