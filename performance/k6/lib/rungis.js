import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = (__ENV.K6_BASE_URL || 'http://127.0.0.1:3199').replace(/\/$/, '');
export const WS_URL = BASE_URL.replace(/^http/, 'ws');

const sharedPassword = __ENV.K6_PASSWORD || '11Test00!!';

export const accounts = {
  client: {
    username: __ENV.K6_CLIENT_USERNAME || 'client1',
    password: __ENV.K6_CLIENT_PASSWORD || sharedPassword
  },
  vendor: {
    username: __ENV.K6_VENDOR_USERNAME || 'vendor1',
    password: __ENV.K6_VENDOR_PASSWORD || sharedPassword
  },
  admin: {
    username: __ENV.K6_ADMIN_USERNAME || 'ladparis',
    password: __ENV.K6_ADMIN_PASSWORD || sharedPassword
  }
};

export function params(tags = {}, extra = {}) {
  return {
    ...extra,
    headers: {
      Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      ...(extra.headers || {})
    },
    tags
  };
}

export function jsonParams(tags = {}, extra = {}) {
  return params(tags, {
    ...extra,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(extra.headers || {})
    }
  });
}

export function expectStatus(response, name, expected = 200) {
  return check(response, {
    [`${name}: expected status ${expected}`]: (r) => r.status === expected,
    [`${name}: no server error`]: (r) => r.status < 500
  });
}

export function expectJsonOk(response, name, expected = 200) {
  return check(response, {
    [`${name}: expected status ${expected}`]: (r) => r.status === expected,
    [`${name}: JSON body`]: (r) => {
      try {
        JSON.parse(r.body || '{}');
        return true;
      } catch (_error) {
        return false;
      }
    }
  });
}

export function login(role) {
  const account = accounts[role];
  if (!account) {
    fail(`Unknown role ${role}`);
  }

  const response = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ username: account.username, password: account.password }),
    jsonParams({ endpoint: 'login', role })
  );

  const ok = check(response, {
    [`${role} login succeeds`]: (r) => r.status === 200 && Boolean(r.json('ok')),
    [`${role} login returns redirect`]: (r) => typeof r.json('redirect') === 'string'
  });

  if (!ok) {
    fail(`${role} login failed with HTTP ${response.status}`);
  }

  return response;
}

export function logout(role) {
  const response = http.post(`${BASE_URL}/api/logout`, JSON.stringify({}), jsonParams({ endpoint: 'logout', role }));
  expectJsonOk(response, `${role} logout`);
  return response;
}

export function getPath(path, endpoint, role = 'public', expected = 200) {
  const response = http.get(`${BASE_URL}${path}`, params({ endpoint, role }));
  expectStatus(response, `${role} ${endpoint}`, expected);
  return response;
}

export function getJson(path, endpoint, role, expected = 200) {
  const response = http.get(`${BASE_URL}${path}`, jsonParams({ endpoint, role }));
  expectJsonOk(response, `${role} ${endpoint}`, expected);
  return response;
}

export function wsToken(page, role) {
  const response = getJson(`/api/ws-token?page=${encodeURIComponent(page)}`, `ws-token-${page}`, role);
  const token = response.json('wsToken');
  check(response, {
    [`${role} websocket token for ${page}`]: () => typeof token === 'string' && token.length > 20
  });
  if (!token) {
    fail(`${role} websocket token missing for ${page}`);
  }
  return token;
}
