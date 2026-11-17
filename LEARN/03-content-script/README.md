# 第 3 课：把手伸进网页里（10 分钟）

## 本课目标

做一个插件：打开任何网页，页面自动变成粉红色背景。

学到的概念：
- **content script**：插件派到每个网页里的"外勤"，能摸网页的 DOM
- **matches**：规定外勤去哪些网址上班（`<all_urls>` = 所有网站）
- **隔离世界（ISOLATED world）**：本课最重要的概念，第 4 课的基石

## 文件（2 个）

### `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "03 粉红网页",
  "version": "1.0",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

注意：这个插件**没有 popup**。不是每个插件都需要界面——content script 自己就能干活。

### `content.js`

```js
// 这段代码会"被浏览器塞进"每个网页里执行
document.body.style.backgroundColor = '#ffe4ec';
console.log('粉红插件已注入这个页面');
```

## 操作步骤

1. 加载 `03-content-script` 文件夹
2. **先刷新已打开的网页**（content script 只在页面加载时注入，已打开的旧页面不会自动生效）
3. 打开几个网站看看：都变粉了

## ✅ 检查点

- [ ] 新打开的网页背景是粉色
- [ ] 按 F12 → 控制台，能看到「粉红插件已注入这个页面」
- [ ] `chrome://extensions` 这种浏览器内部页面**没有**变粉（内部页面禁止注入，这是 Chrome 的安全规则）

## 🔬 关键实验：亲手验证「隔离世界」

在 `content.js` 里加一行：

```js
console.log('我能读到页面变量吗？', window.secret); // undefined
```

然后打开任意网页，在 F12 控制台里执行：

```js
window.secret = '页面自己的秘密';
```

再看 content script 打出的日志——是 `undefined`！

**结论**：content script 虽然"在网页里"，但它和网页的 JS 处于两个互不相通的世界：
- content script 能看到、修改**DOM**（所以能变粉色）
- 但读不到页面的 **JS 变量**（所以 `window.secret` 是 undefined）

```
网页世界 (MAIN world)      隔离世界 (ISOLATED world)
window.secret = 秘密        window.secret = undefined
window.fetch = 真fetch      window.fetch = 影子fetch
        └──────── 共享 DOM ────────┘
```

这解释了为什么我们的接口面板必须"注入脚本"——留在隔离世界里 Hook fetch，抓到的只是影子。

## 💪 小练习

1. 把背景色改成别的颜色，加一句 `document.title = '被插件改过'`
2. 在页面右下角加一个「回到顶部」悬浮按钮（提示：`position: fixed`，点击后 `window.scrollTo(0, 0)`）

## 常见问题

**Q：改了代码刷新了插件，网页还是没变化？**
A：content script 的注入发生在**页面加载时**。刷新插件后，要**再刷新网页**才能重新注入。
