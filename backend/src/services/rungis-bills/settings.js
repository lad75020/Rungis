import {
  getAppSettingValueNumber,
  setAppSettingValueNumber
} from '../../lib/app-settings-store.js';

export const RUNGIS_FEE_RATE_SETTING_KEY = 'rungisFeeRate';
export const RUNGIS_VAT_RATE_SETTING_KEY = 'rungisVatRate';

export function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function normalizePercentage(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    return null;
  }
  return roundMoney(number);
}

export function calculatePercentageAmount(amount, rate) {
  return roundMoney((Number(amount) * Number(rate)) / 100);
}

export function getPreviousUtcCalendarMonth(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const monthIndex = referenceDate.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, monthIndex - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthIndex, 1));
  return {
    applicableYear: periodStart.getUTCFullYear(),
    applicableMonth: periodStart.getUTCMonth() + 1,
    periodStart,
    periodEnd
  };
}

export function formatRungisMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseRungisMonth(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const applicableYear = Number(match[1]);
  const applicableMonth = Number(match[2]);
  if (!Number.isInteger(applicableYear) || applicableMonth < 1 || applicableMonth > 12) {
    return null;
  }
  return {
    applicableYear,
    applicableMonth,
    periodStart: new Date(Date.UTC(applicableYear, applicableMonth - 1, 1)),
    periodEnd: new Date(Date.UTC(applicableYear, applicableMonth, 1))
  };
}

export function getRungisBillingSettings() {
  const rungisFeeRate = normalizePercentage(getAppSettingValueNumber(RUNGIS_FEE_RATE_SETTING_KEY));
  const vatRate = normalizePercentage(getAppSettingValueNumber(RUNGIS_VAT_RATE_SETTING_KEY));
  return {
    rungisFeeRate,
    vatRate,
    configured: rungisFeeRate !== null && vatRate !== null
  };
}

export function setRungisBillingSettings(input) {
  const rungisFeeRate = normalizePercentage(input?.rungisFeeRate);
  const vatRate = normalizePercentage(input?.vatRate);
  if (rungisFeeRate === null || vatRate === null) {
    return null;
  }
  setAppSettingValueNumber(RUNGIS_FEE_RATE_SETTING_KEY, rungisFeeRate);
  setAppSettingValueNumber(RUNGIS_VAT_RATE_SETTING_KEY, vatRate);
  return { rungisFeeRate, vatRate, configured: true };
}
