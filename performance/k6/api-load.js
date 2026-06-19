import { group, sleep } from 'k6';
import { getJson, login, logout, wsToken } from './lib/rungis.js';

export const options = {
  scenarios: {
    authenticated_api_mix: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.K6_RAMP_UP || '10s', target: Number(__ENV.K6_TARGET_VUS || 5) },
        { duration: __ENV.K6_STEADY_STATE || '20s', target: Number(__ENV.K6_TARGET_VUS || 5) },
        { duration: __ENV.K6_RAMP_DOWN || '10s', target: 0 }
      ],
      gracefulRampDown: '5s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(90)<750', 'p(95)<1500', 'p(99)<3000'],
    'http_req_duration{endpoint:login}': ['p(95)<2500'],
    'checks': ['rate>0.98']
  }
};

const roleFlow = [
  ['client', clientFlow],
  ['vendor', vendorFlow],
  ['admin', adminFlow]
];

export default function () {
  const [role, flow] = roleFlow[(__VU + __ITER) % roleFlow.length];

  group(`${role} authenticated API flow`, () => {
    login(role);
    flow();
    wsToken(role === 'admin' ? 'admin' : 'dashboard', role);
    logout(role);
  });

  sleep(Math.random() * 1.5 + 0.5);
}

function clientFlow() {
  getJson('/api/client/unpaid-reminders', 'client-unpaid-reminders', 'client');
  getJson('/api/client/find-vendors', 'client-find-vendors', 'client');
}

function vendorFlow() {
  getJson('/api/vendor/bills/overdue-unsettled', 'vendor-overdue-bills', 'vendor');
  getJson('/api/vendor/refunds/clients', 'vendor-refund-clients', 'vendor');
  getJson('/api/vendor/monthly-summary/clients', 'vendor-monthly-clients', 'vendor');
  getJson('/api/vendor/statistics/sales-by-category', 'vendor-statistics-category', 'vendor');
  getJson('/api/vendor/statistics/sales-by-client', 'vendor-statistics-client', 'vendor');
}

function adminFlow() {
  getJson('/api/admin/pending-users', 'admin-pending-users', 'admin');
  getJson('/api/admin/associations', 'admin-associations', 'admin');
  getJson('/api/admin/settings/bill-overdue-days', 'admin-bill-settings', 'admin');
  getJson('/api/admin/settings/app-style-profile', 'admin-style-settings', 'admin');
  getJson('/api/admin/statistics/activated-orders', 'admin-activated-orders', 'admin');
}
