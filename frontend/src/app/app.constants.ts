import type { CartData, LanguageCode, SignupRole } from './app.types';

export const ACTIVATED_ORDERS_STATS_PAGE_SIZE = 10;

export const AVAILABLE_LANGUAGES: LanguageCode[] = ['en', 'fr'];

export const SIGNUP_ROLES: SignupRole[] = ['vendor', 'client'];

export const EMPTY_CART: CartData = {
  clientId: '',
  deliveryDate: '',
  items: [],
  grandTotal: 0,
  currency: 'EUR'
};
