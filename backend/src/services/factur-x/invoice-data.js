export const FACTUR_X_XML_FILENAME = 'factur-x.xml';
export const FACTUR_X_XML_MIME_TYPE = 'text/xml';
export const FACTUR_X_CONFORMANCE_LEVEL = 'EN 16931';
export const FACTUR_X_PROFILE_ID = 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931';
export const FACTUR_X_DOCUMENT_TYPE = 'INVOICE';
export const DEFAULT_COUNTRY_CODE = 'FR';
export const DEFAULT_CURRENCY = 'EUR';
export const DEFAULT_UNIT_CODE = 'C62';
export const DEFAULT_VAT_CATEGORY = 'O';
export const DEFAULT_VAT_RATE = 0;
export const DEFAULT_VAT_EXEMPTION_REASON = 'Outside scope of VAT';

export class FacturXGenerationError extends Error {
  constructor(message, { statusCode = 422, errorCode = 'missing_invoice_data', details = [] } = {}) {
    super(message);
    this.name = 'FacturXGenerationError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireString(value, label, details) {
  const normalized = normalizeString(value);
  if (!normalized || normalized === '-') {
    details.push(`${label} is required.`);
  }
  return normalized;
}

function normalizeSiret(value, label, details) {
  const normalized = normalizeString(String(value ?? '')).replace(/\s+/g, '');
  if (!/^\d{13}$/.test(normalized)) {
    details.push(`${label} SIRET must be a 13-digit number.`);
  }
  return normalized;
}

export function roundMoney(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const sign = numeric < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(numeric) + Number.EPSILON) * 100) / 100);
}

export function formatMoney(value) {
  return roundMoney(value).toFixed(2);
}

export function formatDate102(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('');
}

function normalizeParty(input, roleLabel, details) {
  const name = requireString(input?.organisation, `${roleLabel} organisation`, details);
  const lineOne = requireString(input?.address, `${roleLabel} address`, details);
  const postCode = requireString(input?.zipcode, `${roleLabel} zipcode`, details);
  const city = requireString(input?.city, `${roleLabel} city`, details);
  const legalRegistrationId = normalizeSiret(input?.businessId, roleLabel, details);
  const taxRegistrationId = normalizeString(input?.vatId);
  if (roleLabel === 'Seller' && !taxRegistrationId) {
    details.push('Seller VAT ID is required.');
  }

  return {
    name,
    legalRegistrationId,
    legalRegistrationScheme: '0002',
    taxRegistrationId,
    billMentions: normalizeString(input?.billMentions),
    postalAddress: {
      lineOne,
      postCode,
      city,
      countryCode: normalizeString(input?.countryCode) || DEFAULT_COUNTRY_CODE
    },
    phoneNumber: normalizeString(input?.phoneNumber),
    email: normalizeString(input?.email)
  };
}

function normalizeLine(item, index) {
  const rawQuantity = Number(item?.quantity ?? 1);
  const rawLineTotal = roundMoney(item?.lineTotal ?? item?.unitPrice ?? 0);
  const isNegative = rawLineTotal < 0;
  const quantity = rawQuantity > 0 ? rawQuantity : 1;
  const signedQuantity = isNegative ? -Math.abs(quantity) : Math.abs(quantity);
  const unitPrice = Math.abs(roundMoney(item?.unitPrice ?? (quantity ? rawLineTotal / signedQuantity : rawLineTotal)));
  const lineTotal = roundMoney(rawLineTotal);

  return {
    id: String(index + 1),
    sourceId: normalizeString(item?.merchandiseId) || `line-${index + 1}`,
    name: normalizeString(item?.name) || `Line ${index + 1}`,
    description: normalizeString(item?.reference || item?.comment || item?.category),
    category: normalizeString(item?.category),
    quantity: signedQuantity,
    unitCode: normalizeString(item?.unitCode) || DEFAULT_UNIT_CODE,
    unitPrice,
    lineTotal,
    vatCategory: normalizeString(item?.vatCategory) || (Number(item?.vatRate) > 0 ? 'S' : DEFAULT_VAT_CATEGORY),
    vatRate: Number.isFinite(Number(item?.vatRate)) ? Number(item?.vatRate) : DEFAULT_VAT_RATE,
    vatExemptionReason: normalizeString(item?.vatExemptionReason) || (Number(item?.vatRate) > 0 ? '' : DEFAULT_VAT_EXEMPTION_REASON),
    kind: normalizeString(item?.kind)
  };
}

function buildVatBreakdowns(lines) {
  const groups = new Map();
  for (const line of lines) {
    const key = `${line.vatCategory}:${line.vatRate}`;
    const existing = groups.get(key) ?? {
      category: line.vatCategory,
      rate: line.vatRate,
      taxableAmount: 0,
      taxAmount: 0,
      exemptionReason: line.vatExemptionReason
    };
    existing.taxableAmount = roundMoney(existing.taxableAmount + line.lineTotal);
    existing.taxAmount = roundMoney(existing.taxAmount + (line.lineTotal * line.vatRate) / 100);
    groups.set(key, existing);
  }
  return [...groups.values()];
}

export function normalizeBillToFacturXData({ role, title, billIdentifier, bill, vendor, client }) {
  const details = [];
  const issueDate = formatDate102(bill?.orderedAt ?? bill?.deliveryDate ?? bill?.day);
  const deliveryDate = formatDate102(bill?.deliveryDate ?? bill?.day);
  if (!issueDate) {
    details.push('Bill issue date is required.');
  }

  const seller = normalizeParty(vendor, 'Seller', details);
  const buyer = normalizeParty(client, 'Buyer', details);
  const sourceItems = Array.isArray(bill?.items) ? bill.items : [];
  if (sourceItems.length === 0) {
    details.push('At least one bill line is required.');
  }
  const lines = sourceItems.map(normalizeLine);
  const lineNetAmount = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const vatBreakdowns = buildVatBreakdowns(lines);
  const taxTotalAmount = roundMoney(vatBreakdowns.reduce((sum, vat) => sum + vat.taxAmount, 0));
  const taxBasisAmount = lineNetAmount;
  const grandTotalAmount = roundMoney(taxBasisAmount + taxTotalAmount);
  const amountDue = roundMoney(Number.isFinite(Number(bill?.totalPriceIncludingVat)) ? Number(bill.totalPriceIncludingVat) : grandTotalAmount);

  if (roundMoney(amountDue - grandTotalAmount) !== 0) {
    details.push('Bill total does not reconcile with normalized line and VAT totals.');
  }

  if (!normalizeString(billIdentifier)) {
    details.push('Stable bill identifier is required.');
  }

  if (details.length > 0) {
    throw new FacturXGenerationError('The bill is missing data required for a Factur-X download.', {
      statusCode: 422,
      errorCode: 'missing_invoice_data',
      details
    });
  }

  return {
    profile: FACTUR_X_CONFORMANCE_LEVEL,
    profileId: FACTUR_X_PROFILE_ID,
    documentType: FACTUR_X_DOCUMENT_TYPE,
    invoiceId: normalizeString(billIdentifier),
    issueDate,
    typeCode: '380',
    currency: normalizeString(bill?.currency) || DEFAULT_CURRENCY,
    title: normalizeString(title) || 'Bill',
    role: normalizeString(role),
    billKey: normalizeString(bill?.key),
    includedNotes: [seller.billMentions].filter(Boolean),
    deliveryDate,
    seller,
    buyer,
    lines,
    vatBreakdowns,
    totals: {
      lineNetAmount,
      allowanceTotalAmount: 0,
      chargeTotalAmount: 0,
      taxBasisAmount,
      taxTotalAmount,
      grandTotalAmount,
      prepaidAmount: 0,
      roundingAmount: 0,
      amountDue
    }
  };
}
