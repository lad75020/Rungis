import { FacturXGenerationError } from '../factur-x/invoice-data.js';
import { formatRungisMonth, roundMoney } from './settings.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringifyBusinessId(value) {
  const normalized = normalizeString(value);
  if (normalized) {
    return normalized;
  }
  if (Number.isFinite(Number(value))) {
    return String(Math.trunc(Number(value)));
  }
  return '';
}

export function normalizePartySnapshot(user) {
  if (!user) {
    return null;
  }
  return {
    organisation: normalizeString(user.organisation),
    logoFilename: normalizeString(user.logoFilename),
    city: normalizeString(user.city),
    zipcode: normalizeString(user.zipcode),
    physicalAddress: normalizeString(user.physicalAddress),
    phoneNumber: normalizeString(user.phoneNumber),
    businessRegistrationId: stringifyBusinessId(user.businessRegistrationId),
    email: normalizeString(user.email),
    vatId: normalizeString(user.vatId).toUpperCase()
  };
}

export function assertCompletePartySnapshot(snapshot, label) {
  const required = [
    ['organisation', 'organisation'],
    ['physicalAddress', 'address'],
    ['zipcode', 'zipcode'],
    ['city', 'city'],
    ['phoneNumber', 'phone number'],
    ['businessRegistrationId', 'SIRET']
  ];
  const missing = required
    .filter(([key]) => !normalizeString(snapshot?.[key]))
    .map(([, name]) => `${label} ${name}`);
  if (missing.length > 0) {
    throw new FacturXGenerationError('Rungis invoice identity is incomplete.', {
      statusCode: 422,
      errorCode: 'missing_invoice_data',
      details: missing
    });
  }
}

export function buildRungisBillIdentifier(bill) {
  return `RUNGIS-${bill.applicableYear}-${String(bill.applicableMonth).padStart(2, '0')}-${bill.role}-${bill.userUniqueId}`;
}

export function mapRungisBillSummary(bill) {
  return {
    id: String(bill._id),
    applicableYear: Number(bill.applicableYear),
    applicableMonth: Number(bill.applicableMonth),
    role: bill.role,
    userOrganisationName: bill.userOrganisationName,
    userUniqueId: bill.userUniqueId,
    grossAmountBeforeTax: roundMoney(bill.grossAmountBeforeTax),
    rungisFeeRate: roundMoney(bill.rungisFeeRate),
    payableAmountBeforeTax: roundMoney(bill.payableAmountBeforeTax),
    vatRate: roundMoney(bill.vatRate),
    vatAmount: roundMoney(bill.vatAmount),
    payableAmountIncludingVat: roundMoney(bill.payableAmountIncludingVat),
    currency: bill.currency ?? 'EUR',
    paid: Boolean(bill.paid),
    generatedAt: bill.generatedAt ? new Date(bill.generatedAt).toISOString() : null
  };
}

function withLogoUrl(snapshot, getUserLogoUrl) {
  const logoFilename = normalizeString(snapshot?.logoFilename);
  return {
    ...snapshot,
    logoUrl: logoFilename && typeof getUserLogoUrl === 'function' ? getUserLogoUrl(logoFilename) : ''
  };
}

export function buildRungisInvoiceView(bill, { getUserLogoUrl } = {}) {
  assertCompletePartySnapshot(bill.adminPartySnapshot, 'Admin');
  assertCompletePartySnapshot(bill.userPartySnapshot, 'User');
  const id = String(bill._id);
  return {
    ...mapRungisBillSummary(bill),
    id,
    billIdentifier: buildRungisBillIdentifier(bill),
    adminParty: withLogoUrl(bill.adminPartySnapshot, getUserLogoUrl),
    userParty: withLogoUrl(bill.userPartySnapshot, getUserLogoUrl),
    pdfUrl: `/api/rungis-bills/${encodeURIComponent(id)}/pdf`,
    facturXUrl: `/api/rungis-bills/${encodeURIComponent(id)}/factur-x`
  };
}

function toFacturXParty(snapshot) {
  return {
    organisation: snapshot.organisation,
    address: snapshot.physicalAddress,
    zipcode: snapshot.zipcode,
    city: snapshot.city,
    phoneNumber: snapshot.phoneNumber,
    email: snapshot.email ?? '',
    businessId: snapshot.businessRegistrationId,
    vatId: snapshot.vatId ?? ''
  };
}

export function buildRungisFacturXInput(invoice) {
  assertCompletePartySnapshot(invoice.adminParty, 'Admin');
  assertCompletePartySnapshot(invoice.userParty, 'User');
  const month = formatRungisMonth(invoice.applicableYear, invoice.applicableMonth);
  const currency = invoice.currency ?? 'EUR';
  return {
    role: invoice.role,
    title: `Rungis service fee invoice ${month}`,
    billIdentifier: invoice.billIdentifier ?? `RUNGIS-${month}-${invoice.role}`,
    filename: `rungis-bill-${month}-${invoice.userUniqueId ?? invoice.id}-factur-x.pdf`,
    bill: {
      key: invoice.id,
      day: `${month}-01`,
      orderedAt: new Date().toISOString(),
      deliveryDate: `${month}-01`,
      currency,
      totalPrice: roundMoney(invoice.payableAmountBeforeTax),
      totalPriceIncludingVat: roundMoney(invoice.payableAmountIncludingVat),
      items: [
        {
          kind: 'rungis-service-fee',
          merchandiseId: `rungis-fee-${month}-${invoice.role}-${invoice.userUniqueId ?? invoice.id}`,
          name: 'Rungis service fee',
          reference: `${month} ${invoice.role} fee`,
          category: 'Service fee',
          quantity: 1,
          unitCode: 'C62',
          unitPrice: roundMoney(invoice.payableAmountBeforeTax),
          lineTotal: roundMoney(invoice.payableAmountBeforeTax),
          vatRate: roundMoney(invoice.vatRate),
          vatCategory: Number(invoice.vatRate) > 0 ? 'S' : 'O',
          vatExemptionReason: Number(invoice.vatRate) > 0 ? '' : 'Outside scope of VAT'
        }
      ]
    },
    vendor: toFacturXParty(invoice.adminParty),
    client: toFacturXParty(invoice.userParty)
  };
}
