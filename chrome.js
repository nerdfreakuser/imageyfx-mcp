/**
 * A thin line to a page in a Chrome that is already running.
 *
 * Attaching rather than launching, and that is the whole design decision. This
 * is a visualiser: the point of it is that somebody is watching. A headless
 * browser would render a light show to nobody, and the person whose desk is
 * being driven would have no way to see what was done to it - which is exactly
 * the failure the on-screen takeover card exists to prevent.
 *
 * Raw CDP over a WebSocket rather than a driver library. Puppeteer and
 * Playwright both bring a browser download and a process manager, and neither
 * is any use here: the browser already exists and belongs to the user. What is
 * needed is one method - evaluate this expression in that tab - and a socket
 * is the whole of it.
 */
import WebSocket from 'ws';

const DEFAULT_PORT = 9222;

/** Every page Chrome will admit to, as the debugging endpoint lists them. */
async function targets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!res.ok) throw new Error(`Chrome debugging endpoint said ${res.status}`);
  return res.json();
}

/**
 * The imageyFX tab.
 *
 * Matched on the URL rather than the title, because the title is the same
 * string on the marketing site and a title is a thing the page can change. A
 * URL carrying /app is the rig; anything else is not, however it is named.
 */
function pick(list, match) {
  const pages = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const wanted = pages.filter((t) => (t.url || '').includes(match));
  return wanted[0] || null;
}

export class Rig {
  constructor(opts = {}) {
    this.port = opts.port || DEFAULT_PORT;
    this.match = opts.match || '/app';
    this.ws = null;
    this.next = 1;
    this.waiting = new Map();
    this.url = null;
  }

  /**
   * Connect, or say plainly why not.
   *
   * The failures here are all somebody's setup rather than a bug, and each one
   * has a different fix - so they are told apart rather than collapsed into
   * "could not connect", which sends people to the wrong place.
   */
  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    let list;
    try {
      list = await targets(this.port);
    } catch (e) {
      throw new Error(
        `No Chrome answering on port ${this.port}. Start one with ` +
        `--remote-debugging-port=${this.port} and open the rig in it.`
      );
    }

    const target = pick(list, this.match);
    if (!target) {
      throw new Error(
        `Chrome is there but no tab matching "${this.match}" is open. ` +
        `Open https://360.imagey.ai/app (or your local copy) in it.`
      );
    }

    this.url = target.url;
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl, {
        maxPayload: 64 * 1024 * 1024      // an analysis is a large reply
      });
      ws.on('open', () => { this.ws = ws; resolve(); });
      ws.on('error', reject);
      ws.on('close', () => { this.ws = null; });
      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        const pending = this.waiting.get(msg.id);
        if (!pending) return;                    // an event, not our reply
        this.waiting.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message || 'CDP error'));
        else pending.resolve(msg.result);
      });
    });
  }

  send(method, params) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      // A page that never answers must not hang the whole server.
      setTimeout(() => {
        if (this.waiting.has(id)) {
          this.waiting.delete(id);
          reject(new Error(`${method} timed out after 60s`));
        }
      }, 60000);
    });
  }

  /**
   * Call one method on the page's ImageyFX and bring the answer back.
   *
   * `awaitPromise` is the reason this is one round trip rather than a poll:
   * analyse returns a promise and the protocol will wait for it, so a caller
   * asks once and gets the finished analysis.
   *
   * Arguments travel as JSON inside the expression rather than as CDP
   * arguments, because the shapes here are plain data and threading them
   * through Runtime.callFunctionOn buys nothing but ceremony.
   */
  async call(method, args = []) {
    await this.connect();
    const expression =
      `(() => { const a = ${JSON.stringify(args)};` +
      ` if (!window.ImageyFX) throw new Error('ImageyFX is not on this page');` +
      ` const f = window.ImageyFX[${JSON.stringify(method)}];` +
      ` if (typeof f !== 'function') throw new Error('no such method: ' + ${JSON.stringify(method)});` +
      ` return f.apply(window.ImageyFX, a); })()`;

    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (res.exceptionDetails) {
      /*
       * The sentence, not the stack.
       *
       * `description` is the whole trace, and the page's refusals are the most
       * useful thing in this chain - a bad cue sheet comes back naming the
       * fault and listing the valid names beside it. Wrapping that in ten lines
       * of file paths from a bundle the caller cannot see buries the only part
       * worth reading.
       */
      const d = res.exceptionDetails;
      const raw = (d.exception && (d.exception.description || d.exception.value)) ||
                  d.text || 'the page threw';
      const first = String(raw).split(/\r?\n/)[0].replace(/^Error:\s*/, '');
      throw new Error(first);
    }
    return res.result ? res.result.value : null;
  }

  close() {
    if (this.ws) { try { this.ws.close(); } catch { /* going anyway */ } }
    this.ws = null;
  }
}
