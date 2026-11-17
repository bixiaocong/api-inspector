# 第 1 课：最小插件（5 分钟）

## 本课目标

做一个世界上最小的插件：点击工具栏图标，弹出一句话。

学到的概念：**manifest.json = 插件的说明书**；**popup = 点击图标弹出的小页面**。

## 文件（只有 2 个）

### `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "01 我的第一个插件",
  "version": "1.0",
  "description": "学习课 1：最小插件",
  "action": {
    "default_title": "点我看看",
    "default_popup": "popup.html"
  }
}
```

逐行读：
- `manifest_version: 3`：现在都用第 3 版规范（MV3）
- `name / version / description`：名字、版本、简介，会显示在扩展管理页
- `action.default_popup`：点了工具栏图标后，弹出哪个页面

### `popup.html`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="width: 220px; padding: 16px; text-align: center;">
  <h1>🎉 你好，插件世界！</h1>
  <p>这是你的第一个浏览器插件</p>
</body>
</html>
```

就是普通网页，没有任何特殊语法。

## 操作步骤

1. 打开 `chrome://extensions`，打开右上角「开发者模式」
2. 点「加载已解压的扩展程序」，**选择 `01-hello-extension` 这个文件夹**
3. 点浏览器工具栏的拼图图标 🧩，找到「01 我的第一个插件」，点旁边的图钉 📌 把它固定到工具栏
4. 点击它的图标 → 弹出你的第一句话

## ✅ 检查点

- [ ] 扩展管理页能看到你的插件卡片
- [ ] 点图标能弹出「🎉 你好，插件世界！」

## 💪 小练习

1. 把弹出的话改成你的名字，刷新插件（扩展卡片上的 ↻）再点一次
2. 把 popup 加一个 `<button>`，随便写点样式，体会一下"弹窗就是普通网页"

## 常见问题

**Q：为什么点图标没反应？**
A：检查 manifest 里 `default_popup` 的文件名和实际文件名是否完全一致（大小写也要一致）。

**Q：改了 popup.html 为什么没生效？**
A：每次改完代码都要在扩展卡片上点 ↻ 刷新。
