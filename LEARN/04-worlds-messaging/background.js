// 数据中心：popup 随时来问，这里都有
let state = {
  secret: '（还没收到页面的消息）',
  fetchCount: 0,
  lastFetchUrl: '',
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === 'page-data') {
    // 外勤转发来的情报
    const d = message.data || {};
    if (d.secret) state.secret = d.secret;
    if (d.fetchUrl) {
      state.fetchCount += 1;
      state.lastFetchUrl = d.fetchUrl;
    }
  } else if (message.type === 'get-data') {
    // 前台来问数据，直接回答
    sendResponse(state);
  }
});
