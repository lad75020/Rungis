import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { Merchandise } from '../models/merchandise.model.js';
import { User } from '../models/user.model.js';
import { ValidatedOrder } from '../models/validated-order.model.js';
import { Bill } from '../models/bill.model.js';
import { RungisBill } from '../models/rungis-bill.model.js';
import { Refund } from '../models/refund.model.js';
import {
  getAppSettingValueNumber,
  getAppSettingValueString,
  setAppSettingValueNumber,
  setAppSettingValueString
} from '../lib/app-settings-store.js';
import { registerAuthRoutes } from './modules/auth.js';
import { registerBillRoutes } from './modules/bills.js';
import { registerRungisBillRoutes } from './modules/rungis-bills.js';
import { registerManagementRoutes } from './modules/management.js';
import { registerPageRoutes } from './modules/pages.js';
import { registerRefundRoutes } from './modules/refunds.js';
import { registerWebsocketRoutes } from './modules/websocket.js';
import { sendFacturXBill } from '../services/factur-x/generator.js';
import {
  generateRungisBillsForPreviousMonth,
  markRungisBillPaid,
  searchUnpaidRungisBills
} from '../services/rungis-bills/generation.js';
import {
  getRungisBillingSettings,
  setRungisBillingSettings
} from '../services/rungis-bills/settings.js';
import {
  calculateLineTotalIncludingVat,
  calculatePriceIncludingVat,
  normalizeVatRate
} from '../utils/vat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const itemImagesDir = path.join(__dirname, '..', 'public', 'uploads', 'items');
const userLogosDir = path.join(__dirname, '..', 'public', 'uploads', 'logos');
const BILL_OVERDUE_DAYS_SETTING_KEY = 'billOverdueDays';
const APP_STYLE_PROFILE_SETTING_KEY = 'appStyleProfile';
const APP_STYLE_PROFILE_PRIMARY = 'primary';
const APP_STYLE_PROFILE_SECONDARY = 'secondary';
const DEFAULT_BILL_OVERDUE_DAYS = 30;
const REFUND_COMMENT_MAX_LENGTH = 32;
const BILL_PENALTY_MIN_PERCENT = 1;
const BILL_PENALTY_MAX_PERCENT = 50;

const allowedImageMimeTypes = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpeg', 'jpeg'],
  ['image/gif', 'gif']
]);

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function hasDangerousInputKeys(value, seen = new Set()) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (hasDangerousInputKeys(entry, seen)) {
        return true;
      }
    }
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      key.startsWith('$') ||
      key.includes('.') ||
      key === '__proto__' ||
      key === 'prototype' ||
      key === 'constructor'
    ) {
      return true;
    }

    if (hasDangerousInputKeys(nestedValue, seen)) {
      return true;
    }
  }

  return false;
}

function getRequestHostname(request) {
  const direct = normalizeString(request.hostname).toLowerCase();
  if (direct) {
    return direct;
  }

  const rawHost = normalizeString(request.headers?.host).toLowerCase();
  if (!rawHost) {
    return '';
  }

  if (rawHost.startsWith('[')) {
    const closingIndex = rawHost.indexOf(']');
    if (closingIndex > 0) {
      return rawHost.slice(1, closingIndex);
    }
  }

  const hostWithoutPort = rawHost.split(':')[0];
  return normalizeString(hostWithoutPort);
}

function getWebAuthnRpId(request) {
  const configured = normalizeString(process.env.WEBAUTHN_RP_ID).toLowerCase();
  if (configured) {
    return configured;
  }

  return getRequestHostname(request) || 'localhost';
}

function getWebAuthnExpectedOrigins(request) {
  const configured = normalizeString(process.env.WEBAUTHN_ORIGIN);
  if (configured) {
    const origins = configured
      .split(',')
      .map((origin) => normalizeString(origin))
      .filter(Boolean);
    if (origins.length > 0) {
      return origins;
    }
  }

  const forwardedProto = normalizeString(request.headers?.['x-forwarded-proto']);
  const protocol = normalizeString(request.protocol) || forwardedProto.split(',')[0] || 'http';
  const hostHeader = normalizeString(request.headers?.host);
  const hostname = getRequestHostname(request);
  const host = hostHeader || hostname;
  const fallbackOrigin = `${protocol}://${host}`;

  return [fallbackOrigin];
}

function getWebAuthnRpName() {
  return normalizeString(process.env.WEBAUTHN_RP_NAME) || 'Rungis Portal';
}

function isWebAuthnUserVerificationRequired() {
  const raw = normalizeString(process.env.WEBAUTHN_REQUIRE_USER_VERIFICATION).toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function getErrorMessage(error, fallback = 'Unknown error') {
  if (error instanceof Error) {
    const message = normalizeString(error.message);
    return message || fallback;
  }

  if (typeof error === 'string') {
    const message = normalizeString(error);
    return message || fallback;
  }

  return fallback;
}

function mapStoredPasskeyToCredential(passkey) {
  if (!passkey?.id || !passkey?.publicKey) {
    return null;
  }

  return {
    id: passkey.id,
    publicKey: Buffer.from(passkey.publicKey, 'base64url'),
    counter: Number(passkey.counter ?? 0),
    transports: Array.isArray(passkey.transports) && passkey.transports.length > 0 ? passkey.transports : undefined
  };
}

function getUserPasskeys(user) {
  if (!Array.isArray(user?.passkeys)) {
    return [];
  }

  return user.passkeys.filter((passkey) => normalizeString(passkey?.id) && normalizeString(passkey?.publicKey));
}

function mapAccessKeySummary(passkey) {
  const credentialId = normalizeString(passkey?.id);
  return {
    id: credentialId,
    name: normalizeString(passkey?.name) || 'Unknown device',
    keyId: credentialId.slice(0, 8),
    deviceType: normalizeString(passkey?.deviceType) || 'singleDevice',
    backedUp: Boolean(passkey?.backedUp),
    createdAt: passkey?.createdAt ?? null,
    lastUsedAt: passkey?.lastUsedAt ?? null
  };
}

function summarizeUserAgent(userAgent) {
  const ua = normalizeString(userAgent);
  if (!ua) {
    return 'Unknown device';
  }

  const lower = ua.toLowerCase();

  let browser = 'Unknown browser';
  if (lower.includes('edg/')) {
    browser = 'Edge';
  } else if (lower.includes('opr/') || lower.includes('opera')) {
    browser = 'Opera';
  } else if (lower.includes('firefox/')) {
    browser = 'Firefox';
  } else if (lower.includes('chrome/') && !lower.includes('chromium')) {
    browser = 'Chrome';
  } else if (lower.includes('safari/') && !lower.includes('chrome/')) {
    browser = 'Safari';
  }

  let os = 'Unknown OS';
  if (lower.includes('windows')) {
    os = 'Windows';
  } else if (lower.includes('android')) {
    os = 'Android';
  } else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) {
    os = 'iOS';
  } else if (lower.includes('mac os') || lower.includes('macintosh')) {
    os = 'macOS';
  } else if (lower.includes('linux')) {
    os = 'Linux';
  }

  const isMobile = lower.includes('mobile') || lower.includes('android') || lower.includes('iphone') || lower.includes('ipad');
  return `${browser} on ${os}${isMobile ? ' (mobile)' : ''}`;
}

function buildUniqueAccessKeyName(passkeys, baseName) {
  const normalizedBaseName = normalizeString(baseName) || 'Unknown device';
  const existingNames = new Set(
    (Array.isArray(passkeys) ? passkeys : [])
      .map((passkey) => normalizeString(passkey?.name).toLowerCase())
      .filter(Boolean)
  );

  if (!existingNames.has(normalizedBaseName.toLowerCase())) {
    return normalizedBaseName;
  }

  let index = 2;
  while (existingNames.has(`${normalizedBaseName} (${index})`.toLowerCase())) {
    index += 1;
  }

  return `${normalizedBaseName} (${index})`;
}

const PAGE_RATE_LIMIT_MAX_REQUESTS = 10;
const PAGE_RATE_LIMIT_WINDOW_MS = 60_000;
const pageRequestTimestampsByIp = new Map();

const LOGIN_ATTEMPT_MAX = 3;
const LOGIN_ATTEMPT_WINDOW_MS = 60_000;
const LOGIN_COOLDOWN_MS = 10 * 60_000;
const loginAttemptsByIpAndUsername = new Map();

function pruneTimestamps(timestamps, now, windowMs) {
  return timestamps.filter((timestamp) => now - timestamp < windowMs);
}

async function requirePageRateLimit(request, reply) {
  const now = Date.now();
  const ip = normalizeString(request.ip) || 'unknown';
  const timestamps = pruneTimestamps(pageRequestTimestampsByIp.get(ip) ?? [], now, PAGE_RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= PAGE_RATE_LIMIT_MAX_REQUESTS) {
    return reply
      .code(429)
      .type('text/plain; charset=utf-8')
      .send('Too many page requests. Retry in one minute.');
  }

  timestamps.push(now);
  pageRequestTimestampsByIp.set(ip, timestamps);
}

function buildLoginAttemptKey(request, _username) {
  const ip = normalizeString(request.ip) || 'unknown';
  return ip;
}

function getLoginAttemptState(key, now) {
  const state = loginAttemptsByIpAndUsername.get(key);
  if (!state) {
    return { attempts: [], cooldownUntil: 0 };
  }

  const attempts = pruneTimestamps(state.attempts ?? [], now, LOGIN_ATTEMPT_WINDOW_MS);
  const cooldownUntil = state.cooldownUntil ?? 0;
  if (attempts.length === 0 && cooldownUntil <= now) {
    loginAttemptsByIpAndUsername.delete(key);
    return { attempts: [], cooldownUntil: 0 };
  }

  const normalizedState = { attempts, cooldownUntil };
  loginAttemptsByIpAndUsername.set(key, normalizedState);
  return normalizedState;
}

function getLoginCooldownRemainingMs(key, now) {
  const state = getLoginAttemptState(key, now);
  if (state.cooldownUntil > now) {
    return state.cooldownUntil - now;
  }

  return 0;
}

function registerFailedLoginAttempt(key, now) {
  const state = getLoginAttemptState(key, now);
  const attempts = [...state.attempts, now];

  if (attempts.length >= LOGIN_ATTEMPT_MAX) {
    const nextState = {
      attempts: [],
      cooldownUntil: now + LOGIN_COOLDOWN_MS
    };
    loginAttemptsByIpAndUsername.set(key, nextState);
    return { cooldownUntil: nextState.cooldownUntil };
  }

  loginAttemptsByIpAndUsername.set(key, {
    attempts,
    cooldownUntil: state.cooldownUntil
  });
  return { cooldownUntil: state.cooldownUntil };
}

function clearLoginAttempts(key) {
  loginAttemptsByIpAndUsername.delete(key);
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function parseSiretValue(value) {
  const normalized = normalizeString(value);
  if (!/^\d{13}$/.test(normalized)) {
    return { ok: false, message: 'SIRET must be a mandatory 13-digit integer.' };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    return { ok: false, message: 'SIRET must be a mandatory 13-digit integer.' };
  }

  return { ok: true, value: parsed };
}

function getRequestLanguage(request) {
  const requestedLanguage = normalizeString(request.cookies?.lang).toLowerCase();
  return requestedLanguage === 'fr' ? 'fr' : 'en';
}

function getTranslationText(translations, language, key, fallback) {
  const primary = translations?.[language]?.[key];
  if (typeof primary === 'string' && primary.length > 0) {
    return primary;
  }

  const englishFallback = translations?.en?.[key];
  if (typeof englishFallback === 'string' && englishFallback.length > 0) {
    return englishFallback;
  }

  return fallback;
}

async function buildPagePayload(request, pageName) {
  const assets = await request.server.getAngularAssets();
  const translations = await request.server.getTranslations();
  const language = getRequestLanguage(request);
  const appStyleProfile = await getAppStyleProfileSetting();

  return {
    page: pageName,
    language,
    translations,
    appStyleProfile,
    wsToken: request.server.issueWsToken(request, pageName),
    sessionUser: request.session.user ?? null,
    assets: {
      ...assets,
      stylesCss: appStyleProfile === APP_STYLE_PROFILE_SECONDARY
        ? assets.secondaryStylesCss ?? assets.primaryStylesCss
        : assets.primaryStylesCss
    }
  };
}

function redirectForSessionUser(sessionUser) {
  if (!sessionUser) {
    return '/login';
  }

  return sessionUser.role === 'admin' ? '/admin' : '/dashboard';
}

async function requireAuth(request, reply) {
  if (!request.session.user) {
    return reply.redirect('/login');
  }
}

async function requireAdminPage(request, reply) {
  if (!request.session.user) {
    return reply.redirect('/login');
  }

  if (request.session.user.role !== 'admin') {
    return reply.redirect('/dashboard');
  }
}

async function requireAdminApi(request, reply) {
  if (!request.session.user) {
    return reply.code(401).send({ ok: false, message: 'Authentication required.' });
  }

  if (request.session.user.role !== 'admin') {
    return reply.code(403).send({ ok: false, message: 'Admin role required.' });
  }
}

async function requireVendorApi(request, reply) {
  if (!request.session.user) {
    return reply.code(401).send({ ok: false, message: 'Authentication required.' });
  }

  if (request.session.user.role !== 'vendor') {
    return reply.code(403).send({ ok: false, message: 'Vendor role required.' });
  }
}

async function requireClientApi(request, reply) {
  if (!request.session.user) {
    return reply.code(401).send({ ok: false, message: 'Authentication required.' });
  }

  if (request.session.user.role !== 'client') {
    return reply.code(403).send({ ok: false, message: 'Client role required.' });
  }
}

async function requireRungisBillUserApi(request, reply) {
  if (!request.session.user) {
    return reply.code(401).send({ ok: false, message: 'Authentication required.' });
  }

  if (!['vendor', 'client'].includes(request.session.user.role)) {
    return reply.code(403).send({ ok: false, message: 'Vendor or client role required.' });
  }
}

async function requireVendorPage(request, reply) {
  if (!request.session.user) {
    return reply.redirect('/login');
  }

  if (request.session.user.role !== 'vendor') {
    return reply.redirect(redirectForSessionUser(request.session.user));
  }
}

async function requireClientPage(request, reply) {
  if (!request.session.user) {
    return reply.redirect('/login');
  }

  if (request.session.user.role !== 'client') {
    return reply.redirect(redirectForSessionUser(request.session.user));
  }
}

function sanitizeStockPayload(payload) {
  const rawMinimumStockThreshold = payload?.minimumStockThreshold;
  const minimumStockThreshold =
    rawMinimumStockThreshold === '' || rawMinimumStockThreshold === null || rawMinimumStockThreshold === undefined
      ? null
      : Number(rawMinimumStockThreshold);
  const vatRate = normalizeVatRate(payload?.vatRate);

  return {
    id: normalizeString(payload?.id),
    name: normalizeString(payload?.name),
    reference: normalizeString(payload?.reference).toUpperCase(),
    category: normalizeString(payload?.category),
    imageFilename: normalizeString(payload?.imageFilename),
    price: Number(payload?.price),
    vatRate,
    stock: Number(payload?.stock),
    minimumStockThreshold
  };
}

function getMerchandiseImageUrl(imageFilename) {
  const normalized = normalizeString(imageFilename);
  if (!normalized) {
    return '';
  }

  return `/public/uploads/items/${normalized}`;
}

function getUserLogoUrl(logoFilename) {
  const normalized = normalizeString(logoFilename);
  if (!normalized) {
    return '';
  }

  return `/public/uploads/logos/${normalized}`;
}

function getUserLogoAbsolutePath(logoFilename) {
  const normalized = normalizeString(logoFilename);
  if (!normalized) {
    return '';
  }

  return path.join(userLogosDir, path.basename(normalized));
}

function mapSessionUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    organisation: user.organisation,
    city: user.city,
    zipcode: user.zipcode,
    email: user.email,
    physicalAddress: user.physicalAddress,
    phoneNumber: user.phoneNumber,
    businessDescription: normalizeString(user.businessDescription),
    vatId: normalizeString(user.vatId),
    billMentions: normalizeString(user.billMentions),
    logoFilename: normalizeString(user.logoFilename),
    logoUrl: getUserLogoUrl(user.logoFilename),
    businessRegistrationId: user.businessRegistrationId,
    isActive: user.isActive
  };
}

function mapPendingUser(user) {
  return {
    id: user._id.toString(),
    role: user.role,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    organisation: user.organisation,
    city: user.city,
    zipcode: user.zipcode,
    email: user.email,
    physicalAddress: user.physicalAddress,
    phoneNumber: user.phoneNumber,
    businessRegistrationId: user.businessRegistrationId,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

function mapMerchandise(merchandise) {
  const minimumStockThreshold =
    Number.isInteger(merchandise.minimumStockThreshold) && merchandise.minimumStockThreshold >= 0
      ? merchandise.minimumStockThreshold
      : null;
  const vatRate = normalizeVatRate(merchandise.vatRate);

  return {
    id: merchandise._id.toString(),
    name: merchandise.name,
    reference: merchandise.reference,
    price: merchandise.price,
    vatRate,
    priceIncludingVat: calculatePriceIncludingVat(merchandise.price, vatRate),
    stock: merchandise.stock,
    minimumStockThreshold,
    category: merchandise.category,
    imageFilename: normalizeString(merchandise.imageFilename),
    imageUrl: getMerchandiseImageUrl(merchandise.imageFilename),
    vendorId: merchandise.vendorId.toString(),
    createdAt: merchandise.createdAt,
    updatedAt: merchandise.updatedAt
  };
}

function mapOrderCatalogItem(merchandise, vendorName) {
  const minimumStockThreshold =
    Number.isInteger(merchandise.minimumStockThreshold) && merchandise.minimumStockThreshold >= 0
      ? merchandise.minimumStockThreshold
      : null;
  const vatRate = normalizeVatRate(merchandise.vatRate);

  return {
    id: merchandise._id.toString(),
    name: merchandise.name,
    reference: merchandise.reference,
    price: merchandise.price,
    vatRate,
    priceIncludingVat: calculatePriceIncludingVat(merchandise.price, vatRate),
    stock: merchandise.stock,
    minimumStockThreshold,
    category: merchandise.category,
    imageFilename: normalizeString(merchandise.imageFilename),
    imageUrl: getMerchandiseImageUrl(merchandise.imageFilename),
    vendorId: merchandise.vendorId.toString(),
    vendorName
  };
}

function parseImageUploadDataUrl(value) {
  const dataUrl = normalizeString(value);
  const match = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return { ok: false, message: 'Only PNG, GIF and JPEG images are allowed.' };
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = allowedImageMimeTypes.get(mimeType);
  if (!extension) {
    return { ok: false, message: 'Only PNG, GIF and JPEG images are allowed.' };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, message: 'Invalid image payload.' };
  }

  if (!buffer || buffer.length === 0) {
    return { ok: false, message: 'Image payload cannot be empty.' };
  }

  if (buffer.length > 5 * 1024 * 1024) {
    return { ok: false, message: 'Image payload is too large.' };
  }

  return { ok: true, extension, buffer };
}

function roundToTwoDecimals(value) {
  return Number(value.toFixed(2));
}

function normalizeRefundAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const cents = Math.round(numeric * 100);
  if (Math.abs(numeric - cents / 100) > 1e-9) {
    return null;
  }

  return roundToTwoDecimals(cents / 100);
}

function mapRefundToBillLine(refund) {
  const refundId = normalizeString(refund?._id?.toString?.() ?? refund?.refundId?.toString?.());
  const comment = normalizeString(refund?.comment);
  const absoluteAmount = Math.abs(roundToTwoDecimals(Number(refund?.amount ?? refund?.lineTotal ?? 0)));
  const negativeAmount = roundToTwoDecimals(-absoluteAmount);

  return {
    kind: 'refund',
    refundId,
    merchandiseId: refundId || `refund:${comment || 'adjustment'}`,
    name: 'Refund',
    reference: comment,
    category: 'Refund',
    unitPrice: negativeAmount,
    vatRate: normalizeVatRate(refund?.vatRate),
    unitPriceIncludingVat: negativeAmount,
    quantity: null,
    lineTotal: negativeAmount,
    lineTotalIncludingVat: negativeAmount,
    vatCategory: 'O',
    vatExemptionReason: 'Outside scope of VAT',
    comment,
    createdAt: refund?.createdAt ?? null
  };
}

function getRefundLineTotal(refundLines) {
  return roundToTwoDecimals(
    (Array.isArray(refundLines) ? refundLines : []).reduce(
      (sum, refundLine) => sum + Number(refundLine?.lineTotal ?? 0),
      0
    )
  );
}

function getBillLineTotalIncludingVat(lines) {
  return roundToTwoDecimals(
    (Array.isArray(lines) ? lines : []).reduce(
      (sum, line) => sum + Number(line?.lineTotalIncludingVat ?? line?.lineTotal ?? 0),
      0
    )
  );
}

function normalizeBillPenaltyPercentage(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < BILL_PENALTY_MIN_PERCENT || numeric > BILL_PENALTY_MAX_PERCENT) {
    return null;
  }

  return numeric;
}

function mapPenaltyToBillLine(penaltyLine) {
  const id = normalizeString(penaltyLine?.id);
  const percentage = normalizeBillPenaltyPercentage(penaltyLine?.percentage);
  const amount = roundToTwoDecimals(Number(penaltyLine?.lineTotal ?? penaltyLine?.unitPrice ?? 0));

  return {
    kind: 'penalty',
    merchandiseId: id || `penalty:${percentage ?? 'custom'}:${penaltyLine?.createdAt ?? ''}`,
    name: 'Late payment penalty',
    reference: percentage ? `${percentage}%` : '',
    category: 'Penalty',
    unitPrice: amount,
    vatRate: normalizeVatRate(penaltyLine?.vatRate),
    unitPriceIncludingVat: amount,
    quantity: null,
    lineTotal: amount,
    lineTotalIncludingVat: amount,
    vatCategory: 'O',
    vatExemptionReason: 'Outside scope of VAT',
    percentage,
    createdAt: penaltyLine?.createdAt ?? null
  };
}

function getPenaltyLineTotal(penaltyLines) {
  return roundToTwoDecimals(
    (Array.isArray(penaltyLines) ? penaltyLines : []).reduce(
      (sum, penaltyLine) => sum + Number(penaltyLine?.lineTotal ?? 0),
      0
    )
  );
}

function normalizeBillOverdueDays(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    return null;
  }

  return parsed;
}

async function getBillOverdueDaysSetting() {
  const normalized = normalizeBillOverdueDays(getAppSettingValueNumber(BILL_OVERDUE_DAYS_SETTING_KEY));
  return normalized ?? DEFAULT_BILL_OVERDUE_DAYS;
}

function normalizeAppStyleProfile(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === APP_STYLE_PROFILE_PRIMARY || normalized === APP_STYLE_PROFILE_SECONDARY) {
    return normalized;
  }

  return null;
}

async function getAppStyleProfileSetting() {
  return normalizeAppStyleProfile(getAppSettingValueString(APP_STYLE_PROFILE_SETTING_KEY)) ?? APP_STYLE_PROFILE_PRIMARY;
}

function setBillOverdueDaysSetting(value) {
  setAppSettingValueNumber(BILL_OVERDUE_DAYS_SETTING_KEY, value);
}

function setAppStyleProfileSetting(value) {
  setAppSettingValueString(APP_STYLE_PROFILE_SETTING_KEY, value);
}

function buildUnpaidReminderKey(clientId, vendorId) {
  const normalizedClientId = normalizeString(clientId);
  const normalizedVendorId = normalizeString(vendorId);
  if (!mongoose.Types.ObjectId.isValid(normalizedClientId) || !mongoose.Types.ObjectId.isValid(normalizedVendorId)) {
    throw new Error('Invalid client or vendor id.');
  }

  return `unpaid-reminder:${normalizedClientId}:${normalizedVendorId}`;
}

function buildUnpaidReminderClientIndexKey(clientId) {
  const normalizedClientId = normalizeString(clientId);
  if (!mongoose.Types.ObjectId.isValid(normalizedClientId)) {
    throw new Error('Invalid client id.');
  }

  return `unpaid-reminder-client-index:${normalizedClientId}`;
}

async function upsertUnpaidReminder(redisClient, { clientId, vendorId, vendorName, totalAmount, currency }) {
  const reminderKey = buildUnpaidReminderKey(clientId, vendorId);
  const clientIndexKey = buildUnpaidReminderClientIndexKey(clientId);
  const payload = JSON.stringify({
    clientId: normalizeString(clientId),
    vendorId: normalizeString(vendorId),
    vendorName: normalizeString(vendorName) || normalizeString(vendorId),
    totalAmount: roundToTwoDecimals(Number(totalAmount ?? 0)),
    currency: normalizeString(currency).toUpperCase() || 'EUR',
    createdAt: new Date().toISOString()
  });

  await redisClient.sendCommand(['SET', reminderKey, payload]);
  await redisClient.sendCommand(['SADD', clientIndexKey, normalizeString(vendorId)]);
}

async function removeUnpaidReminder(redisClient, { clientId, vendorId }) {
  const reminderKey = buildUnpaidReminderKey(clientId, vendorId);
  const clientIndexKey = buildUnpaidReminderClientIndexKey(clientId);
  await redisClient.sendCommand(['DEL', reminderKey]);
  await redisClient.sendCommand(['SREM', clientIndexKey, normalizeString(vendorId)]);
}

async function listClientUnpaidReminders(redisClient, clientId) {
  const clientIndexKey = buildUnpaidReminderClientIndexKey(clientId);
  const vendorIdsRaw = await redisClient.sendCommand(['SMEMBERS', clientIndexKey]).catch(() => []);
  const vendorIds = Array.isArray(vendorIdsRaw) ? vendorIdsRaw.map((entry) => normalizeString(entry)).filter(Boolean) : [];
  const reminders = [];

  for (const vendorId of vendorIds) {
    const reminderKey = buildUnpaidReminderKey(clientId, vendorId);
    const raw = await redisClient.sendCommand(['GET', reminderKey]).catch(() => null);
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      reminders.push({
        clientId: normalizeString(parsed?.clientId) || normalizeString(clientId),
        vendorId: normalizeString(parsed?.vendorId) || vendorId,
        vendorName: normalizeString(parsed?.vendorName) || vendorId,
        totalAmount: roundToTwoDecimals(Number(parsed?.totalAmount ?? 0)),
        currency: normalizeString(parsed?.currency).toUpperCase() || 'EUR',
        createdAt: normalizeString(parsed?.createdAt) || new Date().toISOString()
      });
    } catch {
      // Ignore malformed entries and continue.
    }
  }

  return reminders.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function getVendorClientOverdueUnsettledTotal(vendorIdInput, clientIdInput, billOverdueDays) {
  if (!mongoose.Types.ObjectId.isValid(vendorIdInput) || !mongoose.Types.ObjectId.isValid(clientIdInput)) {
    return 0;
  }

  const vendorId = new mongoose.Types.ObjectId(vendorIdInput);
  const clientId = new mongoose.Types.ObjectId(clientIdInput);
  const overdueCutoffDate = new Date();
  overdueCutoffDate.setUTCHours(0, 0, 0, 0);
  overdueCutoffDate.setUTCDate(overdueCutoffDate.getUTCDate() - billOverdueDays);

  const rows = await ValidatedOrder.aggregate([
    {
      $match: {
        clientId,
        deliveryDate: { $lte: overdueCutoffDate },
        'items.vendorId': vendorId
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.vendorId': vendorId } },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$validatedAt',
              timezone: 'UTC'
            }
          }
        },
        totalPrice: { $sum: '$items.lineTotal' }
      }
    }
  ]);

  if (rows.length === 0) {
    return 0;
  }

  const dayValues = rows
    .map((row) => normalizeString(row?._id?.day))
    .filter((value) => parseIsoDayUtc(value));
  const minDay = dayValues.length > 0 ? dayValues.reduce((min, day) => (day < min ? day : min), dayValues[0]) : '';
  const maxDay = dayValues.length > 0 ? dayValues.reduce((max, day) => (day > max ? day : max), dayValues[0]) : '';

  if (!minDay || !maxDay) {
    return 0;
  }

  const billDocs = await Bill.find({
    vendorId,
    clientId,
    date: {
      $gte: parseIsoDayUtc(minDay),
      $lte: parseIsoDayUtc(maxDay)
    }
  })
    .select({ date: 1, vendorSettled: 1, totalPrice: 1 })
    .lean();

  const settledDays = new Set(
    billDocs
      .filter((bill) => Boolean(bill.vendorSettled))
      .map((bill) => new Date(bill.date).toISOString().slice(0, 10))
  );
  const billTotalByDay = new Map(
    billDocs.map((bill) => [new Date(bill.date).toISOString().slice(0, 10), roundToTwoDecimals(Number(bill.totalPrice ?? 0))])
  );

  const total = rows.reduce((sum, row) => {
    const day = normalizeString(row?._id?.day);
    if (!day || settledDays.has(day)) {
      return sum;
    }
    const billTotal = billTotalByDay.get(day);
    return sum + (billTotal ?? Number(row?.totalPrice ?? 0));
  }, 0);

  return roundToTwoDecimals(total);
}

function normalizeIsoDayOrToday(value) {
  const normalized = normalizeString(value);
  if (parseIsoDayUtc(normalized)) {
    return normalized;
  }

  return new Date().toISOString().slice(0, 10);
}

function mapCart(cart, clientId) {
  const items = (cart?.items ?? []).map((item) => {
    const vatRate = normalizeVatRate(item.vatRate);
    const unitPrice = Number(item.unitPrice ?? 0);
    const lineTotal = Number(item.lineTotal ?? 0);

    return {
      merchandiseId: item.merchandiseId.toString(),
      name: item.name,
      reference: item.reference,
      category: item.category,
      vendorId: item.vendorId.toString(),
      vendorName: item.vendorName,
      unitPrice,
      vatRate,
      unitPriceIncludingVat: calculatePriceIncludingVat(unitPrice, vatRate),
      quantity: item.quantity,
      lineTotal,
      lineTotalIncludingVat: calculateLineTotalIncludingVat(lineTotal, vatRate)
    };
  });

  return {
    clientId,
    deliveryDate: normalizeIsoDayOrToday(cart?.deliveryDate),
    items,
    grandTotal: roundToTwoDecimals(items.reduce((sum, item) => sum + item.lineTotal, 0)),
    grandTotalIncludingVat: roundToTwoDecimals(items.reduce((sum, item) => sum + item.lineTotalIncludingVat, 0)),
    currency: 'EUR'
  };
}

const CART_REDIS_TTL_SECONDS = 60 * 60 * 24;
const BILL_CLIENT_COMMENT_MAX_LENGTH = 1000;

function cartRedisKey(clientId, deliveryDate) {
  const normalizedClientId = normalizeString(clientId);
  if (!mongoose.Types.ObjectId.isValid(normalizedClientId)) {
    throw new Error('Invalid client id.');
  }

  const normalizedDeliveryDate = normalizeIsoDayOrToday(deliveryDate);
  return `cart:${normalizedClientId}:${normalizedDeliveryDate}`;
}

function normalizeCartItem(item) {
  const unitPrice = Number(item?.unitPrice);
  const vatRate = normalizeVatRate(item?.vatRate);
  const lineTotal = Number(item?.lineTotal);

  return {
    merchandiseId: normalizeString(item?.merchandiseId),
    name: normalizeString(item?.name),
    reference: normalizeString(item?.reference).toUpperCase(),
    category: normalizeString(item?.category),
    vendorId: normalizeString(item?.vendorId),
    vendorName: normalizeString(item?.vendorName),
    unitPrice,
    vatRate,
    unitPriceIncludingVat: calculatePriceIncludingVat(unitPrice, vatRate),
    quantity: Number(item?.quantity),
    lineTotal,
    lineTotalIncludingVat: calculateLineTotalIncludingVat(lineTotal, vatRate)
  };
}

function normalizeCartDocument(clientId, value) {
  const parsedClientId = normalizeString(clientId);
  const parsedDeliveryDate = normalizeIsoDayOrToday(value?.deliveryDate);
  if (!value || typeof value !== 'object') {
    return { clientId: parsedClientId, deliveryDate: parsedDeliveryDate, items: [] };
  }

  const items = Array.isArray(value.items)
    ? value.items
      .map((item) => normalizeCartItem(item))
      .filter((item) => item.merchandiseId && item.vendorId && item.quantity > 0)
    : [];

  return {
    clientId: parsedClientId,
    deliveryDate: parsedDeliveryDate,
    items
  };
}

async function getRedisCart(redisClient, clientId, deliveryDate) {
  const normalizedDeliveryDate = normalizeIsoDayOrToday(deliveryDate);
  try {
    const raw = await redisClient.sendCommand(['JSON.GET', cartRedisKey(clientId, normalizedDeliveryDate), '$']);
    if (!raw) {
      return { clientId, deliveryDate: normalizedDeliveryDate, items: [] };
    }

    const parsed = JSON.parse(raw);
    const value = Array.isArray(parsed) ? parsed[0] : parsed;
    return normalizeCartDocument(clientId, { ...value, deliveryDate: normalizedDeliveryDate });
  } catch {
    return { clientId, deliveryDate: normalizedDeliveryDate, items: [] };
  }
}

async function saveRedisCart(redisClient, cart) {
  const normalized = normalizeCartDocument(cart.clientId, cart);
  const key = cartRedisKey(normalized.clientId, normalized.deliveryDate);
  await redisClient.sendCommand(['JSON.SET', key, '$', JSON.stringify(normalized)]);
  await redisClient.expire(key, CART_REDIS_TTL_SECONDS);
}

async function clearRedisCart(redisClient, clientId, deliveryDate) {
  await redisClient.del(cartRedisKey(clientId, deliveryDate));
}

async function getClientWithVendors(clientId) {
  return User.findById(clientId)
    .select({ role: 1, vendorIds: 1, favoriteMerchandiseIds: 1 })
    .lean();
}

async function getClientIdsSubscribedToVendor(vendorId) {
  const clients = await User.find({
    role: 'client',
    vendorIds: vendorId
  })
    .select({ _id: 1 })
    .lean();

  return new Set(clients.map((client) => client._id.toString()));
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDayUtc(value) {
  if (!ISO_DAY_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function addUtcDays(date, amount) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted;
}

function formatCompactUtcDay(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeBillPartyUniqueId(value) {
  const normalized = normalizeString(String(value ?? '')).replace(/\D/g, '');
  return normalized || '';
}

export function buildBillUniqueIdFromMap({ billDate, vendorId, clientId, partyUniqueIdById }) {
  const day = formatCompactUtcDay(billDate);
  const vendorUniqueId = partyUniqueIdById.get(vendorId.toString()) || '';
  const clientUniqueId = partyUniqueIdById.get(clientId.toString()) || '';

  if (!day || !vendorUniqueId || !clientUniqueId) {
    throw new Error('Unable to build bill unique id.');
  }

  return `${day}${vendorUniqueId}${clientUniqueId}`;
}

export async function getBillPartyUniqueIdById(userIds) {
  const validIds = [...new Set(
    userIds
      .map((userId) => userId?.toString?.() ?? normalizeString(userId))
      .filter((userId) => mongoose.Types.ObjectId.isValid(userId))
  )];

  if (validIds.length === 0) {
    return new Map();
  }

  const users = await User.find({
    _id: { $in: validIds.map((userId) => new mongoose.Types.ObjectId(userId)) }
  })
    .select({ _id: 1, uniqueId: 1 })
    .lean();

  return new Map(
    users.map((user) => [
      user._id.toString(),
      normalizeBillPartyUniqueId(user.uniqueId)
    ])
  );
}

async function buildBillUniqueId({ day, vendorId, clientId }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error('Invalid bill identity.');
  }

  const partyUniqueIdById = await getBillPartyUniqueIdById([vendorId, clientId]);
  return buildBillUniqueIdFromMap({
    billDate,
    vendorId,
    clientId,
    partyUniqueIdById
  });
}

function formatLocalIsoDay(dateInput = new Date()) {
  const date = new Date(dateInput);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMillisecondsUntilNextDailyRun(nowInput = new Date()) {
  const now = new Date(nowInput);
  const next = new Date(now);
  next.setHours(23, 59, 59, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return Math.max(1000, next.getTime() - now.getTime());
}

async function generateBillsForDay(dayInput) {
  const day = normalizeString(dayInput);
  const dayStart = parseIsoDayUtc(day);
  if (!dayStart) {
    throw new Error('Invalid bill generation day.');
  }

  const dayEnd = addUtcDays(dayStart, 1);
  const orderRows = await ValidatedOrder.aggregate([
    {
      $match: {
        validatedAt: { $gte: dayStart, $lt: dayEnd }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          vendorId: '$items.vendorId',
          clientId: '$clientId'
        },
        totalPrice: { $sum: '$items.lineTotal' },
        totalPriceIncludingVat: { $sum: { $ifNull: ['$items.lineTotalIncludingVat', '$items.lineTotal'] } },
        totalQuantity: { $sum: '$items.quantity' },
        lineCount: { $sum: 1 },
        orderedAt: { $min: '$validatedAt' }
      }
    }
  ]);

  const refunds = await Refund.find({
    $or: [
      { appliedBillDate: dayStart },
      { appliedBillDate: null }
    ]
  })
    .sort({ createdAt: 1, _id: 1 })
    .select({ _id: 1, vendorId: 1, clientId: 1, amount: 1, comment: 1, createdAt: 1 })
    .lean();

  if (orderRows.length === 0 && refunds.length === 0) {
    return { day, upserted: 0 };
  }

  const groups = new Map();
  for (const row of orderRows) {
    const vendorId = row._id.vendorId.toString();
    const clientId = row._id.clientId.toString();
    groups.set(`${vendorId}::${clientId}`, {
      vendorId: row._id.vendorId,
      clientId: row._id.clientId,
      orderedAt: row.orderedAt ?? null,
      orderTotalPrice: roundToTwoDecimals(Number(row.totalPrice ?? 0)),
      orderTotalPriceIncludingVat: roundToTwoDecimals(Number(row.totalPriceIncludingVat ?? row.totalPrice ?? 0)),
      orderTotalQuantity: Number(row.totalQuantity ?? 0),
      orderLineCount: Number(row.lineCount ?? 0),
      refundLines: []
    });
  }

  for (const refund of refunds) {
    const vendorId = refund.vendorId.toString();
    const clientId = refund.clientId.toString();
    const key = `${vendorId}::${clientId}`;
    const existing = groups.get(key) ?? {
      vendorId: refund.vendorId,
      clientId: refund.clientId,
      orderedAt: refund.createdAt ?? null,
      orderTotalPrice: 0,
      orderTotalPriceIncludingVat: 0,
      orderTotalQuantity: 0,
      orderLineCount: 0,
      refundLines: []
    };
    existing.refundLines.push(mapRefundToBillLine(refund));
    if (!existing.orderedAt && refund.createdAt) {
      existing.orderedAt = refund.createdAt;
    }
    groups.set(key, existing);
  }

  const billPartyUniqueIdById = await getBillPartyUniqueIdById(
    [...groups.values()].flatMap((group) => [group.vendorId, group.clientId])
  );

  const operations = [...groups.values()].map((group) => {
    const refundLines = [...group.refundLines];
    const refundTotal = getRefundLineTotal(refundLines);
    const refundTotalIncludingVat = getBillLineTotalIncludingVat(refundLines);
    const billUniqueId = buildBillUniqueIdFromMap({
      billDate: dayStart,
      vendorId: group.vendorId,
      clientId: group.clientId,
      partyUniqueIdById: billPartyUniqueIdById
    });
    return {
    updateOne: {
      filter: {
        date: dayStart,
        vendorId: group.vendorId,
        clientId: group.clientId
      },
      update: {
        $setOnInsert: {
          vendorSettled: false,
          clientSettled: false
        },
        $set: {
          date: dayStart,
          vendorId: group.vendorId,
          clientId: group.clientId,
          uuid: billUniqueId,
          totalPrice: roundToTwoDecimals(group.orderTotalPrice + refundTotal),
          totalPriceIncludingVat: roundToTwoDecimals(group.orderTotalPriceIncludingVat + refundTotalIncludingVat),
          totalQuantity: group.orderTotalQuantity,
          lineCount: group.orderLineCount + refundLines.length,
          currency: 'EUR',
          orderedAt: group.orderedAt ?? null,
          refundLines: refundLines.map((refundLine) => ({
            refundId: new mongoose.Types.ObjectId(refundLine.refundId),
            kind: refundLine.kind,
            name: refundLine.name,
            reference: refundLine.reference,
            category: refundLine.category,
            unitPrice: refundLine.unitPrice,
            vatRate: refundLine.vatRate,
            unitPriceIncludingVat: refundLine.unitPriceIncludingVat,
            quantity: refundLine.quantity,
            lineTotal: refundLine.lineTotal,
            lineTotalIncludingVat: refundLine.lineTotalIncludingVat,
            comment: refundLine.comment,
            createdAt: refundLine.createdAt ?? null
          }))
        }
      },
      upsert: true
    }
  };
  });

  await Bill.bulkWrite(operations, { ordered: false });

  const newlyAppliedRefundIds = refunds
    .filter((refund) => !refund.appliedBillDate)
    .map((refund) => refund._id);
  if (newlyAppliedRefundIds.length > 0) {
    await Refund.updateMany(
      {
        _id: { $in: newlyAppliedRefundIds },
        appliedBillDate: null
      },
      {
        $set: {
          appliedBillDate: dayStart,
          appliedAt: new Date()
        }
      }
    );
  }

  return { day, upserted: operations.length, appliedRefundCount: newlyAppliedRefundIds.length };
}

function buildValidatedAtFilter(fromDateInput, toDateInput) {
  const fromDate = fromDateInput ? parseIsoDayUtc(fromDateInput) : null;
  const toDate = toDateInput ? parseIsoDayUtc(toDateInput) : null;

  if (fromDateInput && !fromDate) {
    return { ok: false, message: 'Invalid from date. Use YYYY-MM-DD.' };
  }

  if (toDateInput && !toDate) {
    return { ok: false, message: 'Invalid to date. Use YYYY-MM-DD.' };
  }

  if (fromDate && toDate && fromDate > toDate) {
    return { ok: false, message: 'From date must be before or equal to to date.' };
  }

  const filter = {};
  if (fromDate) {
    filter.$gte = fromDate;
  }

  if (toDate) {
    filter.$lt = addUtcDays(toDate, 1);
  }

  return { ok: true, filter };
}

function buildVendorDayOrderKey(clientId, day) {
  return `${clientId}::${day}`;
}

function parseVendorDayOrderKey(value) {
  const normalized = normalizeString(value);
  const [clientId, day] = normalized.split('::');

  if (!clientId || !day || !mongoose.Types.ObjectId.isValid(clientId)) {
    return null;
  }

  if (!parseIsoDayUtc(day)) {
    return null;
  }

  return { clientId, day };
}

function buildClientVendorDayBillKey(vendorId, day) {
  return `${vendorId}::${day}`;
}

function parseClientVendorDayBillKey(value) {
  const normalized = normalizeString(value);
  const [vendorId, day] = normalized.split('::');

  if (!vendorId || !day || !mongoose.Types.ObjectId.isValid(vendorId)) {
    return null;
  }

  if (!parseIsoDayUtc(day)) {
    return null;
  }

  return { vendorId, day };
}

function sanitizeFilenamePart(value) {
  return (
    normalizeString(value)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'bill'
  );
}

function formatMoney(value, currency = 'EUR') {
  const normalizedCurrency = normalizeString(currency).toUpperCase();
  const amount = roundToTwoDecimals(Number(value ?? 0)).toFixed(2);

  if (normalizedCurrency === 'EUR' || !normalizedCurrency) {
    return `${amount} €`;
  }

  return `${amount} ${normalizedCurrency}`;
}

function formatPdfDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatPdfDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

async function getOrCreatePersistedBillUuid({ day, vendorId, clientId }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate) {
    throw new Error('Invalid bill day.');
  }

  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
  const clientObjectId = new mongoose.Types.ObjectId(clientId);
  const billUniqueId = await buildBillUniqueId({ day, vendorId, clientId });

  try {
    const bill = await Bill.findOneAndUpdate(
      {
        date: billDate,
        vendorId: vendorObjectId,
        clientId: clientObjectId
      },
      {
        $setOnInsert: {
          date: billDate,
          vendorId: vendorObjectId,
          clientId: clientObjectId
        },
        $set: {
          uuid: billUniqueId
        }
      },
      {
        new: true,
        upsert: true
      }
    )
      .select({ uuid: 1 })
      .lean();

    if (!bill?.uuid) {
      throw new Error('Unable to persist bill identifier.');
    }

    return bill.uuid;
  } catch (error) {
    // Handle rare concurrent insert race on unique composite index.
    if (error?.code === 11000) {
      const existing = await Bill.findOneAndUpdate(
        {
          date: billDate,
          vendorId: vendorObjectId,
          clientId: clientObjectId
        },
        { $set: { uuid: billUniqueId } },
        { new: true }
      )
        .select({ uuid: 1 })
        .lean();
      if (existing?.uuid) {
        return existing.uuid;
      }
    }
    throw error;
  }
}

function mapBillSettlement(bill) {
  const vendorSettled = Boolean(bill?.vendorSettled);
  const clientSettled = Boolean(bill?.clientSettled);
  return {
    vendorSettled,
    clientSettled,
    isSettled: vendorSettled && clientSettled
  };
}

function mapBillClientComment(bill) {
  const clientComment = normalizeString(bill?.clientComment);
  const clientCommentSentAt = bill?.clientCommentSentAt
    ? new Date(bill.clientCommentSentAt).toISOString()
    : null;

  return {
    clientComment,
    clientCommentSentAt
  };
}

function mapVendorBillMessageSummary(bill, clientNameById = new Map()) {
  const clientId = bill.clientId.toString();
  const day = new Date(bill.date).toISOString().slice(0, 10);
  const comment = mapBillClientComment(bill);
  const vendorMessageReadAt = bill?.vendorMessageReadAt
    ? new Date(bill.vendorMessageReadAt).toISOString()
    : null;

  return {
    key: buildVendorDayOrderKey(clientId, day),
    clientId,
    clientOrganisation: clientNameById.get(clientId) || clientId,
    day,
    message: comment.clientComment,
    sentAt: comment.clientCommentSentAt,
    isRead: Boolean(vendorMessageReadAt)
  };
}

async function getBillSettlement({ day, vendorId, clientId }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    return mapBillSettlement(null);
  }

  const bill = await Bill.findOne({
    date: billDate,
    vendorId: new mongoose.Types.ObjectId(vendorId),
    clientId: new mongoose.Types.ObjectId(clientId)
  })
    .select({ vendorSettled: 1, clientSettled: 1 })
    .lean();

  return mapBillSettlement(bill);
}

async function getVendorBillSettlementMap({ day, vendorId, clientIds }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || clientIds.length === 0) {
    return new Map();
  }

  const validClientIds = clientIds.filter((clientId) => mongoose.Types.ObjectId.isValid(clientId));
  if (validClientIds.length === 0) {
    return new Map();
  }

  const bills = await Bill.find({
    date: billDate,
    vendorId: new mongoose.Types.ObjectId(vendorId),
    clientId: { $in: validClientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) }
  })
    .select({ clientId: 1, vendorSettled: 1, clientSettled: 1 })
    .lean();

  return new Map(
    bills.map((bill) => [bill.clientId.toString(), mapBillSettlement(bill)])
  );
}

async function getClientBillSettlementMap({ day, clientId, vendorIds }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(clientId) || vendorIds.length === 0) {
    return new Map();
  }

  const validVendorIds = vendorIds.filter((vendorId) => mongoose.Types.ObjectId.isValid(vendorId));
  if (validVendorIds.length === 0) {
    return new Map();
  }

  const bills = await Bill.find({
    date: billDate,
    clientId: new mongoose.Types.ObjectId(clientId),
    vendorId: { $in: validVendorIds.map((vendorId) => new mongoose.Types.ObjectId(vendorId)) }
  })
    .select({ vendorId: 1, vendorSettled: 1, clientSettled: 1 })
    .lean();

  return new Map(
    bills.map((bill) => [bill.vendorId.toString(), mapBillSettlement(bill)])
  );
}

async function setBillSettlement({ day, vendorId, clientId, role, settled }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error('Invalid bill identity.');
  }

  const updateField = role === 'vendor' ? 'vendorSettled' : 'clientSettled';
  const billUniqueId = await buildBillUniqueId({ day, vendorId, clientId });
  const setOnInsert = {
    date: billDate,
    vendorId: new mongoose.Types.ObjectId(vendorId),
    clientId: new mongoose.Types.ObjectId(clientId)
  };
  // Avoid Mongo upsert path conflicts: a field cannot be in both $set and $setOnInsert.
  if (role === 'vendor') {
    setOnInsert.clientSettled = false;
  } else {
    setOnInsert.vendorSettled = false;
  }

  const bill = await Bill.findOneAndUpdate(
    {
      date: billDate,
      vendorId: new mongoose.Types.ObjectId(vendorId),
      clientId: new mongoose.Types.ObjectId(clientId)
    },
    {
      $setOnInsert: setOnInsert,
      $set: {
        [updateField]: Boolean(settled),
        uuid: billUniqueId
      }
    },
    {
      upsert: true,
      new: true
    }
  )
    .select({ vendorSettled: 1, clientSettled: 1 })
    .lean();

  return mapBillSettlement(bill);
}

async function setBillClientComment({ day, vendorId, clientId, comment }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  const normalizedComment = normalizeString(comment);
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error('Invalid bill identity.');
  }

  if (!normalizedComment) {
    throw new Error('Comment is required.');
  }

  if (normalizedComment.length > BILL_CLIENT_COMMENT_MAX_LENGTH) {
    throw new Error(`Comment must be at most ${BILL_CLIENT_COMMENT_MAX_LENGTH} characters.`);
  }

  const now = new Date();
  const billUniqueId = await buildBillUniqueId({ day, vendorId, clientId });
  const bill = await Bill.findOneAndUpdate(
    {
      date: billDate,
      vendorId: new mongoose.Types.ObjectId(vendorId),
      clientId: new mongoose.Types.ObjectId(clientId)
    },
    {
      $setOnInsert: {
        date: billDate,
        vendorId: new mongoose.Types.ObjectId(vendorId),
        clientId: new mongoose.Types.ObjectId(clientId),
        vendorSettled: false,
        clientSettled: false
      },
      $set: {
        uuid: billUniqueId,
        clientComment: normalizedComment,
        clientCommentSentAt: now,
        vendorMessageReadAt: null,
        vendorMessageDismissedAt: null
      }
    },
    {
      upsert: true,
      new: true
    }
  )
    .select({ clientComment: 1, clientCommentSentAt: 1 })
    .lean();

  return mapBillClientComment(bill);
}

async function listVendorBillMessages(vendorIdInput) {
  if (!mongoose.Types.ObjectId.isValid(vendorIdInput)) {
    return [];
  }

  const vendorId = new mongoose.Types.ObjectId(vendorIdInput);
  const bills = await Bill.find({
    vendorId,
    clientComment: { $exists: true, $ne: '' },
    vendorMessageDismissedAt: null
  })
    .sort({ clientCommentSentAt: -1, date: -1, updatedAt: -1 })
    .select({ clientId: 1, date: 1, clientComment: 1, clientCommentSentAt: 1, vendorMessageReadAt: 1 })
    .lean();

  if (bills.length === 0) {
    return [];
  }

  const clientIds = [...new Set(
    bills
      .map((bill) => bill.clientId?.toString?.() ?? '')
      .filter((clientId) => mongoose.Types.ObjectId.isValid(clientId))
  )];

  const clients = await User.find({
    _id: { $in: clientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) }
  })
    .select({ _id: 1, organisation: 1, username: 1 })
    .lean();

  const clientNameById = new Map(
    clients.map((client) => [
      client._id.toString(),
      normalizeString(client.organisation) || normalizeString(client.username) || client._id.toString()
    ])
  );

  return bills.map((bill) => mapVendorBillMessageSummary(bill, clientNameById));
}

async function markVendorBillMessageRead({ day, vendorId, clientId }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error('Invalid bill identity.');
  }

  const now = new Date();
  const bill = await Bill.findOneAndUpdate(
    {
      date: billDate,
      vendorId: new mongoose.Types.ObjectId(vendorId),
      clientId: new mongoose.Types.ObjectId(clientId),
      clientComment: { $exists: true, $ne: '' },
      vendorMessageDismissedAt: null
    },
    {
      $set: {
        vendorMessageReadAt: now
      }
    },
    {
      new: true
    }
  )
    .select({ clientId: 1, date: 1, clientComment: 1, clientCommentSentAt: 1, vendorMessageReadAt: 1 })
    .lean();

  if (!bill) {
    return null;
  }

  const client = await User.findById(bill.clientId)
    .select({ _id: 1, organisation: 1, username: 1 })
    .lean();
  const clientNameById = new Map();
  if (client?._id) {
    clientNameById.set(
      client._id.toString(),
      normalizeString(client.organisation) || normalizeString(client.username) || client._id.toString()
    );
  }

  return mapVendorBillMessageSummary(bill, clientNameById);
}

async function dismissVendorBillMessage({ day, vendorId, clientId }) {
  const billDate = parseIsoDayUtc(normalizeString(day));
  if (!billDate || !mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error('Invalid bill identity.');
  }

  const result = await Bill.updateOne(
    {
      date: billDate,
      vendorId: new mongoose.Types.ObjectId(vendorId),
      clientId: new mongoose.Types.ObjectId(clientId),
      clientComment: { $exists: true, $ne: '' },
      vendorMessageDismissedAt: null
    },
    {
      $set: {
        vendorMessageDismissedAt: new Date()
      }
    }
  );

  return result.modifiedCount > 0;
}

async function addBillPenaltyLine({ key, vendorId, percentage }) {
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    return { ok: false, code: 400, message: 'Invalid vendor identifier.' };
  }

  const parsedKey = parseVendorDayOrderKey(key);
  if (!parsedKey) {
    return { ok: false, code: 400, message: 'Invalid bill selection.' };
  }

  const billDate = parseIsoDayUtc(parsedKey.day);
  if (!billDate) {
    return { ok: false, code: 400, message: 'Invalid bill day.' };
  }

  const normalizedPercentage = normalizeBillPenaltyPercentage(percentage);
  if (!normalizedPercentage) {
    return {
      ok: false,
      code: 400,
      message: `Penalty percentage must be an integer between ${BILL_PENALTY_MIN_PERCENT} and ${BILL_PENALTY_MAX_PERCENT}.`
    };
  }

  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
  const clientObjectId = new mongoose.Types.ObjectId(parsedKey.clientId);
  const bill = await Bill.findOne({
    date: billDate,
    vendorId: vendorObjectId,
    clientId: clientObjectId
  })
    .select({ totalPrice: 1, totalPriceIncludingVat: 1, lineCount: 1, vendorSettled: 1, penaltyLines: 1 })
    .lean();

  if (!bill) {
    return { ok: false, code: 404, message: 'Bill not found.' };
  }

  if (bill.vendorSettled) {
    return { ok: false, code: 400, message: 'Cannot add a penalty to a settled bill.' };
  }

  if (Array.isArray(bill.penaltyLines) && bill.penaltyLines.length > 0) {
    return { ok: false, code: 400, message: 'A penalty line has already been added to this bill.' };
  }

  const billTotal = roundToTwoDecimals(Number(bill.totalPrice ?? 0));
  if (billTotal <= 0) {
    return { ok: false, code: 400, message: 'Cannot add a penalty to a bill with a non-positive total.' };
  }

  const penaltyAmount = roundToTwoDecimals((billTotal * normalizedPercentage) / 100);
  if (penaltyAmount <= 0) {
    return { ok: false, code: 400, message: 'Calculated penalty amount must be greater than 0.' };
  }

  const penaltyLine = {
    id: randomUUID(),
    kind: 'penalty',
    name: 'Late payment penalty',
    reference: `${normalizedPercentage}%`,
    category: 'Penalty',
    unitPrice: penaltyAmount,
    vatRate: 0,
    unitPriceIncludingVat: penaltyAmount,
    quantity: null,
    lineTotal: penaltyAmount,
    lineTotalIncludingVat: penaltyAmount,
    vatCategory: 'O',
    vatExemptionReason: 'Outside scope of VAT',
    percentage: normalizedPercentage,
    createdAt: new Date()
  };

  await Bill.updateOne(
    {
      date: billDate,
      vendorId: vendorObjectId,
      clientId: clientObjectId
    },
    {
      $push: { penaltyLines: penaltyLine },
      $set: {
        totalPrice: roundToTwoDecimals(billTotal + penaltyAmount),
        totalPriceIncludingVat: roundToTwoDecimals(Number(bill.totalPriceIncludingVat ?? billTotal) + penaltyAmount),
        lineCount: Number(bill.lineCount ?? 0) + 1
      }
    }
  );

  return {
    ok: true,
    bill: {
      key: buildVendorDayOrderKey(parsedKey.clientId, parsedKey.day),
      percentage: normalizedPercentage,
      penaltyAmount,
      totalPrice: roundToTwoDecimals(billTotal + penaltyAmount),
      totalPriceIncludingVat: roundToTwoDecimals(Number(bill.totalPriceIncludingVat ?? billTotal) + penaltyAmount),
      lineCount: Number(bill.lineCount ?? 0) + 1
    }
  };
}

function drawPdfPartyBlock(doc, { x, y, width, title, lines }) {
  let cursorY = y;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(title, x, cursorY, { width });
  cursorY += doc.heightOfString(title, { width }) + 2;

  doc.font('Helvetica').fontSize(10);
  for (const line of lines) {
    doc.text(line, x, cursorY, { width });
    cursorY += doc.heightOfString(line, { width }) + 1;
  }

  return cursorY;
}

function truncatePdfCellText(doc, text, maxWidth) {
  const value = String(text ?? '');
  if (doc.widthOfString(value) <= maxWidth) {
    return value;
  }

  const ellipsis = '...';
  let trimmed = value;
  while (trimmed.length > 0 && doc.widthOfString(`${trimmed}${ellipsis}`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}${ellipsis}`;
}

function formatBillItemLabel(item) {
  const name = normalizeString(item?.name);
  const reference = normalizeString(item?.reference);
  if (name && reference) {
    return `${name} (${reference})`;
  }

  return name || reference || '-';
}

function sendBillPdf(reply, { filename, title, labels, billIdentifier, orderedAt, deliveryDate, topLogoPath, vendor, client, items, totalPrice, totalPriceIncludingVat, currency }) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42
  });

  reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${filename}"`)
    .header('Cache-Control', 'no-store');

  doc.info.Title = title;
  doc.info.Creator = 'Rungis Portal';
  doc.info.Producer = 'Rungis Portal';

  const printableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;
  const headerTopY = doc.y;
  const normalizedTopLogoPath = normalizeString(topLogoPath);
  const logoWidth = 100;
  let logoHeight = 0;
  let titleWidth = printableWidth;

  if (normalizedTopLogoPath) {
    try {
      const logoImage = doc.openImage(normalizedTopLogoPath);
      const scale = logoWidth / logoImage.width;
      logoHeight = logoImage.height * scale;
      const logoX = doc.page.width - doc.page.margins.right - logoWidth;
      doc.image(normalizedTopLogoPath, logoX, headerTopY, { width: logoWidth });
      titleWidth = printableWidth - logoWidth - 12;
    } catch {
      // Ignore missing/invalid logos in PDF rendering.
    }
  }

  doc.font('Helvetica-Bold').fontSize(18).text(title, leftX, headerTopY, { width: titleWidth });
  if (logoHeight > 0) {
    doc.y = Math.max(doc.y, headerTopY + logoHeight);
  }
  doc.moveDown(0.25);
  doc.font('Helvetica-Bold').fontSize(12).text(`${labels.billId}: ${billIdentifier}`);
  doc.font('Helvetica').fontSize(11).text(`${labels.orderedAt}: ${formatPdfDateTime(orderedAt)}`);
  doc.text(`${labels.deliveryDate}: ${formatPdfDate(deliveryDate)}`);
  doc.moveDown(0.4);

  const gap = 24;
  const columnWidth = (printableWidth - gap) / 2;
  const rightX = leftX + columnWidth + gap;
  const startY = doc.y;

  const vendorEndY = drawPdfPartyBlock(doc, {
    x: leftX,
    y: startY,
    width: columnWidth,
    title: labels.vendor,
    lines: [
      `${labels.organisation}: ${vendor.organisation}`,
      `${labels.address}: ${vendor.address}`,
      `${labels.zipcode}: ${vendor.zipcode}`,
      `${labels.city}: ${vendor.city}`,
      `${labels.phone}: ${vendor.phoneNumber}`,
      `${labels.businessId}: ${vendor.businessId}`,
      vendor.vatId ? `${labels.vatId ?? 'VAT ID'}: ${vendor.vatId}` : '',
      vendor.billMentions ? `${labels.billMentions ?? 'Bill mentions'}: ${vendor.billMentions}` : ''
    ].filter(Boolean)
  });

  const clientEndY = drawPdfPartyBlock(doc, {
    x: rightX,
    y: startY,
    width: columnWidth,
    title: labels.client,
    lines: [
      `${labels.organisation}: ${client.organisation}`,
      `${labels.address}: ${client.address}`,
      `${labels.zipcode}: ${client.zipcode}`,
      `${labels.city}: ${client.city}`,
      `${labels.businessId}: ${client.businessId}`
    ]
  });

  doc.y = Math.max(vendorEndY, clientEndY) + 10;
  const tableLeft = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnRatios = [0.30, 0.14, 0.13, 0.09, 0.06, 0.14, 0.14];
  const columnWidths = columnRatios.map((ratio) => tableWidth * ratio);
  const rowHeight = 16;
  const textPadding = 4;
  const rowTextOffsetY = 3;

  const drawTableHeader = () => {
    const headers = [labels.item, labels.category, labels.unitPrice, labels.unitPriceIncludingVat, labels.qty, labels.lineTotal, labels.lineTotalIncludingVat];
    const rowTop = doc.y;
    const textY = rowTop + rowTextOffsetY;
    let x = tableLeft;
    doc.font('Helvetica-Bold').fontSize(9);
    for (let index = 0; index < headers.length; index += 1) {
      const align = index >= 2 ? 'right' : 'left';
      doc.text(headers[index], x + textPadding, textY, {
        width: columnWidths[index] - textPadding * 2,
        align,
        lineBreak: false
      });
      x += columnWidths[index];
    }
    const lineY = rowTop + rowHeight;
    doc.moveTo(tableLeft, lineY).lineTo(tableLeft + tableWidth, lineY).strokeColor('#999').lineWidth(0.6).stroke();
    doc.strokeColor('#000');
    doc.y = lineY;
  };

  const ensureTableRowSpace = () => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - rowHeight;
    if (doc.y <= bottomLimit) {
      return;
    }

    doc.addPage();
    drawTableHeader();
  };

  drawTableHeader();

  doc.font('Helvetica').fontSize(9);
  for (const item of items) {
    ensureTableRowSpace();
    const rowTop = doc.y;
    const textY = rowTop + rowTextOffsetY;

    const values = [
      formatBillItemLabel(item),
      item.category,
      formatMoney(item.unitPrice, currency),
      formatMoney(item.unitPriceIncludingVat ?? calculatePriceIncludingVat(item.unitPrice, item.vatRate), currency),
      item.quantity === null || item.quantity === undefined ? '-' : String(item.quantity),
      formatMoney(item.lineTotal, currency),
      formatMoney(item.lineTotalIncludingVat ?? calculateLineTotalIncludingVat(item.lineTotal, item.vatRate), currency)
    ];

    let x = tableLeft;
    for (let index = 0; index < values.length; index += 1) {
      const align = index >= 2 ? 'right' : 'left';
      const cellWidth = columnWidths[index] - textPadding * 2;
      doc.text(truncatePdfCellText(doc, values[index], cellWidth), x + textPadding, textY, {
        width: columnWidths[index] - textPadding * 2,
        align,
        lineBreak: false
      });
      x += columnWidths[index];
    }

    const rowBottomY = rowTop + rowHeight;
    doc.moveTo(tableLeft, rowBottomY).lineTo(tableLeft + tableWidth, rowBottomY).strokeColor('#e0e0e0').lineWidth(0.4).stroke();
    doc.strokeColor('#000');
    doc.y = rowBottomY;
  }

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).text(`${labels.total}: ${formatMoney(totalPrice, currency)}`, {
    align: 'right'
  });
  doc.font('Helvetica-Bold').fontSize(12).text(`${labels.totalIncludingVat}: ${formatMoney(totalPriceIncludingVat ?? totalPrice, currency)}`, {
    align: 'right'
  });

  const response = reply.send(doc);
  doc.end();
  return response;
}

async function getVendorBillDetails(vendorIdInput, keyInput) {
  if (!mongoose.Types.ObjectId.isValid(vendorIdInput)) {
    return { ok: false, code: 400, message: 'Invalid vendor identifier.' };
  }

  const parsedKey = parseVendorDayOrderKey(keyInput);
  if (!parsedKey) {
    return { ok: false, code: 400, message: 'Invalid bill selection.' };
  }

  const dayStart = parseIsoDayUtc(parsedKey.day);
  if (!dayStart) {
    return { ok: false, code: 400, message: 'Invalid bill day.' };
  }

  const dayEnd = addUtcDays(dayStart, 1);
  const clientId = new mongoose.Types.ObjectId(parsedKey.clientId);
  const vendorId = new mongoose.Types.ObjectId(vendorIdInput);
  const vendorIdString = vendorId.toString();

  const orders = await ValidatedOrder.find({
    clientId,
    validatedAt: { $gte: dayStart, $lt: dayEnd },
    'items.vendorId': vendorId
  })
    .select({ clientUsername: 1, validatedAt: 1, deliveryDate: 1, items: 1 })
    .lean();

  const itemMap = new Map();
  let totalPrice = 0;
  let totalPriceIncludingVat = 0;
  let orderedAt = null;
  let deliveryDate = null;

  for (const order of orders) {
    if (!orderedAt || new Date(order.validatedAt).getTime() < new Date(orderedAt).getTime()) {
      orderedAt = order.validatedAt;
    }
    if (!deliveryDate && order.deliveryDate) {
      deliveryDate = order.deliveryDate;
    }

    for (const item of order.items ?? []) {
      if (item.vendorId.toString() !== vendorIdString) {
        continue;
      }

      const vatRate = normalizeVatRate(item.vatRate);
      const unitPriceIncludingVat = Number(item.unitPriceIncludingVat ?? calculatePriceIncludingVat(item.unitPrice, vatRate));
      const lineTotalIncludingVat = Number(item.lineTotalIncludingVat ?? calculateLineTotalIncludingVat(item.lineTotal, vatRate));
      const itemMapKey = `${item.merchandiseId.toString()}::${item.unitPrice}::${vatRate}`;
      const existing = itemMap.get(itemMapKey);
      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotal = roundToTwoDecimals(existing.lineTotal + item.lineTotal);
        existing.lineTotalIncludingVat = roundToTwoDecimals(existing.lineTotalIncludingVat + lineTotalIncludingVat);
      } else {
        itemMap.set(itemMapKey, {
          merchandiseId: item.merchandiseId.toString(),
          name: item.name,
          reference: item.reference,
          category: item.category,
          unitPrice: item.unitPrice,
          vatRate,
          unitPriceIncludingVat,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          lineTotalIncludingVat,
          vatCategory: item.vatCategory,
          vatExemptionReason: item.vatExemptionReason
        });
      }

      totalPrice = roundToTwoDecimals(totalPrice + item.lineTotal);
      totalPriceIncludingVat = roundToTwoDecimals(totalPriceIncludingVat + lineTotalIncludingVat);
    }
  }

  const items = [...itemMap.values()].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.reference.localeCompare(right.reference);
  });

  const billRecord = await Bill.findOne({
    date: dayStart,
    vendorId,
    clientId
  })
    .select({
      vendorSettled: 1,
      clientSettled: 1,
      clientComment: 1,
      clientCommentSentAt: 1,
      refundLines: 1,
      penaltyLines: 1,
      totalPrice: 1,
      totalPriceIncludingVat: 1,
      orderedAt: 1
    })
    .lean();
  const refundItems = (billRecord?.refundLines ?? []).map(mapRefundToBillLine);
  const penaltyItems = (billRecord?.penaltyLines ?? []).map(mapPenaltyToBillLine);
  const combinedItems = [...items, ...refundItems, ...penaltyItems];
  if (combinedItems.length === 0) {
    return { ok: false, code: 404, message: 'Bill details not found for the selected client/day.' };
  }

  if (!orderedAt && billRecord?.orderedAt) {
    orderedAt = billRecord.orderedAt;
  }
  if (!deliveryDate) {
    deliveryDate = dayStart;
  }

  let clientUsername = orders[0]?.clientUsername ?? parsedKey.clientId;
  if (orders.length === 0) {
    const client = await User.findById(parsedKey.clientId)
      .select({ username: 1 })
      .lean();
    clientUsername = normalizeString(client?.username) || parsedKey.clientId;
  }

  const settlement = mapBillSettlement(billRecord);
  const comment = mapBillClientComment(billRecord);

  return {
    ok: true,
    bill: {
      key: buildVendorDayOrderKey(parsedKey.clientId, parsedKey.day),
      day: parsedKey.day,
      clientId: parsedKey.clientId,
      clientUsername,
      orderedAt,
      deliveryDate,
      items: combinedItems,
      totalPrice: billRecord
        ? roundToTwoDecimals(Number(billRecord.totalPrice ?? totalPrice + getRefundLineTotal(refundItems) + getPenaltyLineTotal(penaltyItems)))
        : roundToTwoDecimals(totalPrice + getRefundLineTotal(refundItems) + getPenaltyLineTotal(penaltyItems)),
      totalPriceIncludingVat: billRecord
        ? roundToTwoDecimals(Number(billRecord.totalPriceIncludingVat ?? totalPriceIncludingVat + getBillLineTotalIncludingVat(refundItems) + getBillLineTotalIncludingVat(penaltyItems)))
        : roundToTwoDecimals(totalPriceIncludingVat + getBillLineTotalIncludingVat(refundItems) + getBillLineTotalIncludingVat(penaltyItems)),
      currency: 'EUR',
      ...comment,
      ...settlement
    }
  };
}

async function getClientBillDetails(clientIdInput, keyInput) {
  if (!mongoose.Types.ObjectId.isValid(clientIdInput)) {
    return { ok: false, code: 400, message: 'Invalid client identifier.' };
  }

  const parsedKey = parseClientVendorDayBillKey(keyInput);
  if (!parsedKey) {
    return { ok: false, code: 400, message: 'Invalid bill selection.' };
  }

  const dayStart = parseIsoDayUtc(parsedKey.day);
  if (!dayStart) {
    return { ok: false, code: 400, message: 'Invalid bill day.' };
  }

  const dayEnd = addUtcDays(dayStart, 1);
  const clientId = new mongoose.Types.ObjectId(clientIdInput);
  const vendorIdObject = new mongoose.Types.ObjectId(parsedKey.vendorId);

  const orders = await ValidatedOrder.find({
    clientId,
    validatedAt: { $gte: dayStart, $lt: dayEnd },
    'items.vendorId': vendorIdObject
  })
    .select({ validatedAt: 1, deliveryDate: 1, items: 1 })
    .lean();

  const itemMap = new Map();
  let totalPrice = 0;
  let totalPriceIncludingVat = 0;
  let vendorName = parsedKey.vendorId;
  let orderedAt = null;
  let deliveryDate = null;

  for (const order of orders) {
    if (!orderedAt || new Date(order.validatedAt).getTime() < new Date(orderedAt).getTime()) {
      orderedAt = order.validatedAt;
    }
    if (!deliveryDate && order.deliveryDate) {
      deliveryDate = order.deliveryDate;
    }

    for (const item of order.items ?? []) {
      if (item.vendorId.toString() !== parsedKey.vendorId) {
        continue;
      }

      vendorName = item.vendorName || vendorName;
      const vatRate = normalizeVatRate(item.vatRate);
      const unitPriceIncludingVat = Number(item.unitPriceIncludingVat ?? calculatePriceIncludingVat(item.unitPrice, vatRate));
      const lineTotalIncludingVat = Number(item.lineTotalIncludingVat ?? calculateLineTotalIncludingVat(item.lineTotal, vatRate));
      const itemMapKey = `${item.merchandiseId.toString()}::${item.unitPrice}::${vatRate}`;
      const existing = itemMap.get(itemMapKey);

      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotal = roundToTwoDecimals(existing.lineTotal + item.lineTotal);
        existing.lineTotalIncludingVat = roundToTwoDecimals(existing.lineTotalIncludingVat + lineTotalIncludingVat);
      } else {
        itemMap.set(itemMapKey, {
          merchandiseId: item.merchandiseId.toString(),
          name: item.name,
          reference: item.reference,
          category: item.category,
          vendorId: item.vendorId.toString(),
          vendorName: item.vendorName,
          unitPrice: item.unitPrice,
          vatRate,
          unitPriceIncludingVat,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          lineTotalIncludingVat,
          vatCategory: item.vatCategory,
          vatExemptionReason: item.vatExemptionReason
        });
      }

      totalPrice = roundToTwoDecimals(totalPrice + item.lineTotal);
      totalPriceIncludingVat = roundToTwoDecimals(totalPriceIncludingVat + lineTotalIncludingVat);
    }
  }

  const items = [...itemMap.values()].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.reference.localeCompare(right.reference);
  });

  const billRecord = await Bill.findOne({
    date: dayStart,
    vendorId: vendorIdObject,
    clientId
  })
    .select({
      vendorSettled: 1,
      clientSettled: 1,
      clientComment: 1,
      clientCommentSentAt: 1,
      refundLines: 1,
      penaltyLines: 1,
      totalPrice: 1,
      totalPriceIncludingVat: 1,
      orderedAt: 1
    })
    .lean();
  const refundItems = (billRecord?.refundLines ?? []).map(mapRefundToBillLine);
  const penaltyItems = (billRecord?.penaltyLines ?? []).map(mapPenaltyToBillLine);
  const combinedItems = [...items, ...refundItems, ...penaltyItems];
  if (combinedItems.length === 0) {
    return { ok: false, code: 404, message: 'Bill details not found for the selected vendor/day.' };
  }

  if (!orderedAt && billRecord?.orderedAt) {
    orderedAt = billRecord.orderedAt;
  }
  if (!deliveryDate) {
    deliveryDate = dayStart;
  }

  if (orders.length === 0) {
    const vendor = await User.findById(parsedKey.vendorId)
      .select({ organisation: 1, username: 1 })
      .lean();
    vendorName = normalizeString(vendor?.organisation) || normalizeString(vendor?.username) || parsedKey.vendorId;
  }

  const settlement = mapBillSettlement(billRecord);
  const comment = mapBillClientComment(billRecord);

  return {
    ok: true,
    bill: {
      key: buildClientVendorDayBillKey(parsedKey.vendorId, parsedKey.day),
      day: parsedKey.day,
      vendorId: parsedKey.vendorId,
      vendorName,
      orderedAt,
      deliveryDate,
      items: combinedItems,
      totalPrice: billRecord
        ? roundToTwoDecimals(Number(billRecord.totalPrice ?? totalPrice + getRefundLineTotal(refundItems) + getPenaltyLineTotal(penaltyItems)))
        : roundToTwoDecimals(totalPrice + getRefundLineTotal(refundItems) + getPenaltyLineTotal(penaltyItems)),
      totalPriceIncludingVat: billRecord
        ? roundToTwoDecimals(Number(billRecord.totalPriceIncludingVat ?? totalPriceIncludingVat + getBillLineTotalIncludingVat(refundItems) + getBillLineTotalIncludingVat(penaltyItems)))
        : roundToTwoDecimals(totalPriceIncludingVat + getBillLineTotalIncludingVat(refundItems) + getBillLineTotalIncludingVat(penaltyItems)),
      currency: 'EUR',
      ...comment,
      ...settlement
    }
  };
}

function createRouteContext(app) {
  const redisClient = app.redisClient;
  const orderConnections = new Map();
  const stockConnections = new Map();
  const adminConnections = new Map();
  const clientDashboardConnections = new Map();
  const vendorDashboardConnections = new Map();
  let dailyBillGenerationTimer = null;

  const scheduleDailyBillGeneration = () => {
    const delayMs = getMillisecondsUntilNextDailyRun();
    dailyBillGenerationTimer = setTimeout(async () => {
      try {
        const day = formatLocalIsoDay();
        const result = await generateBillsForDay(day);
        app.log.info(
          { day: result.day, upserted: result.upserted },
          'Daily bill generation completed.'
        );
      } catch (error) {
        app.log.error({ err: error }, 'Daily bill generation failed.');
      } finally {
        scheduleDailyBillGeneration();
      }
    }, delayMs);
  };

  scheduleDailyBillGeneration();

  app.addHook('onClose', async () => {
    if (dailyBillGenerationTimer) {
      clearTimeout(dailyBillGenerationTimer);
      dailyBillGenerationTimer = null;
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    const routePath = normalizeString(request.routeOptions?.url);
    if (!routePath.startsWith('/api/')) {
      return;
    }

    if (
      hasDangerousInputKeys(request.body) ||
      hasDangerousInputKeys(request.params) ||
      hasDangerousInputKeys(request.query)
    ) {
      return reply.code(400).send({ ok: false, message: 'Invalid request payload.' });
    }
  });

  const assignVendorClientAssociation = async (clientId, vendorId) => {
    if (!isObjectId(clientId) || !isObjectId(vendorId)) {
      return { ok: false, code: 400, message: 'Invalid client or vendor id.' };
    }

    const [client, vendor] = await Promise.all([
      User.findById(clientId).select({ role: 1 }).lean(),
      User.findById(vendorId).select({ role: 1 }).lean()
    ]);

    if (!client || client.role !== 'client') {
      return { ok: false, code: 404, message: 'Client not found.' };
    }

    if (!vendor || vendor.role !== 'vendor') {
      return { ok: false, code: 404, message: 'Vendor not found.' };
    }

    await Promise.all([
      User.updateOne({ _id: clientId }, { $addToSet: { vendorIds: vendorId } }),
      User.updateOne({ _id: vendorId }, { $addToSet: { clientIds: clientId } })
    ]);

    return { ok: true, message: 'Association assigned.' };
  };

  const removeVendorClientAssociation = async (clientId, vendorId) => {
    if (!isObjectId(clientId) || !isObjectId(vendorId)) {
      return { ok: false, code: 400, message: 'Invalid client or vendor id.' };
    }

    await Promise.all([
      User.updateOne({ _id: clientId, role: 'client' }, { $pull: { vendorIds: vendorId } }),
      User.updateOne({ _id: vendorId, role: 'vendor' }, { $pull: { clientIds: clientId } })
    ]);

    return { ok: true, message: 'Association removed.' };
  };

  const dropOrderConnection = (socket) => {
    orderConnections.delete(socket);
  };

  const dropStockConnection = (socket) => {
    stockConnections.delete(socket);
  };

  const dropAdminConnection = (socket) => {
    adminConnections.delete(socket);
  };

  const dropClientDashboardConnection = (socket) => {
    clientDashboardConnections.delete(socket);
  };

  const dropVendorDashboardConnection = (socket) => {
    vendorDashboardConnections.delete(socket);
  };

  const sendToOrderConnections = async (vendorId, payloadBuilder) => {
    const subscribedClientIds = await getClientIdsSubscribedToVendor(vendorId);
    if (subscribedClientIds.size === 0) {
      return;
    }

    for (const [socket, meta] of orderConnections.entries()) {
      if (!meta?.clientId || !subscribedClientIds.has(meta.clientId)) {
        continue;
      }

      try {
        socket.send(JSON.stringify(payloadBuilder()));
      } catch {
        dropOrderConnection(socket);
      }
    }
  };

  const sendToStockConnections = async (vendorId, payloadBuilder) => {
    const vendorIdString = vendorId.toString();

    for (const [socket, meta] of stockConnections.entries()) {
      if (!meta?.vendorId || meta.vendorId !== vendorIdString) {
        continue;
      }

      try {
        socket.send(JSON.stringify(payloadBuilder()));
      } catch {
        dropStockConnection(socket);
      }
    }
  };

  const sendToAdminConnections = (payloadBuilder) => {
    for (const [socket] of adminConnections.entries()) {
      try {
        socket.send(JSON.stringify(payloadBuilder()));
      } catch {
        dropAdminConnection(socket);
      }
    }
  };

  const sendToVendorDashboardConnections = (vendorId, payloadBuilder) => {
    const vendorIdString = vendorId.toString();

    for (const [socket, meta] of vendorDashboardConnections.entries()) {
      if (!meta?.vendorId || meta.vendorId !== vendorIdString) {
        continue;
      }

      try {
        socket.send(JSON.stringify(payloadBuilder()));
      } catch {
        dropVendorDashboardConnection(socket);
      }
    }
  };

  const broadcastClientUnpaidReminders = async (clientId) => {
    const clientIdString = normalizeString(clientId);
    if (!mongoose.Types.ObjectId.isValid(clientIdString)) {
      return;
    }

    const reminders = await listClientUnpaidReminders(redisClient, clientIdString);
    for (const [socket, meta] of clientDashboardConnections.entries()) {
      if (!meta?.clientId || meta.clientId !== clientIdString) {
        continue;
      }

      try {
        socket.send(JSON.stringify({
          type: 'client:unpaid-reminders:update',
          reminders,
          at: new Date().toISOString()
        }));
      } catch {
        dropClientDashboardConnection(socket);
      }
    }
  };

  const broadcastOrderCatalogUpsert = async (merchandise, vendorName) => {
    const vendorId = merchandise.vendorId.toString();

    if (merchandise.stock <= 0) {
      await sendToOrderConnections(vendorId, () => ({
        type: 'order:catalog:update',
        event: 'remove',
        item: { id: merchandise._id.toString(), vendorId }
      }));
      return;
    }

    await sendToOrderConnections(vendorId, () => ({
      type: 'order:catalog:update',
      event: 'upsert',
      item: mapOrderCatalogItem(merchandise, vendorName)
    }));
  };

  const broadcastOrderCatalogRemove = async (merchandiseId, vendorId) => {
    await sendToOrderConnections(vendorId, () => ({
      type: 'order:catalog:update',
      event: 'remove',
      item: { id: merchandiseId, vendorId: vendorId.toString() }
    }));
  };

  const broadcastOrderPriceUpdate = async (merchandise, vendorName) => {
    const vendorId = merchandise.vendorId.toString();
    await sendToOrderConnections(vendorId, () => ({
      type: 'order:price:update',
      vendorId,
      merchandiseId: merchandise._id.toString(),
      price: merchandise.price,
      vatRate: normalizeVatRate(merchandise.vatRate),
      priceIncludingVat: calculatePriceIncludingVat(merchandise.price, merchandise.vatRate),
      stock: merchandise.stock,
      minimumStockThreshold: Number.isInteger(merchandise.minimumStockThreshold) ? merchandise.minimumStockThreshold : null,
      vendorName
    }));
  };

  const broadcastStocksSnapshot = async (vendorId) => {
    const vendorIdString = vendorId.toString();
    const items = await Merchandise.find({ vendorId: vendorIdString })
      .sort({ createdAt: -1 })
      .lean();

    await sendToStockConnections(vendorIdString, () => ({
      type: 'stocks:snapshot',
      vendorId: vendorIdString,
      items: items.map(mapMerchandise),
      at: new Date().toISOString()
    }));
  };

  return {
    adminConnections,
    assignVendorClientAssociation,
    broadcastClientUnpaidReminders,
    broadcastOrderCatalogRemove,
    broadcastOrderCatalogUpsert,
    broadcastOrderPriceUpdate,
    broadcastStocksSnapshot,
    clientDashboardConnections,
    dropAdminConnection,
    dropClientDashboardConnection,
    dropOrderConnection,
    dropStockConnection,
    dropVendorDashboardConnection,
    orderConnections,
    redisClient,
    removeVendorClientAssociation,
    sendToAdminConnections,
    sendToVendorDashboardConnections,
    stockConnections,
    vendorDashboardConnections
  };
}

export async function registerRoutes(app) {
  const context = createRouteContext(app);
  const deps = {
    addBillPenaltyLine,
    addUtcDays,
    APP_STYLE_PROFILE_PRIMARY,
    APP_STYLE_PROFILE_SECONDARY,
    APP_STYLE_PROFILE_SETTING_KEY,
    bcrypt,
    BILL_CLIENT_COMMENT_MAX_LENGTH,
    BILL_PENALTY_MAX_PERCENT,
    BILL_PENALTY_MIN_PERCENT,
    BILL_OVERDUE_DAYS_SETTING_KEY,
    Bill,
    buildClientVendorDayBillKey,
    buildLoginAttemptKey,
    buildPagePayload,
    buildUniqueAccessKeyName,
    buildUnpaidReminderKey,
    buildValidatedAtFilter,
    buildVendorDayOrderKey,
    clearLoginAttempts,
    clearRedisCart,
    dismissVendorBillMessage,
    fs,
    generateBillsForDay,
    generateRungisBillsForPreviousMonth,
    generateAuthenticationOptions,
    generateRegistrationOptions,
    getAppStyleProfileSetting,
    getBillOverdueDaysSetting,
    getClientBillDetails,
    getClientBillSettlementMap,
    getClientWithVendors,
    getErrorMessage,
    getLoginCooldownRemainingMs,
    getMerchandiseImageUrl,
    getOrCreatePersistedBillUuid,
    getRedisCart,
    getRequestLanguage,
    getRungisBillingSettings,
    getTranslationText,
    getUserLogoAbsolutePath,
    getUserLogoUrl,
    getUserPasskeys,
    getVendorBillDetails,
    getVendorBillSettlementMap,
    getVendorClientOverdueUnsettledTotal,
    getWebAuthnExpectedOrigins,
    getWebAuthnRpId,
    getWebAuthnRpName,
    hasDangerousInputKeys,
    isWebAuthnUserVerificationRequired,
    itemImagesDir,
    listClientUnpaidReminders,
    listVendorBillMessages,
    mapAccessKeySummary,
    mapBillSettlement,
    mapCart,
    mapMerchandise,
    mapOrderCatalogItem,
    mapPendingUser,
    mapSessionUser,
    mapStoredPasskeyToCredential,
    markVendorBillMessageRead,
    markRungisBillPaid,
    Merchandise,
    mongoose,
    normalizeBillOverdueDays,
    normalizeAppStyleProfile,
    normalizeString,
    normalizeRefundAmount,
    parseClientVendorDayBillKey,
    parseImageUploadDataUrl,
    parseIsoDayUtc,
    parseSiretValue,
    parseVendorDayOrderKey,
    path,
    randomUUID,
    REFUND_COMMENT_MAX_LENGTH,
    Refund,
    RungisBill,
    redirectForSessionUser,
    registerFailedLoginAttempt,
    removeUnpaidReminder,
    requireAdminApi,
    requireAdminPage,
    requireAuth,
    requireClientApi,
    requireClientPage,
    requirePageRateLimit,
    requireRungisBillUserApi,
    requireVendorApi,
    requireVendorPage,
    roundToTwoDecimals,
    sanitizeFilenamePart,
    sanitizeStockPayload,
    saveRedisCart,
    sendBillPdf,
    sendFacturXBill,
    setAppStyleProfileSetting,
    setBillClientComment,
    setBillOverdueDaysSetting,
    setRungisBillingSettings,
    setBillSettlement,
    searchUnpaidRungisBills,
    summarizeUserAgent,
    upsertUnpaidReminder,
    User,
    userLogosDir,
    ValidatedOrder,
    verifyAuthenticationResponse,
    verifyRegistrationResponse
  };

  registerPageRoutes(app, deps);
  registerAuthRoutes(app, context, deps);
  registerManagementRoutes(app, context, deps);
  registerBillRoutes(app, deps);
  registerRungisBillRoutes(app, deps);
  registerRefundRoutes(app, deps);
  registerWebsocketRoutes(app, context, deps);
}
