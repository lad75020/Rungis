import type { CartData, LanguageCode, PageName, SignupRole } from './app.types';

export const ACTIVATED_ORDERS_STATS_PAGE_SIZE = 10;

export const AVAILABLE_LANGUAGES: LanguageCode[] = ['en', 'fr'];

export const SIGNUP_ROLES: SignupRole[] = ['vendor', 'client'];

export const SUPPORTED_PAGES = new Set<PageName>([
  'login',
  'subscribe',
  'dashboard',
  'admin',
  'statistics',
  'vendor-statistics',
  'vendor-monthly-summary',
  'vendor-overdue-bills',
  'vendor-refunds',
  'find-vendors',
  'stocks',
  'order',
  'account'
]);

export const EMPTY_CART: CartData = {
  clientId: '',
  deliveryDate: '',
  items: [],
  grandTotal: 0,
  grandTotalIncludingVat: 0,
  currency: 'EUR'
};
