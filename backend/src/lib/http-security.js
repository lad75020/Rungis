import { randomBytes } from 'node:crypto';

function buildContentSecurityPolicy(nonce) {
  return [
    "script-src 'nonce-" + nonce + "' https://static.cloudflareinsights.com",
    "script-src-attr 'none'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');
}

export function registerSecurityHeaders(app) {
  app.addHook('onRequest', async (_request, reply) => {
    const nonce = randomBytes(16).toString('base64');

    reply.header('x-csp-nonce', nonce);
    reply.header('content-security-policy', buildContentSecurityPolicy(nonce));
    reply.locals.nonce = nonce;
  });
}