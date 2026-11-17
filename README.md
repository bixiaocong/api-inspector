# API Inspector 接口面板

一个 Chrome / Edge 浏览器插件：把页面上的所有接口请求——**地址、参数、返回值**——集中展示在一个侧边栏里，再也不用在 Network 面板的不同窗口之间来回切换。

## 工作原理

```
页面 (MAIN world)  Hook fetch / XHR 捕获请求+响应
        │  window.postMessage
        ▼
content script (ISOLATED world)  转发
        │  chrome.runtime.sendMessage
        ▼
background service worker  按标签页存储 + 实时广播
        │  chrome.runtime Port
        ▼
侧边栏面板 (React)  请求列表 + 详情（参数 / 请求头 / 响应头 / 返回值）
```

- `public/injected.js`：注入到页面 MAIN world，Hook `window.fetch` 与 `XMLHttpRequest`，捕获请求/响应后通过 `window.postMessage` 发出。
- `public/content.js`：content script（ISOLATED world），把注入脚本塞进页面，并把消息转发给 background。
- `public/background.js`：service worker，按 tabId 存储记录（每个标签页最多 1000 条），通过 Port 实时推送给侧边栏。
- `src/**`：React 侧边栏界面（Vite 构建）。

## 开发

```bash
npm install
npm run dev      # 自动打开浏览器（/sidepanel.html），用模拟数据预览界面
npm run build    # 构建到 dist/
```

## 安装到 Chrome / Edge

1. 打开 `chrome://extensions`（Edge 是 `edge://extensions`）
2. 打开右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择本项目 `dist` 目录
4. 打开任意普通网页，点击工具栏上的插件图标，侧边栏会打开
5. 操作页面（点击、刷新、登录…），接口请求就会实时出现在侧边栏里

## 功能

- 实时捕获 fetch / XHR 请求：方法、地址、请求头、请求参数（Query + Body）、响应头、返回值
- 返回值自动识别 JSON，以可折叠的语法高亮树展示
- 按 URL 搜索、按方法 / 状态码筛选
- 暂停捕获、一键清空
- 切换标签页自动显示对应标签页的请求

## 已知限制

- 只能捕获页面发起的 fetch / XHR 请求；图片、CSS、JS 等静态资源不会被捕获
- 页面 Service Worker / 插件自身发出的请求不会被捕获
- 超过 200KB 的请求/响应体会被截断
- 侧边栏关闭后 service worker 可能休眠，内存记录会清空（后续版本做持久化）
