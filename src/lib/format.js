/** 展示相关的格式化工具函数 */

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms) {
  if (ms == null) return '…';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

/** 把 URL 里的 query 参数解析成 [key, value] 数组 */
export function parseQuery(url) {
  try {
    const u = new URL(url);
    const pairs = [];
    u.searchParams.forEach((value, key) => pairs.push([key, value]));
    return pairs;
  } catch (e) {
    return [];
  }
}

/** 尝试把文本解析成 JSON，返回 { ok, value } */
export function tryParseJson(text) {
  if (typeof text !== 'string') return { ok: true, value: text };
  const t = text.trim();
  if (!t) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (e) {
    return { ok: false };
  }
}

/** 估算请求/响应体大小（优先用 content-length 响应头） */
export function bodySize(record) {
  const contentLength = record.resHeaders && record.resHeaders['content-length'];
  if (contentLength) {
    const n = parseInt(contentLength, 10);
    if (Number.isFinite(n)) return n;
  }
  const body = record.resBody != null ? record.resBody : record.reqBody;
  if (body == null) return 0;
  try {
    return new TextEncoder().encode(String(body)).length;
  } catch (e) {
    return String(body).length;
  }
}

export function statusCategory(status) {
  if (status == null) return 'pending';
  if (status === 0) return 'error';
  if (status < 200) return 'info';
  if (status < 300) return 'success';
  if (status < 400) return 'redirect';
  if (status < 500) return 'client-error';
  return 'server-error';
}

export const STATUS_COLORS = {
  pending: '#8e8e93',
  error: '#ff453a',
  info: '#64d2ff',
  success: '#32d74b',
  redirect: '#0a84ff',
  'client-error': '#ff9f0a',
  'server-error': '#ff453a',
};

export const METHOD_COLORS = {
  GET: '#32d74b',
  POST: '#0a84ff',
  PUT: '#ff9f0a',
  PATCH: '#bf5af2',
  DELETE: '#ff453a',
  OPTIONS: '#8e8e93',
  HEAD: '#8e8e93',
  CONNECT: '#8e8e93',
  TRACE: '#8e8e93',
};
