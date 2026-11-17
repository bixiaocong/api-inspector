/**
 * API Inspector — Background Service Worker
 *
 * 作用：
 *   1. 接收各页面传来的请求/响应数据，按 tabId 存储（每个 tab 最多 1000 条）；
 *   2. 通过 Port 把新数据实时推送给侧边栏面板；
 *   3. 响应面板的查询 / 清空 / 暂停指令。
 */
const MAX_RECORDS_PER_TAB = 1000;

const recordsByTab = new Map(); // tabId -> record[]
const panelPorts = new Set(); // 已连接的侧边栏面板
let paused = false;

function broadcast(message) {
  for (const port of panelPorts) {
    try {
      port.postMessage(message);
    } catch (e) {}
  }
}

// 点击工具栏图标直接打开侧边栏
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
} catch (e) {}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;

  switch (message.type) {
    case 'record': {
      if (paused) return;
      const tabId = sender.tab && sender.tab.id;
      if (tabId == null) return;

      let list = recordsByTab.get(tabId);
      if (!list) {
        list = [];
        recordsByTab.set(tabId, list);
      }

      if (message.kind === 'request') {
        list.push(message.data);
        if (list.length > MAX_RECORDS_PER_TAB) {
          list.splice(0, list.length - MAX_RECORDS_PER_TAB);
        }
        broadcast({ type: 'push', tabId, record: message.data });
      } else if (message.kind === 'response') {
        // 响应到达：按 id 找到请求记录，合并进去
        const target = list.find((r) => r.id === message.data.id);
        if (target) {
          Object.assign(target, message.data);
          broadcast({ type: 'update', tabId, record: target });
        }
      }
      break;
    }

    case 'get-records':
      sendResponse({ records: recordsByTab.get(message.tabId) || [] });
      break;

    case 'clear':
      recordsByTab.delete(message.tabId);
      broadcast({ type: 'cleared', tabId: message.tabId });
      sendResponse({ ok: true });
      break;

    case 'set-paused':
      paused = !!message.value;
      sendResponse({ ok: true, paused });
      break;

    case 'get-paused':
      sendResponse({ paused });
      break;
  }
});

// 标签页关闭后清理数据，防止内存泄漏
chrome.tabs.onRemoved.addListener((tabId) => {
  recordsByTab.delete(tabId);
});
