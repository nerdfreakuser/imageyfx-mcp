/** Attach to the user's existing Chrome; never launch or silently switch tabs. */
import WebSocket from 'ws';

export class Rig {
  constructor(opts = {}) {
    this.port = opts.port || 9222;
    this.match = opts.match || '/app';
    this.timeout = opts.timeout || 60000;
    this.ws = null;
    this.connecting = null;
    this.next = 1;
    this.waiting = new Map();
    this.url = null;
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.open();
    try { await this.connecting; } finally { this.connecting = null; }
  }

  async open() {
    let list;
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/list`, {
        signal: AbortSignal.timeout(Math.min(this.timeout, 10000))
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      list = await res.json();
    } catch (e) {
      throw new Error(`No Chrome answering on port ${this.port}. Start Chrome with --remote-debugging-port=${this.port} and open the rig in it. (${e.message})`);
    }
    const wanted = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl && (t.url || '').includes(this.match));
    if (!wanted.length) throw new Error(`No tab matching "${this.match}". Open https://360.imagey.ai/app or your local copy.`);
    if (wanted.length > 1) throw new Error(`Multiple tabs match "${this.match}". Set IMAGEYFX_MATCH to a more specific URL or close the duplicate app tab.`);
    const target = wanted[0];
    this.url = target.url;
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl, {
        maxPayload: 64 * 1024 * 1024, handshakeTimeout: Math.min(this.timeout, 10000)
      });
      this.ws = ws;
      ws.on('open', resolve);
      ws.on('error', error => { reject(error); this.rejectPending(ws, error); });
      ws.on('close', () => {
        const error = new Error('Chrome disconnected. The last action may have completed; check status before retrying a write.');
        reject(error);
        this.rejectPending(ws, error);
        if (this.ws === ws) this.ws = null;
      });
      ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        const pending = this.waiting.get(msg.id);
        if (!pending || pending.ws !== ws) return;
        this.waiting.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.error) pending.reject(new Error(msg.error.message || 'CDP error'));
        else pending.resolve(msg.result);
      });
    });
  }

  rejectPending(ws, error) {
    for (const [id, pending] of this.waiting) {
      if (pending.ws !== ws) continue;
      clearTimeout(pending.timer);
      this.waiting.delete(id);
      pending.reject(error);
    }
  }

  send(method, params) {
    const id = this.next++, ws = this.ws;
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('Chrome is not connected'));
      const fail = error => {
        const pending = this.waiting.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.waiting.delete(id);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error(`${method} timed out. The action may have completed; check status before retrying a write.`)), this.timeout);
      this.waiting.set(id, { resolve, reject, timer, ws });
      try { ws.send(JSON.stringify({ id, method, params }), error => { if (error) fail(error); }); }
      catch (error) { fail(error); }
    });
  }

  async call(method, args = []) {
    if (typeof method !== 'string' || !method || !Array.isArray(args)) throw new Error('Use a method name and an argument array');
    await this.connect();
    const expression =
      `(() => { const a = ${JSON.stringify(args)};` +
      ` const api = window.ImageyFX; if (!api) throw new Error('ImageyFX is not on this page');` +
      ` const name = ${JSON.stringify(method)};` +
      ` const f = Object.prototype.hasOwnProperty.call(api, name) && api[name];` +
      ` if (typeof f !== 'function') throw new Error('no such method: ' + name);` +
      ` return f.apply(api, a); })()`;
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      const raw = d.exception?.description || d.exception?.value || d.text || 'the page threw';
      // Preserve all validation faults, dropping only stack frames.
      throw new Error(String(raw).split(/\r?\n/).filter(line => !/^\s+at /.test(line)).join('\n').replace(/^Error:\s*/, ''));
    }
    return res.result ? res.result.value : null;
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      this.rejectPending(ws, new Error('MCP connection closed'));
      ws.terminate();
    }
  }
}
