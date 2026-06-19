import PDFDocument from 'pdfkit';
import { formatRungisMonth } from './settings.js';

function formatMoney(value, currency = 'EUR') {
  return `${Number(value ?? 0).toFixed(2)} ${currency === 'EUR' ? '€' : currency}`;
}

function partyLines(party) {
  return [
    party.organisation,
    party.physicalAddress,
    `${party.zipcode} ${party.city}`.trim(),
    party.phoneNumber ? `Phone: ${party.phoneNumber}` : '',
    party.businessRegistrationId ? `SIRET: ${party.businessRegistrationId}` : '',
    party.vatId ? `VAT ID: ${party.vatId}` : ''
  ].filter(Boolean);
}

function drawParty(doc, title, party, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(11).text(title, x, y, { width });
  let cursorY = y + 16;
  doc.font('Helvetica').fontSize(10);
  for (const line of partyLines(party)) {
    doc.text(line, x, cursorY, { width });
    cursorY += doc.heightOfString(line, { width }) + 2;
  }
  return cursorY;
}

export function sendRungisBillPdf(reply, { invoice, filename }) {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${filename}"`)
      .header('Cache-Control', 'no-store')
      .send(Buffer.concat(chunks));
  });

  const month = formatRungisMonth(invoice.applicableYear, invoice.applicableMonth);
  doc.info.Title = `Rungis invoice ${month}`;
  doc.info.Creator = 'Rungis Portal';
  doc.font('Helvetica-Bold').fontSize(18).text(`Rungis invoice ${month}`);
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(11).text(`Invoice ID: ${invoice.billIdentifier ?? invoice.id}`);
  doc.text(`Role: ${invoice.role}`);
  doc.moveDown(0.75);

  const printableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = (printableWidth - 24) / 2;
  const startY = doc.y;
  const leftEnd = drawParty(doc, 'Admin / Seller', invoice.adminParty, doc.page.margins.left, startY, columnWidth);
  const rightEnd = drawParty(doc, 'Billed user / Buyer', invoice.userParty, doc.page.margins.left + columnWidth + 24, startY, columnWidth);
  doc.y = Math.max(leftEnd, rightEnd) + 18;

  const rows = [
    ['Monthly gross amount before tax', formatMoney(invoice.grossAmountBeforeTax, invoice.currency)],
    [`Rungis fee rate`, `${Number(invoice.rungisFeeRate ?? 0).toFixed(2)} %`],
    ['Payable amount before tax', formatMoney(invoice.payableAmountBeforeTax, invoice.currency)],
    [`VAT rate`, `${Number(invoice.vatRate ?? 0).toFixed(2)} %`],
    ['VAT amount', formatMoney(invoice.vatAmount, invoice.currency)],
    ['Payable amount including VAT', formatMoney(invoice.payableAmountIncludingVat, invoice.currency)]
  ];

  const labelWidth = 270;
  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(11).text(label, doc.page.margins.left, doc.y, { width: labelWidth, continued: true });
    doc.font('Helvetica-Bold').text(value, { align: 'right' });
    doc.moveDown(0.35);
  }

  doc.end();
}
