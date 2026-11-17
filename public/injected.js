/**
 * API Inspector — 页面注入脚本（运行在页面的 MAIN world）
 *
 * 作用：Hook window.fetch 与 XMLHttpRequest，捕获每个请求的
 *   地址 / 方法 / 请求头 / 请求体 / 响应状态 / 响应头 / 响应体 / 耗时，
 * 然后通过 window.postMessage 发给 content script。
 *
 * 为什么必须是 MAIN world：
 *   content script 运行在 ISOLATED world，它看到的 window.fetch 是
 *   一个"影子"，Hook 了也抓不到页面真正的请求，所以要把这个脚本
 *   以 <script> 标签的方式注入进页面本身的世界。
 */
(() => {
  if (window.__apiInspectorInjected__) return;
  window.__apiInspectorInjected__ = true;

  const MAX_BODY_LENGTH = 200 * 1024; // 200KB，防止超大响应拖垮面板

  // 每个 frame 一个随机后缀，避免不同 iframe 的请求 id 撞车
  const frameId = Math.random().toString(36).slice(2, 8);
  let seq = 0;
  const nextId = () => `${frameId}-${++seq}`;

  function post(kind, data) {
    try {
      window.postMessage({ source: 'api-inspector', kind, data }, '*');
    } catch (e) {
      /* ignore */
    }
  }

  function cap(text) {
    if (typeof text !== 'string') return text;
    if (text.length > MAX_BODY_LENGTH) {
      return text.slice(0, MAX_BODY_LENGTH) + '\n…(内容过长，已截断)';
    }
    return text;
  }

  function headersToObject(headers) {
    const obj = {};
    try {
      headers.forEach((value, key) => {
        obj[key] = value;
      });
    } catch (e) {}
    return obj;
  }

  // XHR 的响应头是原始字符串，手动解析成对象
  function parseXhrHeaders(raw) {
    const obj = {};
    if (!raw) return obj;
    raw.trim().split(/[\r\n]+/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return obj;
  }

  // 把各种类型的请求体转成可展示的字符串
  function serializeBody(body) {
    if (body == null) return null;
    try {
      if (typeof body === 'string') return body;
      if (body instanceof URLSearchParams) return body.toString();
      if (body instanceof FormData) {
        const obj = {};
        body.forEach((value, key) => {
          if (value instanceof File) obj[key] = `[File: ${value.name}, ${value.size} bytes]`;
          else obj[key] = String(value);
        });
        return JSON.stringify(obj, null, 2);
      }
      if (body instanceof Blob) return `[Blob: ${body.size} bytes, type=${body.type}]`;
      if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return `[Binary: ${body.byteLength} bytes]`;
      if (typeof Document !== 'undefined' && body instanceof Document) {
        return new XMLSerializer().serializeToString(body);
      }
      return JSON.stringify(body);
    } catch (e) {
      return String(body);
    }
  }

  /* ================= Hook fetch ================= */

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      const id = nextId();
      const startTime = performance.now();

      let method = 'GET';
      let url = '';
      try {
        const req = new Request(input, init);
        method = req.method;
        url = req.url;
      } catch (e) {
        url = String(input);
      }

      // 读取请求体放到异步里做，不阻塞页面真正发出的请求
      (async () => {
        let headers = {};
        let body = null;
        try {
          const req = new Request(input, init);
          headers = headersToObject(req.headers);
          body = cap(await req.clone().text());
        } catch (e) {}
        post('request', {
          id,
          type: 'fetch',
          method,
          url,
          reqHeaders: headers,
          reqBody: body,
          startTime,
          wallTime: Date.now(),
        });
      })();

      let promise;
      try {
        promise = origFetch.apply(this, arguments);
      } catch (e) {
        // fetch 同步抛错（参数非法等）
        post('response', { id, status: 0, statusText: '', error: String((e && e.message) || e) });
        throw e;
      }

      promise.then(
        async (response) => {
          let resHeaders = {};
          let resBody = null;
          try {
            resHeaders = headersToObject(response.headers);
            resBody = cap(await response.clone().text());
          } catch (e) {}
          post('response', {
            id,
            status: response.status,
            statusText: response.statusText,
            resHeaders,
            resBody,
            duration: performance.now() - startTime,
            endTime: Date.now(),
          });
        },
        (err) => {
          // 网络错误 / 被 abort
          post('response', {
            id,
            status: 0,
            statusText: '',
            error: String((err && err.message) || err),
            duration: performance.now() - startTime,
            endTime: Date.now(),
          });
        }
      );
      return promise;
    };
  }

  /* ================= Hook XMLHttpRequest ================= */

  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const origOpen = XHR.prototype.open;
    const origSetHeader = XHR.prototype.setRequestHeader;
    const origSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url) {
      this.__apiInspector = {
        method: String(method).toUpperCase(),
        url: String(url),
        headers: {},
      };
      return origOpen.apply(this, arguments);
    };

    XHR.prototype.setRequestHeader = function (name, value) {
      if (this.__apiInspector) {
        try {
          this.__apiInspector.headers[name] = value;
        } catch (e) {}
      }
      return origSetHeader.apply(this, arguments);
    };

    XHR.prototype.send = function (body) {
      const info = this.__apiInspector || {};
      const id = nextId();
      const startTime = performance.now();

      post('request', {
        id,
        type: 'xhr',
        method: info.method || 'GET',
        url: info.url || '',
        reqHeaders: info.headers || {},
        reqBody: cap(serializeBody(body)),
        startTime,
        wallTime: Date.now(),
      });

      this.addEventListener('loadend', () => {
        // loadend 在成功 / 失败 / abort 时都会触发
        let resBody = null;
        try {
          const rt = this.responseType;
          if (rt === '' || rt === 'text') resBody = this.responseText;
          else if (rt === 'json') resBody = JSON.stringify(this.response);
          else if (this.response instanceof ArrayBuffer) resBody = `[ArrayBuffer: ${this.response.byteLength} bytes]`;
          else if (ArrayBuffer.isView(this.response)) resBody = `[Binary: ${this.response.byteLength} bytes]`;
          else if (typeof Blob !== 'undefined' && this.response instanceof Blob) resBody = `[Blob: ${this.response.size} bytes]`;
          else resBody = String(this.response);
        } catch (e) {
          resBody = null;
        }
        post('response', {
          id,
          status: this.status,
          statusText: this.statusText,
          resHeaders: parseXhrHeaders(this.getAllResponseHeaders()),
          resBody: cap(resBody),
          duration: performance.now() - startTime,
          endTime: Date.now(),
        });
      });

      return origSend.apply(this, arguments);
    };
  }
})();
