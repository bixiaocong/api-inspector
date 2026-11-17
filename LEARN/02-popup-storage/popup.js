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
