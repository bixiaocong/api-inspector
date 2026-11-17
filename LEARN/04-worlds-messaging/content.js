// ① 把间谍脚本注入页面真实世界
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// ② 接收间谍的 postMessage 情报，转发给总部
window.addEventListener('message', (event) => {
  if (event.source !== window) return; // 只收本页面的消息
  const msg = event.data;
  if (!msg || msg.source !== 'lesson04') return; // 只认自己的暗号
  chrome.runtime.sendMessage({ type: 'page-data', data: msg.data }).catch(() => {});
});
