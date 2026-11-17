function refresh() {
  chrome.runtime.sendMessage({ type: 'get-data' }, (state) => {
    if (!state) return;
    document.getElementById('secret').textContent = state.secret;
    document.getElementById('count').textContent = state.fetchCount;
    document.getElementById('url').textContent = state.lastFetchUrl || '（无）';
  });
}

refresh();
setInterval(refresh, 1000); // 每秒问一次总部
