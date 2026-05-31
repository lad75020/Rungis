import type { PageName } from './app.types';
import { SUPPORTED_PAGES } from './app.constants';

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
  return SUPPORTED_PAGES.has(value as PageName) ? (value as PageName) : 'login';
}
