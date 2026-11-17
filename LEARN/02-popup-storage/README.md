# 第 2 课：弹窗会记事了（10 分钟）

## 本课目标

做一个点击计数器：每点一下按钮数字 +1，**关掉弹窗再打开，数字还在**。

学到的概念：
- **popup.js**：弹窗也能写 JS，每次打开弹窗就重新执行
- **chrome.storage**：插件的"硬盘"，存进去的数据关了浏览器都在
- **permissions**：要用的能力必须在 manifest 里先声明（报备制度）

## 文件（3 个）

### `manifest.json` —— 多了 `permissions`

```json
{
  "manifest_version": 3,
  "name": "02 弹窗计数器",
  "version": "1.0",
  "action": { "default_popup": "popup.html" },
  "permissions": ["storage"]
}
```

**重点**：不写 `"storage"`，后面用 `chrome.storage` 就会报错。插件的一切能力都要先报备。

### `popup.html`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="width: 200px; padding: 16px; text-align: center;">
  <h2>我点了 <span id="count">0</span> 次</h2>
  <button id="btn">点我 +1</button>
  <button id="reset">清零</button>
  <script src="popup.js"></script>
</body>
</html>
```

### `popup.js`

```js
// 打开弹窗时：先从"硬盘"读出数字，显示到页面上
chrome.storage.local.get({ count: 0 }, (result) => {
  document.getElementById('count').textContent = result.count;
});

// 点 +1：更新页面显示，同时写回"硬盘"
document.getElementById('btn').addEventListener('click', () => {
  const el = document.getElementById('count');
  const next = Number(el.textContent) + 1;
  el.textContent = next;
  chrome.storage.local.set({ count: next });
});

// 清零
document.getElementById('reset').addEventListener('click', () => {
  document.getElementById('count').textContent = 0;
  chrome.storage.local.set({ count: 0 });
});
```

## ✅ 检查点

- [ ] 点 5 次 → 显示 5
- [ ] 关掉弹窗 → 再打开 → 还是 5
- [ ] 点清零 → 显示 0

## 💪 小练习

1. 加一个输入框，把输入的"昵称"存起来，下次打开弹窗自动显示（提示：`chrome.storage.local.get({ nickname: '' }, ...)`）
2. 思考：为什么不能用一个普通变量 `let count = 0` 保存？—— 因为**弹窗每次打开都是全新的环境**，普通变量会归零。这就是为什么需要 storage。

## 常见问题

**Q：控制台报 `Cannot read properties of undefined` 或 storage 相关错误？**
A：检查 manifest 有没有写 `"permissions": ["storage"]`，改完记得刷新插件。
