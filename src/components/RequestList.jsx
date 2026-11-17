import {
  METHOD_COLORS,
  STATUS_COLORS,
  bodySize,
  formatBytes,
  formatDuration,
  formatTime,
  statusCategory,
} from '../lib/format.js';

/** 列表里只展示 pathname+search，完整 URL 放在 title 里悬停查看 */
function displayUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search || '/';
  } catch (e) {
    return url;
  }
}

export default function RequestList({ records, selectedId, onSelect }) {
  return (
    <div className="request-list">
      {records.map((r) => (
        <div
          key={r.id}
          className={`request-item ${selectedId === r.id ? 'active' : ''}`}
          onClick={() => onSelect(r.id)}
        >
          <span
            className="method-badge"
            style={{ backgroundColor: METHOD_COLORS[r.method] || '#8e8e93' }}
          >
            {r.method}
          </span>
          <span className="status" style={{ color: STATUS_COLORS[statusCategory(r.status)] }}>
            {r.status == null ? '…' : r.status || 'ERR'}
          </span>
          <div className="url-block">
            <div className="url" title={r.url}>
              {displayUrl(r.url)}
            </div>
            <div className="meta">
              {r.type} · {formatTime(r.wallTime)} · {formatDuration(r.duration)} ·{' '}
              {formatBytes(bodySize(r))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
