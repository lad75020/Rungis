import type { PageName } from './app.types';

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);

export function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function getRelativeIsoDay(offsetDays: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0, 10);
}

export function isSupportedImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.has(file.type);
}

export function normalizePageName(value: string): PageName {
  if (
    value === 'subscribe' ||
    value === 'dashboard' ||
    value === 'admin' ||
    value === 'statistics' ||
    value === 'vendor-statistics' ||
    value === 'vendor-monthly-summary' ||
    value === 'vendor-overdue-bills' ||
    value === 'vendor-refunds' ||
    value === 'find-vendors' ||
    value === 'stocks' ||
    value === 'order' ||
    value === 'account'
  ) {
    return value;
  }

  return 'login';
}
