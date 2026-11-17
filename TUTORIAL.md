# 浏览器插件开发教程：以「API Inspector 接口面板」为例

> 本教程基于本仓库 `api-inspector` 项目的真实代码，从零讲清楚：
> 1. 浏览器插件的基本概念
> 2. 本项目实际做的每一步
> 3. 面试时如何讲清楚

---

## 第一部分：浏览器插件是什么

一个浏览器插件 = 一个 `manifest.json` + 一堆角色不同的脚本。核心角色只有 4 类：

| 角色 | 运行位置 | 能做什么 | 本项目对应文件 |
|---|---|---|---|
| **Background Service Worker** | 浏览器后台（无页面） | 常驻逻辑、数据中心、权限 API | `public/background.js` |
| **Content Script** | 每个网页里（ISOLATED world） | 访问页面 DOM、与页面通信 | `public/content.js` |
| **UI 页面**（popup / side panel / devtools / options） | 独立窗口 | 界面展示 | `sidepanel.html` + `src/**` |
| **注入脚本**（MAIN world） | 页面自己的 JS 世界 | Hook 页面真实的 `fetch`/`XHR` | `public/injected.js` |

### 必须理解的关键概念

**1. ISOLATED world vs MAIN world（本项目最核心的概念）**

Chrome 给 content script 造了一个「隔离世界」：它能看到页面的 DOM，但 JS 对象和页面是隔离的。

```
页面世界 (MAIN world)          隔离世界 (ISOLATED world)
─────────────────────          ─────────────────────────
window.fetch  ← 真实的 fetch     window.fetch ← 一个"影子"
window.XHR                      window.XHR
页面自己的变量                   插件自己的变量
     ↑ 两个世界互不共享变量，但共享同一个 DOM
```

这意味着：**在 content script 里 Hook `window.fetch` 是抓不到页面请求的**——因为页面代码用的是它自己世界里的 fetch。解决办法是把 Hook 脚本用 `<script src>` 标签真正注入进页面世界，这就是 `injected.js` 存在的全部理由。

**2. 两个世界怎么通信？—— `window.postMessage`**

两个世界共享同一个 `window` 对象，`postMessage` 就成了它们之间的消息总线：

```js
// MAIN world（injected.js）：发消息
window.postMessage({ source: 'api-inspector', kind: 'request', data }, '*');

// ISOLATED world（content.js）：收消息
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (msg.source !== 'api-inspector') return; // 只认自己的消息
  ...
});
```

**3. 扩展内部的通信：短连接 + 长连接**

- `chrome.runtime.sendMessage`：一次性问答（面板启动时查历史记录）
- `chrome.runtime.connect`（Port）：长连接管道（background 实时推送新请求）
- 两者都不受页面跨域限制——扩展有自己的权限体系

---

## 第二部分：本项目做了什么（方案选型，面试重点）

### 需求

> 把页面上所有接口的**地址、参数、返回值**集中展示在一个面板里，不用在 Network 的多个标签页之间切来切去。

### 三个技术决策（每个决策都对比过备选方案）

**决策 1：怎么捕获请求？**

| 方案 | 能拿到什么 | 缺陷 | 结论 |
|---|---|---|---|
| `chrome.webRequest` | URL、请求头、POST 参数 | **拿不到响应体**，不满足需求 | ❌ |
| `chrome.debugger`（CDP） | 全部信息，含静态资源 | 浏览器顶部常驻「正在调试此浏览器」警告条 | ❌ |
| **注入 Hook `fetch`/`XHR`** | 地址、参数、完整返回值 | 静态资源（img/css）和页面 SW 内的请求抓不到 | ✅ 采用 |

关键判断：**接口请求几乎 100% 走 fetch 或 XHR**，所以 Hook 方案的"缺陷"对目标场景无影响，还换来了无警告、零权限开销。

**决策 2：UI 放哪里？**

popup 点一下就没、太窄；devtools panel 必须先开 F12；**side panel（Chrome 114+）可以常驻在页面右侧**，符合"一边操作页面一边看接口"的场景。

**决策 3：数据怎么流到 UI？**

```
页面(MAIN) --postMessage--> content(ISOLATED) --runtime.sendMessage--> background --Port推送--> 侧边栏(React)
```

请求记录和响应记录**分两条消息发出**，background 里按自增 id 合并成一条完整记录——这就是"列表里实时冒出新请求，然后状态从'…'变成 200"的原理。

---

## 第三部分：开发步骤（本项目实际做的 4 步）

### Step 1：项目骨架

- Vite + React 构建 UI；`base: './'` 让资源用相对路径（chrome-extension:// 页面的硬性要求）
- `public/` 目录放三个纯 JS 脚本（background/content/injected），Vite 原样拷贝、不打包——**刻意避开 ESM 问题**（MV3 的 content script 不支持 `type: module`，让 Vite 打包会引入 import 语句导致加载失败）
- `manifest.json` 关键配置：

```json
{
  "manifest_version": 3,
  "permissions": ["sidePanel", "tabs"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_start",   // 页面脚本执行前就位，尽量少漏请求
    "all_frames": true            // iframe 里的请求也要抓
  }],
  "web_accessible_resources": [{ "resources": ["injected.js"], "matches": ["<all_urls>"] }]
}
```

**踩坑**：`web_accessible_resources` 不声明，content script 无法用 `chrome.runtime.getURL('injected.js')` 注入脚本。

### Step 2：捕获引擎（三条消息管道）

**injected.js — Hook 两个 API：**

```js
// fetch：包装。读请求体放异步里，不阻塞页面真正发出请求
const origFetch = window.fetch;
window.fetch = function (input, init) {
  const id = nextId();
  // 异步读取请求头/请求体（req.clone() 不影响原请求）
  (async () => {
    const req = new Request(input, init);
    const body = await req.clone().text();  // ← 请求体必须 clone
    post('request', { id, method: req.method, url: req.url, ... });
  })();
  // 响应：clone 一份读 body，原 response 原样返回给页面
  return origFetch.apply(this, arguments).then(async (response) => {
    const body = await response.clone().text(); // ← 响应体必须 clone
    post('response', { id, status: response.status, body, ... });
    return response; // 页面业务无感知
  });
};

// XHR：改原型链。open 记 method/url，setRequestHeader 记请求头，
// send 里监听 loadend（成功/失败/abort 统一收口）读 this.responseText
```

**四个必须讲出来的细节（面试加分项）：**

1. **`clone()` 是灵魂**——fetch 的 body 是流，只能读一次；不 clone 就把页面业务的响应体消费掉了，这是此类工具最容易翻车的坑。
2. **请求和响应分两条消息**，background 按 id 合并，所以界面能看到「等待中 → 完成」的实时变化。
3. **XHR 用 `loadend` 而不是 `load`**——网络错误、abort 时 `load` 不触发，会丢记录。
4. **200KB 截断 + 每 tab 1000 条上限**——防止超大响应或长会话拖垮内存。

**content.js — 只做两件事：** 注入 `injected.js`；监听 `postMessage` 转发给 background。注意用 `event.source !== window` 过滤消息来源。

**background.js — 数据中心：**

```js
const recordsByTab = new Map();  // tabId -> record[]（多标签页互不干扰）
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.kind === 'request') {
    list.push(message.data);                 // 新请求：push + 广播
    broadcast({ type: 'push', record });
  } else if (message.kind === 'response') {
    const target = list.find(r => r.id === message.data.id);
    Object.assign(target, message.data);     // 响应到达：按 id 合并 + 广播
    broadcast({ type: 'update', record: target });
  }
});
```

### Step 3：React 侧边栏

- **列表**：方法彩色徽章（GET 绿/POST 蓝/DELETE 红）、状态码按类别着色、耗时/大小/时间
- **详情四标签页**：请求参数（Query + Body）/ 请求头 / 响应头 / 返回值
- **JSON 树组件（0 依赖自己写）**：返回文本先尝试 `JSON.parse`，成功就渲染可折叠、带语法高亮的树；失败就渲染原文。性能保护：每层最多 100 个字段、字符串超 500 字符截断、默认只展开第一层
- **与 background 通信**：启动时 `connect({ name: 'panel' })` 建长连接收推送 + `sendMessage` 拉历史；监听 `tabs.onActivated`/`onUpdated`，切标签页自动切换数据
- **开发模式模拟数据**：检测 `chrome.runtime.id`（只有扩展环境才有），普通网页里跑 `npm run dev` 就用内置假数据预览界面

### Step 4：联调与验证

- `npm run build` → `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `dist`
- 真实页面点击、刷新、登录，验证列表实时刷新、详情四个标签、筛选搜索
- 检查边界：iframe 请求、SPA 路由切换（Hook 挂在 window 上，天然覆盖）、网络错误（status 0 + 错误信息）

---

## 第四部分：面试怎么讲清楚

### 建议话术结构（总 5 分钟）

**1. 一句话开场（30 秒）——先说痛点再说方案**

> "我做了一个 Chrome 插件，解决我日常开发的痛点：看接口必须开 DevTools 的 Network，而且请求头、参数、返回值分散在好几个标签页里来回切。这个插件把页面上所有接口的地址、参数、返回值，实时集中展示在浏览器右侧的一个侧边栏里。"

**2. 架构（2 分钟）——画一条链路，每层说出「为什么存在」**

```
页面 Hook fetch/XHR → postMessage → content script → runtime消息 → background → Port推送 → React侧边栏
```

每层的存在理由：
- **注入脚本要在页面世界（MAIN world）**：content script 是隔离世界，Hook 它的 fetch 是影子，抓不到真实请求
- **content script**：页面和扩展后台之间唯一的合法桥梁
- **background**：按 tabId 存储的数据中心，多标签页隔离，1000 条上限防爆
- **Port 长连接**：实时推送；sendMessage 只用于启动时拉历史

**3. 主动抛出 3 个亮点（90 秒）——别等面试官问**

1. **`response.clone()` 读响应体**——body 是流只能读一次，不 clone 会破坏页面业务，这是这类工具最容易翻车的地方，我提前规避了
2. **双 Hook 全覆盖**：fetch 用包装，XHR 改原型链（open/setRequestHeader/send），`loadend` 统一收口包括网络错误和 abort 的场景
3. **性能保护**：响应体 200KB 截断、列表 1000 条上限、JSON 树懒展开 + 每层 100 字段上限，200KB 的 JSON 也不会卡

**4. 收尾（30 秒）——拔高**

> "本质上这是一个分布式数据采集问题：采集端（页面 Hook）、传输层（postMessage + runtime 双通道）、存储端（SW 内存 Map）、展示端（React）四层解耦，事件驱动，任何一层都可以独立替换。"

### 常见追问与应对

| 追问 | 应对思路 |
|---|---|
| **为什么不用 webRequest？** | 它只能拿请求侧信息（URL、头、POST 参数），**拿不到响应体**，不满足"展示返回值"的需求；debugger 能拿全但有常驻警告条，体验差；Hook fetch/XHR 对接口场景覆盖 100% |
| **会漏请求吗？** | 诚实说边界：静态资源（img/css）、页面 Service Worker 内发的请求抓不到——但接口请求几乎都走 fetch/XHR；另外插件加载前的请求也抓不到。这是方案取舍，不是 bug |
| **SPA 路由切换能抓到吗？** | 能。Hook 挂在 window 对象上，路由切换不刷新页面，函数引用始终有效 |
| **请求和响应怎么配对？** | 自增 id（加 frame 随机前缀防 iframe 撞车），请求先入库，响应到达按 id 合并，界面就能看到"等待中→完成"的实时状态变化 |
| **Service Worker 被回收了怎么办？** | MV3 的 SW 会被休眠：面板连着 Port 时 SW 保活；未来用 `chrome.storage.session` 做持久化兜底（已列入迭代计划） |
| **跨域怎么处理？** | 插件不受页面跨域限制：content script 匹配 `<all_urls>`，注入脚本通过 `web_accessible_resources` 白名单加载 |
| **MV2 和 MV3 的区别？** | 后台从常驻 background page 变成可休眠的 Service Worker；禁止远程代码和 eval；`webRequest` 的拦截能力被 `declarativeNetRequest` 取代；引入了 side panel 等新 API |
| **性能怎么保证？** | 请求体异步读取不阻塞请求发出；响应体截断；存储上限；JSON 树懒渲染。面板接收端还有"暂停捕获"开关 |

### 演示时的操作顺序

1. 打开一个接口多的网站（推荐自己熟悉的后台系统或掘金/GitHub）
2. 点工具栏图标 → 侧边栏弹出 → 边讲架构边刷新页面，请求实时冒出来
3. 点一个 POST 请求 → 依次展示「请求参数 → 请求头 → 响应头 → 返回值」四个标签
4. 演示搜索"login"、方法筛选、暂停/清空
5. 切换标签页，展示数据按 tab 隔离

### 可以继续深入的迭代方向（面试谈规划用）

- 持久化（storage.session）、导出 HAR / cURL、请求对比、慢请求标记
- 抓取静态资源（webRequest 补充 URL 级别的数据）
- 多标签页聚合视图、正则筛选、请求重放

---

## 附：本项目的关键文件地图

| 文件 | 一句话职责 |
|---|---|
| `public/manifest.json` | 声明权限、content script、side panel、白名单 |
| `public/injected.js` | MAIN world Hook fetch/XHR，采集数据（~200 行） |
| `public/content.js` | 注入脚本 + postMessage 桥接（~40 行） |
| `public/background.js` | 按 tab 存储、合并、广播（~90 行） |
| `src/App.jsx` | 面板主逻辑：连接、筛选、状态管理 |
| `src/components/RequestList.jsx` | 请求列表 |
| `src/components/DetailPanel.jsx` | 详情四标签页 |
| `src/components/JsonViewer.jsx` | 0 依赖的可折叠 JSON 树 |
| `src/lib/format.js` | 格式化工具（状态色、字节数、耗时） |
| `src/lib/mock.js` | 开发模式模拟数据 |
