import http from 'k6/http';
import { group, sleep } from 'k6';
import { BASE_URL, expectJsonOk, expectStatus, getJson, getPath, login, logout, wsToken } from './lib/rungis.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    'http_req_duration{endpoint:health}': ['p(95)<300'],
    'checks': ['rate>0.99']
  }
};

export default function () {
  group('public app shell', () => {
    const health = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health', role: 'public' } });
    expectJsonOk(health, 'health');

    const loginPage = getPath('/login', 'login-page');
    expectStatus(loginPage, 'login page');
  });

  group('client dashboard and APIs', () => {
    login('client');
    getPath('/dashboard', 'dashboard-page', 'client');
    getJson('/api/client/unpaid-reminders', 'client-unpaid-reminders', 'client');
    getJson('/api/client/find-vendors', 'client-find-vendors', 'client');
    wsToken('dashboard', 'client');
    logout('client');
  });

  group('vendor dashboard and APIs', () => {
    login('vendor');
    getPath('/dashboard', 'dashboard-page', 'vendor');
    getJson('/api/vendor/bills/overdue-unsettled', 'vendor-overdue-bills', 'vendor');
    getJson('/api/vendor/refunds/clients', 'vendor-refund-clients', 'vendor');
    getJson('/api/vendor/monthly-summary/clients', 'vendor-monthly-clients', 'vendor');
    getJson('/api/vendor/statistics/sales-by-category', 'vendor-statistics-category', 'vendor');
    getJson('/api/vendor/statistics/sales-by-client', 'vendor-statistics-client', 'vendor');
    wsToken('dashboard', 'vendor');
    logout('vendor');
  });

  group('admin dashboard and APIs', () => {
    login('admin');
    getPath('/admin', 'admin-page', 'admin');
    getJson('/api/admin/pending-users', 'admin-pending-users', 'admin');
    getJson('/api/admin/associations', 'admin-associations', 'admin');
    getJson('/api/admin/settings/bill-overdue-days', 'admin-bill-settings', 'admin');
    getJson('/api/admin/settings/app-style-profile', 'admin-style-settings', 'admin');
    getJson('/api/admin/statistics/activated-orders', 'admin-activated-orders', 'admin');
    wsToken('admin', 'admin');
    logout('admin');
  });

  sleep(1);
}
