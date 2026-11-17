import { useState } from 'react';

/** 可折叠的 JSON 树状查看器（带语法高亮，自动截断超长内容） */

const MAX_ITEMS = 100; // 每层最多展示的字段数
const MAX_STRING = 500; // 字符串最长展示字符数

function StringValue({ value }) {
  const truncated = value.length > MAX_STRING;
  const text = (truncated ? value.slice(0, MAX_STRING) : value).replace(/\n/g, '\\n');
  return (
    <span className="jv-string">
      &quot;{text}&quot;
      {truncated && <span className="jv-more"> …共 {value.length} 字符</span>}
    </span>
  );
}

function Collapsible({ value, depth }) {
  const isArray = Array.isArray(value);
  const [open, setOpen] = useState(depth < 1); // 默认展开第一层
  const keys = isArray ? null : Object.keys(value);
  const len = isArray ? value.length : keys.length;

  if (len === 0) return <span className="jv-punc">{isArray ? '[]' : '{}'}</span>;

  return (
    <span className="jv-collapsible">
      <span className="jv-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="jv-arrow">{open ? '▾' : '▸'}</span>
        <span className="jv-punc">{isArray ? '[' : '{'}</span>
        <span className="jv-count"> {len} 项 </span>
        <span className="jv-punc">{isArray ? ']' : '}'}</span>
      </span>
      {open ? (
        <div className="jv-children">
          {isArray
            ? value.slice(0, MAX_ITEMS).map((item, idx) => (
                <div key={idx} className="jv-row">
                  <span className="jv-index">{idx}</span>
                  <span className="jv-colon">: </span>
                  <JsonValue value={item} depth={depth + 1} />
                </div>
              ))
            : keys.slice(0, MAX_ITEMS).map((k) => (
                <div key={k} className="jv-row">
                  <span className="jv-key">{k}</span>
                  <span className="jv-colon">: </span>
                  <JsonValue value={value[k]} depth={depth + 1} />
                </div>
              ))}
          {len > MAX_ITEMS && <div className="jv-more">…还有 {len - MAX_ITEMS} 项</div>}
        </div>
      ) : (
        <span className="jv-more"> …</span>
      )}
    </span>
  );
}

function JsonValue({ value, depth }) {
  if (value === null) return <span className="jv-null">null</span>;
  const t = typeof value;
  if (t === 'string') return <StringValue value={value} />;
  if (t === 'number') return <span className="jv-number">{String(value)}</span>;
  if (t === 'boolean') return <span className="jv-boolean">{String(value)}</span>;
  if (t === 'object') return <Collapsible value={value} depth={depth} />;
  return <span className="jv-other">{String(value)}</span>;
}

export default function JsonViewer({ value }) {
  return (
    <div className="json-viewer">
      <JsonValue value={value} depth={0} />
    </div>
  );
}
