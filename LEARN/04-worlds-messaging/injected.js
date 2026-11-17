// 间谍：运行在页面的真实世界（MAIN world）里
(() => {
  if (window.__lesson04Done__) return; // 防止注入两次
  window.__lesson04Done__ = true;

  function send(data) {
    try {
      window.postMessage({ source: 'lesson04', data }, '*');
    } catch (e) {}
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
