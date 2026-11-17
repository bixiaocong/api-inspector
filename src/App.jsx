import { useEffect, useMemo, useRef, useState } from 'react';
import RequestList from './components/RequestList.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import { makeMockRecords } from './lib/mock.js';
import { statusCategory } from './lib/format.js';

// 只有扩展环境里 chrome.runtime.id 才存在；
// npm run dev 打开普通网页时用它来切换模拟数据
const isExtensionContext =
  typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

export default function App() {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paused, setPaused] = useState(false);
  const [tabInfo, setTabInfo] = useState(null);
  const [ready, setReady] = useState(false);

  const tabIdRef = useRef(null);

  useEffect(() => {
    if (!isExtensionContext) {
      // 开发模式：展示模拟数据
      setRecords(makeMockRecords());
      setReady(true);
      return;
    }

    let disposed = false;
    let port = null;

    const applyMessage = (msg) => {
      if (!msg || msg.tabId !== tabIdRef.current) return;
      if (msg.type === 'push') setRecords((prev) => [...prev, msg.record]);
      else if (msg.type === 'update')
        setRecords((prev) =>
          prev.map((r) => (r.id === msg.record.id ? { ...r, ...msg.record } : r))
        );
      else if (msg.type === 'cleared') setRecords([]);
    };

    const refresh = async () => {
      try {
        const win = await chrome.windows.getCurrent();
        const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
        const tab = tabs && tabs[0];
        if (!tab || tab.id == null || disposed) return;
        tabIdRef.current = tab.id;
        setTabInfo({ id: tab.id, title: tab.title, url: tab.url });
        const res = await chrome.runtime
          .sendMessage({ type: 'get-records', tabId: tab.id })
          .catch(() => null);
        if (res && !disposed) setRecords(res.records || []);
        const p = await chrome.runtime.sendMessage({ type: 'get-paused' }).catch(() => null);
        if (p && !disposed) setPaused(!!p.paused);
      } catch (e) {
        /* ignore */
      } finally {
        if (!disposed) setReady(true);
      }
    };

    const onActivated = () => refresh();
    const onUpdated = (tabId, changeInfo) => {
      if (tabId === tabIdRef.current && changeInfo.status === 'complete') refresh();
    };

    port = chrome.runtime.connect({ name: 'panel' });
    port.onMessage.addListener(applyMessage);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    refresh();

    return () => {
      disposed = true;
      if (port) port.disconnect();
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    if (isExtensionContext)
      chrome.runtime.sendMessage({ type: 'set-paused', value: next }).catch(() => {});
  };

  const clearRecords = () => {
    setRecords([]);
    setSelectedId(null);
    if (isExtensionContext && tabIdRef.current != null)
      chrome.runtime.sendMessage({ type: 'clear', tabId: tabIdRef.current }).catch(() => {});
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
      if (statusFilter !== 'ALL' && statusCategory(r.status) !== statusFilter) return false;
      if (search && !r.url.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, search, methodFilter, statusFilter]);

  const selectedRecord = selectedId ? records.find((r) => r.id === selectedId) || null : null;

  // 浏览器内置页面（chrome:// 等）没有 content script，无法捕获
  const isUncapturable =
    !!tabInfo &&
    /^(chrome|edge|about|devtools|chrome-extension|view-source):/.test(tabInfo.url || '');

  if (!ready) {
    return (
      <div className="app">
        <div className="empty">加载中…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="title">
          <h1>API Inspector</h1>
          <span className="count">{records.length} 个请求</span>
        </div>
        <div className="actions">
          <button
            className={`btn ${paused ? 'active' : ''}`}
            onClick={togglePause}
            title={paused ? '恢复捕获' : '暂停捕获'}
          >
            {paused ? '▶ 继续' : '⏸ 暂停'}
          </button>
          <button className="btn" onClick={clearRecords}>
            清空
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input
          className="search"
          placeholder="搜索 URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="ALL">全部方法</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">全部状态</option>
          <option value="success">2xx 成功</option>
          <option value="redirect">3xx 重定向</option>
          <option value="client-error">4xx 客户端错误</option>
          <option value="server-error">5xx 服务端错误</option>
          <option value="error">网络错误</option>
          <option value="pending">等待响应</option>
        </select>
      </div>

      {!isExtensionContext && (
        <div className="dev-banner">
          开发模式：当前展示的是模拟数据。执行 npm run build 并把 dist 加载到 Chrome 后，即可捕获真实请求。
        </div>
      )}

      {tabInfo && isExtensionContext && (
        <div className="tab-banner" title={tabInfo.url}>
          {tabInfo.title}
        </div>
      )}

      <main className="content">
        {selectedRecord ? (
          <DetailPanel
            key={selectedRecord.id}
            record={selectedRecord}
            onBack={() => setSelectedId(null)}
          />
        ) : filtered.length > 0 ? (
          <RequestList records={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <div className="empty">
            {records.length === 0
              ? isUncapturable
                ? '当前页面是浏览器内置页，无法捕获请求。请切换到普通网页。'
                : '还没有捕获到请求。操作一下页面（点击、刷新、登录…），接口请求就会实时出现在这里。'
              : '没有符合筛选条件的请求'}
          </div>
        )}
      </main>
    </div>
  );
}
