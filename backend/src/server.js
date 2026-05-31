import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

import { createAngularAssetResolver } from './lib/angular-assets.js';
import { closeAppSettingsStore, migrateLegacyAppSettingsFromMongo } from './lib/app-settings-store.js';
import { registerSecurityHeaders } from './lib/http-security.js';
import { loadRuntimeConfig } from './lib/runtime-config.js';
import { createTranslationResolver } from './lib/translations.js';
import { registerRoutes } from './routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = loadRuntimeConfig();

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

registerSecurityHeaders(app);

const angularBrowserPath = path.join(__dirname, 'public', 'angular', 'browser');
const angularIndexPath = path.join(angularBrowserPath, 'index.html');
const translationsPath = path.join(__dirname, 'i18n', 'translations.json');

app.decorate('getAngularAssets', createAngularAssetResolver({ angularBrowserPath, angularIndexPath }));
app.decorate('getTranslations', createTranslationResolver(translationsPath));

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
