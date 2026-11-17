# 第 5 课：看懂真实项目（毕业课）

前面 4 课学的概念，就是 api-inspector 的全部地基。真实项目只是把每个零件做大了。

## 概念对照表

| 第 4 课学到的 | 真实项目里变成了什么 | 文件 |
|---|---|---|
| 间谍 Hook fetch 数请求 | 间谍 Hook fetch + XHR，抓地址/参数/返回值 | `public/injected.js` |
| 外勤转发情报 | 一样，多了转发"请求"和"响应"两类消息 | `public/content.js` |
| 总部存一个对象 | 总部按 tabId 存 1000 条记录 + 实时广播 | `public/background.js` |
| 前台弹窗（popup） | 侧边栏面板（side panel）+ React | `src/**` |
| popup 每秒轮询总部 | 长连接 Port 实时推送（更高大上） | `src/App.jsx` |
| 一个数字 state | 每条请求的完整生命周期（请求→等待→响应） | 数据模型 |

## 真实项目比第 4 课多出来的 3 个设计

### 1. 请求和响应是两条消息，靠 id 合并

第 4 课里 Hook 只在"发出请求"时发一条消息。真实项目要展示返回值，所以：

- 发出请求时 → 发「request 消息」→ 列表里先冒出一条「等待中」的记录
- 响应回来时 → 发「response 消息」→ 总部按 id 找到那条记录，把状态码和返回值合并进去

```js
// background.js 里合并的逻辑
if (message.kind === 'request') {
  list.push(message.data);              // 新请求入列
} else if (message.kind === 'response') {
  const target = list.find(r => r.id === message.data.id);
  Object.assign(target, message.data);  // 按 id 合并响应
}
```

这就是界面上"新请求冒出来 → 状态从 … 变成 200"的实现原理。

### 2. `response.clone()` 保护页面业务

fetch 的响应体是"流"，只能读一次。直接读了它，页面自己就拿不到数据了——这就是为什么真实项目的 Hook 里：

```js
const body = await response.clone().text(); // 读的是"复印件"
return response;                             // "原件"原样还给页面
```

**clone() 就是"复印件"**，这是整个项目最容易翻车的细节，也是面试的必考点。

### 3. 轮询升级为长连接（Port）

第 4 课的 popup 每秒轮询一次（`setInterval`）。真实项目里后台用 `chrome.runtime.connect` 建一条长连接管道：

- 新请求来了 → 后台立刻顺着管道推给面板（不用等下一秒）
- 面板启动时 → 用一次性消息 `sendMessage` 拉取历史记录

「查询用短连接，推送用长连接」是插件通信的标准姿势。

## 阅读顺序建议

1. `public/manifest.json`（你已经全认识了）
2. `public/injected.js`（间谍的完整版，重点看 fetch 的 Hook 和 clone）
3. `public/content.js`（和第 4 课几乎一样）
4. `public/background.js`（总部的完整版，重点看 id 合并和广播）
5. `src/App.jsx`（面板逻辑：连接后台、接收推送、筛选）
6. `src/components/DetailPanel.jsx` + `JsonViewer.jsx`（纯 React，不看也不会影响理解插件机制）

## 毕业练习（可选挑战）

给第 4 课的小插件加一个功能：**把页面的 fetch 响应状态码显示在 popup 里**。

提示：
1. `injected.js` 的 fetch Hook 里，`origFetch(...)` 会返回 promise，`.then(res => ...)` 能拿到 `res.status`，记得把 promise 原样 return
2. 请求发出时发一条消息、响应回来时再发一条，`background.js` 里把两条合成一条
3. 做完这个练习，你就亲手实现了接口面板的核心机制

## 之后想深入的方向

- `chrome.storage.session`：数据持久化（真实项目已列入计划）
- `chrome.devtools.panels`：把面板做进 F12 里
- `chrome.alarms`：定时任务
- `declarativeNetRequest`：拦截/修改请求
