/**
 * 开发模式（npm run dev）下没有扩展环境，
 * 用这些模拟数据来开发和预览界面效果。
 * 加载到 Chrome 后看到的是真实捕获的数据。
 */
const now = Date.now();
let seq = 0;
const nextId = () => `mock-${++seq}`;

function mk(partial) {
  return {
    id: nextId(),
    type: 'fetch',
    startTime: 0,
    wallTime: now - seq * 3000,
    reqHeaders: {},
    reqBody: null,
    resHeaders: {},
    resBody: null,
    duration: 100 + Math.round(Math.random() * 400),
    status: 200,
    statusText: 'OK',
    ...partial,
  };
}

export function makeMockRecords() {
  return [
    mk({
      method: 'GET',
      url: 'https://api.example.com/v1/users?page=1&size=20',
      resHeaders: { 'content-type': 'application/json; charset=utf-8', 'content-length': '1287' },
      resBody: JSON.stringify({
        code: 0,
        message: 'success',
        data: {
          list: [
            { id: 1, name: '张三', email: 'zhangsan@example.com', role: 'admin', active: true },
            { id: 2, name: '李四', email: 'lisi@example.com', role: 'editor', active: false },
          ],
          total: 2,
          page: 1,
          size: 20,
        },
      }),
      duration: 132,
    }),
    mk({
      method: 'POST',
      url: 'https://api.example.com/v1/auth/login',
      reqHeaders: { 'content-type': 'application/json' },
      reqBody: JSON.stringify({ username: 'zhangsan', password: '******', remember: true }),
      resBody: JSON.stringify({
        code: 0,
        message: 'success',
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjF9.abc123',
          user: { id: 1, name: '张三', role: 'admin' },
        },
      }),
      duration: 286,
    }),
    mk({
      method: 'GET',
      url: 'https://api.example.com/v1/orders/12345',
      status: 404,
      statusText: 'Not Found',
      resBody: JSON.stringify({ code: 404, message: '订单不存在', data: null }),
      duration: 45,
    }),
    mk({
      method: 'PUT',
      url: 'https://api.example.com/v1/users/2',
      reqBody: JSON.stringify({ name: '李四', role: 'admin' }),
      status: 500,
      statusText: 'Internal Server Error',
      resHeaders: { 'content-type': 'text/html; charset=utf-8' },
      resBody: '<html><body><h1>500 Internal Server Error</h1></body></html>',
      duration: 512,
    }),
    mk({
      type: 'xhr',
      method: 'DELETE',
      url: 'https://api.example.com/v1/sessions/current',
      status: 204,
      statusText: 'No Content',
      resBody: '',
      duration: 88,
    }),
    mk({
      method: 'GET',
      url: 'https://api.example.com/v1/health',
      resBody: JSON.stringify({ status: 'up', uptime: 86400, version: '1.2.3' }),
      duration: 12,
    }),
    mk({
      method: 'GET',
      url: 'https://api.example.com/v1/reports?type=monthly&year=2026',
      status: 0,
      statusText: '',
      error: 'Failed to fetch',
      duration: 30000,
    }),
    mk({
      method: 'POST',
      url: 'https://api.example.com/v1/reports/export',
      reqBody: JSON.stringify({ format: 'xlsx', range: '2026-01~2026-10' }),
      status: null,
      statusText: null,
      duration: null,
      resBody: null,
    }),
  ];
}
