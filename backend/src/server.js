import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import cookie from '@fastify/cookie';
import formBody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import session from '@fastify/session';
import staticPlugin from '@fastify/static';
import view from '@fastify/view';
import websocket from '@fastify/websocket';
import { RedisStore } from 'connect-redis';
import dotenv from 'dotenv';
import ejs from 'ejs';
import Fastify from 'fastify';
import mongoose from 'mongoose';
import { createClient } from 'redis';

import { closeAppSettingsStore, migrateLegacyAppSettingsFromMongo } from './lib/app-settings-store.js';
import { registerRoutes } from './routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3199),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017/rungis',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/5',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-change-me',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  trustProxy: ['1', 'true', 'yes', 'on'].includes((process.env.TRUST_PROXY ?? '').toLowerCase())
};

const app = Fastify({
  logger: true,
  logLevel: 'warn',
  bodyLimit: 10 * 1024 * 1024,
  trustProxy: env.trustProxy
});

const redisClient = createClient({ url: env.redisUrl });
redisClient.on('error', (error) => {
  app.log.error({ error }, 'Redis client error');
});

await redisClient.connect();
await mongoose.connect(env.mongoUrl);
await migrateLegacyAppSettingsFromMongo(mongoose.connection.db);

app.decorate('redisClient', redisClient);

await app.register(cookie);
await app.register(formBody);
await app.register(jwt, { secret: env.jwtSecret });
await app.register(websocket);

const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'sess:'
});

await app.register(session, {
  secret: env.sessionSecret,
  store: redisStore,
  cookieName: 'sid',
  saveUninitialized: false,
  cookie: {
    path: '/',
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production'
  }
});

await app.register(view, {
  engine: {
    ejs
  },
  root: path.join(__dirname, 'views')
});

await app.register(staticPlugin, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
});

app.addHook('onRequest', async (_request, reply) => {
  const nonce = randomBytes(16).toString('base64');
  const csp = [
    "script-src 'nonce-" + nonce + "' https://static.cloudflareinsights.com",
    "script-src-attr 'none'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');

  reply.header('x-csp-nonce', nonce);
  reply.header('content-security-policy', csp);
  reply.locals.nonce = nonce;
});

const angularBrowserPath = path.join(__dirname, 'public', 'angular', 'browser');
const angularIndexPath = path.join(angularBrowserPath, 'index.html');
const translationsPath = path.join(__dirname, 'i18n', 'translations.json');
let cachedAngularAssets = {
  mainJs: '/public/angular/browser/main.js',
  primaryStylesCss: '/public/angular/browser/styles.css',
  secondaryStylesCss: '/public/angular/browser/styles-secondary.css'
};
let cachedAngularAssetsMtimeMs = 0;
let cachedTranslations = {
  en: {},
  fr: {}
};
let cachedTranslationsMtimeMs = 0;

app.decorate('getAngularAssets', async () => {
  try {
    const stats = await fs.stat(angularIndexPath);
    if (cachedAngularAssetsMtimeMs === stats.mtimeMs) {
      return cachedAngularAssets;
    }

    const indexHtml = await fs.readFile(angularIndexPath, 'utf8');
    const styleMatch = indexHtml.match(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i
    );
    const scriptMatch = indexHtml.match(
      /<script[^>]+src=["']([^"']+)["'][^>]*type=["']module["'][^>]*><\/script>/i
    ) ?? indexHtml.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/i);

    const toPublicPath = (assetPath, fallback) => {
      if (!assetPath || typeof assetPath !== 'string') {
        return fallback;
      }

      if (assetPath.startsWith('/public/')) {
        return assetPath;
      }

      if (assetPath.startsWith('/')) {
        return `/public/angular/browser${assetPath}`;
      }

      return `/public/angular/browser/${assetPath}`;
    };

    const browserFiles = await fs.readdir(angularBrowserPath);
    const secondaryStyleFile = browserFiles.find((filename) => /^styles-secondary(?:-[^/]+)?\.css$/i.test(filename));

    cachedAngularAssets = {
      primaryStylesCss: toPublicPath(styleMatch?.[1], '/public/angular/browser/styles.css'),
      secondaryStylesCss: secondaryStyleFile
        ? `/public/angular/browser/${secondaryStyleFile}`
        : '/public/angular/browser/styles-secondary.css',
      mainJs: toPublicPath(scriptMatch?.[1], '/public/angular/browser/main.js')
    };
    cachedAngularAssetsMtimeMs = stats.mtimeMs;
  } catch {
    // Use static fallback if Angular build artifacts are unavailable.
  }

  return cachedAngularAssets;
});

app.decorate('getTranslations', async () => {
  try {
    const stats = await fs.stat(translationsPath);
    if (cachedTranslationsMtimeMs === stats.mtimeMs) {
      return cachedTranslations;
    }

    const raw = await fs.readFile(translationsPath, 'utf8');
    const parsed = JSON.parse(raw);
    cachedTranslations = {
      en: parsed?.en ?? {},
      fr: parsed?.fr ?? {}
    };
    cachedTranslationsMtimeMs = stats.mtimeMs;
  } catch {
    // Keep defaults if file is missing or invalid.
  }

  return cachedTranslations;
});

app.decorate('issueWsToken', (request, page) => {
  const sessionUser = request.session.user;

  return app.jwt.sign(
    {
      sub: sessionUser?.id ?? 'guest',
      username: sessionUser?.username ?? 'guest',
      role: sessionUser?.role ?? 'guest',
      page,
      scope: 'socket:connect'
    },
    {
      expiresIn: '1h'
    }
  );
});

await registerRoutes(app);

app.get('/health', async () => ({
  ok: true,
  uptime: process.uptime(),
  now: new Date().toISOString()
}));

app.addHook('onClose', async () => {
  closeAppSettingsStore();
  await redisClient.quit();
  await mongoose.disconnect();
});

await app.listen({
  host: env.host,
  port: env.port
});
