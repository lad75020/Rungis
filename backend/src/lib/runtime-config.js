const enabledValues = new Set(['1', 'true', 'yes', 'on']);

function parsePort(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number(fallback);
}

function parseBoolean(value) {
  return enabledValues.has(String(value ?? '').toLowerCase());
}

export function loadRuntimeConfig(env = process.env) {
  return {
    host: env.HOST ?? '127.0.0.1',
    port: parsePort(env.PORT, 3199),
    mongoUrl: env.MONGO_URL ?? 'mongodb://192.168.1.80:27017/rungis',
    redisUrl: env.REDIS_URL ?? 'redis://192.168.1.80:6379/5',
    sessionSecret: env.SESSION_SECRET ?? 'dev-session-secret-change-me',
    jwtSecret: env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
    nodeEnv: env.NODE_ENV ?? 'development',
    trustProxy: parseBoolean(env.TRUST_PROXY)
  };
}