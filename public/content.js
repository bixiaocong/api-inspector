/**
 * API Inspector — Content Script（运行在 ISOLATED world）
 *
 * 作用：
 *   1. 把 MAIN world 的注入脚本（injected.js）以 <script> 标签塞进页面；
 *   2. 监听页面 postMessage，把捕获数据转发给 background service worker。
 */
(() => {
  if (window.__apiInspectorContent__) return;
  window.__apiInspectorContent__ = true;

  function inject() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      // document_start 时机太早时兜底重试一次
      setTimeout(inject, 500);
    }
  }
  inject();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return; // 只收本页面来的消息
    const msg = event.data;
    if (!msg || msg.source !== 'api-inspector') return;
    try {
      chrome.runtime
        .sendMessage({ type: 'record', kind: msg.kind, data: msg.data })
        .catch(() => {});
    } catch (e) {}
  });
})();
