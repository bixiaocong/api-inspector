import { useState } from 'react';
import JsonViewer from './JsonViewer.jsx';
import KeyValueTable from './KeyValueTable.jsx';
import {
  METHOD_COLORS,
  STATUS_COLORS,
  bodySize,
  formatBytes,
  formatDuration,
  formatTime,
  parseQuery,
  statusCategory,
  tryParseJson,
} from '../lib/format.js';

const TABS = [
  { key: 'params', label: '请求参数' },
  { key: 'reqHeaders', label: '请求头' },
  { key: 'resHeaders', label: '响应头' },
  { key: 'resBody', label: '返回值' },
];

/** 文本内容：能解析成 JSON 就显示树，否则显示原文 */
function BodyOrText({ text, fallback }) {
  const parsed = tryParseJson(text);
  if (parsed.ok) return <JsonViewer value={parsed.value} />;
  if (text == null || text === '') return <div className="kv-empty">{fallback || '（无）'}</div>;
  return <pre className="body-text">{String(text)}</pre>;
}

export default function DetailPanel({ record, onBack }) {
  const [tab, setTab] = useState('params');
  const [copied, setCopied] = useState(false);
  if (!record) return null;

  const cat = statusCategory(record.status);
  const queryPairs = parseQuery(record.url);

  const copyResBody = async () => {
    if (record.resBody == null) return;
    try {
      await navigator.clipboard.writeText(String(record.resBody));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      /* ignore */
    }
  };

  return (
    <div className="detail">
      <div className="detail-head">
        <button className="back-btn" onClick={onBack}>
          ← 返回列表
        </button>
      </div>

      <div className="detail-summary">
        <span
          className="method-badge"
          style={{ backgroundColor: METHOD_COLORS[record.method] || '#8e8e93' }}
        >
          {record.method}
        </span>
        <span className="status" style={{ color: STATUS_COLORS[cat] }}>
          {record.status == null
            ? '等待响应'
            : record.error
              ? `失败：${record.error}`
              : `${record.status} ${record.statusText || ''}`}
        </span>
        <span className="summary-meta">
          {record.type} · {formatDuration(record.duration)} · {formatBytes(bodySize(record))} ·{' '}
          {formatTime(record.wallTime)}
        </span>
      </div>
      <div className="detail-url" title={record.url}>
        {record.url}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'params' && (
          <>
            <div className="section-title">Query 参数</div>
            <KeyValueTable entries={queryPairs} emptyText="无 Query 参数" />
            <div className="section-title">请求体 (Body)</div>
            <BodyOrText text={record.reqBody} fallback="无请求体" />
          </>
        )}
        {tab === 'reqHeaders' && (
          <>
            <div className="section-title">请求头</div>
            <KeyValueTable entries={Object.entries(record.reqHeaders || {})} emptyText="无请求头" />
          </>
        )}
        {tab === 'resHeaders' && (
          <>
            <div className="section-title">响应头</div>
            <KeyValueTable entries={Object.entries(record.resHeaders || {})} emptyText="无响应头" />
          </>
        )}
        {tab === 'resBody' && (
          <>
            <div className="section-title">
              返回值
              <button className="copy-btn" onClick={copyResBody} disabled={record.resBody == null}>
                {copied ? '已复制 ✓' : '复制'}
              </button>
            </div>
            {record.error ? (
              <div className="error-block">请求失败：{record.error}</div>
            ) : record.status == null ? (
              <div className="kv-empty">等待响应中…</div>
            ) : (
              <BodyOrText text={record.resBody} fallback="无响应体（如 204）" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
