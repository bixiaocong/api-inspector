# 第 4 课：打通全链路（20 分钟）★核心课

## 本课目标

做一个小号"接口面板"：在实验页面上点按钮发请求，**弹窗里实时显示**页面里的秘密变量和请求次数。

学到的概念（本课是全部课程的核心）：
- **为什么需要注入脚本**：content script 读不到页面变量（第 3 课已验证），必须派"间谍"进页面世界
- **postMessage**：页面世界 ↔ 隔离世界之间的消息通道
- **chrome.runtime.sendMessage**：content script ↔ 后台之间的消息通道
- **background**：常驻后台的数据中心

## 完整链路图

```
实验页面 (MAIN world)
  window.secret = '面试通过'  ← 普通脚本读不到它
  fetch(...)                  ← Hook 它才能数请求
        │
        │ ① window.postMessage      （间谍 injected.js 发情报）
        ▼
content script (ISOLATED world)
        │ ② chrome.runtime.sendMessage（外勤转发情报）
        ▼
background service worker（总部，存数据）
        │ ③ popup 来问就回答
        ▼
popup（前台界面，展示数据）
```

## 文件（7 个）

### `manifest.json` —— 本课信息量最大，逐段看

```json
{
  "manifest_version": 3,
  "name": "04 打通消息链路",
  "version": "1.0",
  "permissions": ["storage"],
  "background": { "service_worker": "background.js" },   // ← 声明"总部"员工
  "action": { "default_popup": "popup.html" },            // ← 声明"前台"界面
  "content_scripts": [                                     // ← 声明"外勤"员工
    { "matches": ["<all_urls>"], "js": ["content.js"], "run_at": "document_start" }
  ],
  "web_accessible_resources": [                            // ← 给"间谍"发通行证
    { "resources": ["injected.js"], "matches": ["<all_urls>"] }
  ]
}
```

**重点**：`web_accessible_resources` 是通行证。没有它，content script 无法把 `injected.js` 注入页面——这是新手最容易漏的配置。

### `background.js` —— 总部：收情报、存数据、回答问题

```js
// 数据中心：popup 随时来问，这里都有
let state = {
  secret: '（还没收到页面的消息）',
  fetchCount: 0,
  lastFetchUrl: '',
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'page-data') {
    // 外勤转发来的情报
    const d = message.data || {};
    if (d.secret) state.secret = d.secret;
    if (d.fetchUrl) {
      state.fetchCount += 1;
      state.lastFetchUrl = d.fetchUrl;
    }
  } else if (message.type === 'get-data') {
    // 前台来问数据，直接回答
    sendResponse(state);
  }
});
```

### `content.js` —— 外勤：派间谍 + 转发情报

```js
// ① 把间谍脚本注入页面真实世界
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// ② 接收间谍的 postMessage 情报，转发给总部
window.addEventListener('message', (event) => {
  if (event.source !== window) return;          // 只收本页面的消息
  const msg = event.data;
  if (!msg || msg.source !== 'lesson04') return; // 只认自己的暗号
  chrome.runtime.sendMessage({ type: 'page-data', data: msg.data }).catch(() => {});
});
```

### `injected.js` —— 间谍：在页面世界里偷情报

```js
(() => {
  if (window.__lesson04Done__) return; // 防止注入两次
  window.__lesson04Done__ = true;

  function send(data) {
    window.postMessage({ source: 'lesson04', data }, '*');
  }

  // 情报 1：页面的秘密变量（等页面脚本跑完再读）
  function reportSecret() {
    send({ secret: window.secret || '（这个页面没有 window.secret）' });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reportSecret);
  } else {
    reportSecret();
  }

  // 页面主动通知"秘密变了"
  window.addEventListener('lesson04-secret-change', reportSecret);

  // 情报 2：Hook fetch，数一下页面发了几个请求
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    send({ fetchUrl: String(args[0]) });
    return origFetch.apply(this, args); // 原样执行，页面业务无感知
  };
})();
```

### `popup.html` + `popup.js` —— 前台：展示数据

```html
<body style="width: 280px; padding: 12px; font-family: sans-serif;">
  <h3>链路数据</h3>
  <p>页面的秘密：<b id="secret"></b></p>
  <p>fetch 次数：<b id="count"></b></p>
  <p>最后一次请求：<b id="url"></b></p>
  <script src="popup.js"></script>
</body>
```

```js
function refresh() {
  chrome.runtime.sendMessage({ type: 'get-data' }, (state) => {
    if (!state) return;
    document.getElementById('secret').textContent = state.secret;
    document.getElementById('count').textContent = state.fetchCount;
    document.getElementById('url').textContent = state.lastFetchUrl || '（无）';
  });
}
refresh();
setInterval(refresh, 1000); // 每秒问一次总部
```

### `test-page.html` —— 实验页面（模拟一个真实网站）

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>实验页面</title></head>
<body>
  <h1>这是实验页面</h1>
  <p>页面里的秘密变量：<b id="secret-display"></b></p>
  <button id="btn-change">把秘密改成「面试通过」</button>
  <button id="btn-fetch">发一个 fetch 请求</button>
  <script>
    window.secret = '初始秘密';
    document.getElementById('secret-display').textContent = window.secret;
    document.getElementById('btn-change').addEventListener('click', () => {
      window.secret = '面试通过';
      document.getElementById('secret-display').textContent = window.secret;
      window.dispatchEvent(new CustomEvent('lesson04-secret-change')); // 通知间谍
    });
    document.getElementById('btn-fetch').addEventListener('click', () => {
      fetch('https://jsonplaceholder.typicode.com/todos/1')
        .then((r) => r.json())
        .then((data) => console.log('拿到数据:', data));
    });
  </script>
</body>
</html>
```

## 操作步骤

1. 加载 `04-worlds-messaging` 文件夹
2. 用 Chrome 打开 `test-page.html`：直接把文件拖进 Chrome 窗口，或 `Cmd+O` 选择文件
3. 到 `chrome://extensions` → 本插件「详细信息」→ 打开「**允许访问文件网址**」开关（因为实验页面是本地文件，不打开这个开关插件不会注入）
4. **刷新实验页面**
5. 点插件图标打开弹窗，应该看到：秘密 = 初始秘密
6. 在实验页点「把秘密改成面试通过」→ 回弹窗看：变了！
7. 点「发一个 fetch 请求」→ 回弹窗看：次数 +1，URL 显示了
8. 实验：把实验页的 fetch 按钮多点几次，观察弹窗数字

## ✅ 检查点

- [ ] 弹窗能看到页面的秘密变量（这说明间谍成功打入了页面世界）
- [ ] 点请求按钮后，弹窗的计数和 URL 更新
- [ ] 关掉弹窗再打开，数据还在（说明数据存在 background 总部）

## 🔬 关键实验

在 `content.js` 里加一行 `console.log('外勤直接读秘密:', window.secret);`，刷新页面看日志——**是 undefined**。对比弹窗里却能显示秘密。想明白这个对比，就真正理解了为什么需要注入脚本。

## 💪 小练习

1. 让间谍顺便报告 `document.title`（网页标题），弹窗里显示出来
2. 把 fetch Hook 升级：不只记 URL，也记响应状态码（提示：`origFetch(...).then(res => ...)`，记得把 promise 原样 return 给页面）

## 常见问题

**Q：弹窗一直显示"还没收到页面的消息"？**
A：按顺序排查：① 实验页面刷新了吗？② 「允许访问文件网址」开了吗？③ 插件刷新后，实验页面有没有重新刷新？

**Q：background 报错或数据不更新？**
A：在 `chrome://extensions` 点插件的「Service Worker」链接看总部日志。
