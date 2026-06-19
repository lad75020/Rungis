import ws from 'k6/ws';
import { check, group, sleep } from 'k6';
import { BASE_URL, WS_URL, login, logout, wsToken } from './lib/rungis.js';

export const options = {
  scenarios: {
    websocket_smoke: {
      executor: 'shared-iterations',
      vus: 3,
      iterations: 3,
      maxDuration: '20s'
    }
  },
  thresholds: {
    checks: ['rate>0.99'],
    ws_connecting: ['p(95)<1000'],
    ws_session_duration: ['p(95)<5000']
  }
};

const roles = ['client', 'vendor', 'admin'];

export default function () {
  const role = roles[(__VU + __ITER) % roles.length];
  const page = role === 'admin' ? 'admin' : 'dashboard';

  group(`${role} websocket welcome and ping`, () => {
    login(role);
    const token = wsToken(page, role);
    const url = `${WS_URL}/ws?token=${encodeURIComponent(token)}`;
    let welcomed = false;
    let ponged = false;

    const response = ws.connect(
      url,
      {
        headers: { Origin: BASE_URL },
        tags: { endpoint: 'websocket', role, page }
      },
      (socket) => {
        socket.on('open', () => {
          socket.send(JSON.stringify({ type: 'ping' }));
        });

        socket.on('message', (data) => {
          let payload;
          try {
            payload = JSON.parse(data);
          } catch (_error) {
            payload = { type: 'invalid' };
          }

          if (payload.type === 'welcome') {
            welcomed = payload.role === role && payload.page === page;
          }

          if (payload.type === 'pong') {
            ponged = true;
            socket.close();
          }
        });

        socket.setTimeout(() => {
          check(null, {
            [`${role} websocket welcome received`]: () => welcomed,
            [`${role} websocket pong received`]: () => ponged
          });
          socket.close();
        }, 3000);
      }
    );

    check(response, {
      [`${role} websocket upgraded`]: (r) => r && r.status === 101,
      [`${role} websocket welcome received`]: () => welcomed,
      [`${role} websocket pong received`]: () => ponged
    });

    logout(role);
  });

  sleep(1);
}
