import {
  getAppSettingValueNumber,
  getAppSettingValueString,
  setAppSettingValueNumber,
  setAppSettingValueString
} from '../../lib/app-settings-store.js';

export const RUNGIS_FEE_RATE_SETTING_KEY = 'rungisFeeRate';
export const RUNGIS_VAT_RATE_SETTING_KEY = 'rungisVatRate';
export const RUNGIS_PROCESSED_MONTHS_SETTING_KEY = 'rungisProcessedMonths';

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
    monthKey: formatRungisMonth(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1),
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
    monthKey: formatRungisMonth(applicableYear, applicableMonth),
    periodStart: new Date(Date.UTC(applicableYear, applicableMonth - 1, 1)),
    periodEnd: new Date(Date.UTC(applicableYear, applicableMonth, 1))
  };
}

function normalizeProcessedMonthList(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  let parsed = [];
  try {
    const decoded = JSON.parse(value);
    parsed = Array.isArray(decoded) ? decoded : [];
  } catch {
    parsed = value.split(',');
  }
  return [...new Set(parsed
    .map((month) => parseRungisMonth(String(month ?? '').trim())?.monthKey)
    .filter(Boolean))].sort();
}

export function getProcessedRungisBillMonths() {
  return normalizeProcessedMonthList(getAppSettingValueString(RUNGIS_PROCESSED_MONTHS_SETTING_KEY));
}

export function hasProcessedRungisBillMonth(month) {
  const parsed = parseRungisMonth(month);
  return Boolean(parsed && getProcessedRungisBillMonths().includes(parsed.monthKey));
}

export function persistProcessedRungisBillMonth(month) {
  const parsed = parseRungisMonth(month);
  if (!parsed) {
    return null;
  }
  const months = getProcessedRungisBillMonths();
  if (!months.includes(parsed.monthKey)) {
    months.push(parsed.monthKey);
    months.sort();
    setAppSettingValueString(RUNGIS_PROCESSED_MONTHS_SETTING_KEY, JSON.stringify(months));
  }
  return months;
}

export function getRungisBillingSettings() {
  const rungisFeeRate = normalizePercentage(getAppSettingValueNumber(RUNGIS_FEE_RATE_SETTING_KEY));
  const vatRate = normalizePercentage(getAppSettingValueNumber(RUNGIS_VAT_RATE_SETTING_KEY));
  return {
    rungisFeeRate,
    vatRate,
    configured: rungisFeeRate !== null && vatRate !== null,
    processedMonths: getProcessedRungisBillMonths()
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
  return { rungisFeeRate, vatRate, configured: true, processedMonths: getProcessedRungisBillMonths() };
}
