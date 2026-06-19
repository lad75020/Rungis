export const DEFAULT_VAT_RATE = 0;

export function normalizeVatRate(value, fallback = DEFAULT_VAT_RATE) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.round(numeric * 100) / 100;
}

export function roundMoney(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

export function calculatePriceIncludingVat(netPrice, vatRate) {
  const normalizedNetPrice = roundMoney(netPrice);
  const normalizedVatRate = normalizeVatRate(vatRate);
  return roundMoney(normalizedNetPrice * (1 + normalizedVatRate / 100));
}

export function calculateVatAmount(netAmount, vatRate) {
  return roundMoney(roundMoney(netAmount) * (normalizeVatRate(vatRate) / 100));
}

export function calculateLineTotalIncludingVat(lineTotal, vatRate) {
  return roundMoney(roundMoney(lineTotal) + calculateVatAmount(lineTotal, vatRate));
}

export function getVatCategory(vatRate) {
  return normalizeVatRate(vatRate) > 0 ? 'S' : 'O';
}

export function getVatExemptionReason(vatRate) {
  return normalizeVatRate(vatRate) > 0 ? '' : 'Outside scope of VAT';
}
