'use strict';

/**
 * Minimal headless-browser harness for the end-to-end test suite.
 *
 * Why hand-rolled: it needs no npm install. It drives the system Chrome over
 * the DevTools Protocol using Node's built-in `fetch` and `WebSocket` (Node 18+).
 * That keeps `node tools/e2e.js` runnable on any machine with Chrome, and — more
 * importantly — runnable by agents that only have a shell.
 *
 * Usage:
 *   const { launch, Suite } = require('../harness');
 *   const browser = await launch();
 *   const page = await browser.newPage();
 *   await page.goto('http://127.0.0.1:8899/');
 *   await page.ready();
 *   await page.click('[data-action="start-new"]');
 *   await page.waitFor('ui.session && ui.session.items.length > 0');
 *   const n = await page.eval('ui.session.items.length');
 *   console.log(await page.text('.q-progress'));
 *   await browser.close();
 */

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ chrome --- */

function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('No Chrome/Chromium found. Set CHROME_BIN to the executable.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/* ----------------------------------------------------------------- browser --- */

class Browser {
  constructor(proc, port, profileDir) {
    this.proc = proc;
    this.port = port;
    this.profileDir = profileDir;
    this.pages = [];
    this.closed = false;
  }

  async newPage() {
    const url = 'about:blank';
    const res = await fetch(`http://127.0.0.1:${this.port}/json/new?${encodeURIComponent(url)}`, {
      method: 'PUT',
    });
    const target = await res.json();
    const page = new Page(target.webSocketDebuggerUrl, this, target.id);
    await page.connect();
    this.pages.push(page);
    return page;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pages) p.disconnect();
    try {
      this.proc.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    try {
      await fetch(`http://127.0.0.1:${this.port}/json/close`, { method: 'PUT' }).catch(() => {});
    } catch {
      /* ignore */
    }
    await sleep(80);
    try {
      fs.rmSync(this.profileDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

async function launch() {
  const chrome = findChrome();
  const port = await freePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `liuk-chrome-`));
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--mute-audio',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ];
  const proc = spawn(chrome, args, { stdio: 'ignore', detached: false });

  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        version = await r.json();
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  if (!version) {
    try {
      proc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    throw new Error('Chrome DevTools endpoint never came up');
  }
  return new Browser(proc, port, profileDir);
}

/* -------------------------------------------------------------------- page --- */

class Page {
  constructor(wsUrl, browser, targetId) {
    this.wsUrl = wsUrl;
    this.browser = browser;
    this.targetId = targetId;
    this.ws = null;
    this.nextId = 0;
    this.pending = new Map();
    /** Runtime exceptions and console.error calls seen on this page. */
    this.errors = [];
    /** Failed / 4xx-5xx network requests seen on this page. */
    this.netFailures = [];
    /** JS dialogs (alert/confirm/prompt) that were auto-dismissed. */
    this.dialogs = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = (e) => reject(new Error('ws error: ' + (e.message || 'unknown')));
    });
    this.ws.onmessage = (e) => this._onMessage(JSON.parse(e.data));
    this.ws.onclose = () => {
      for (const [, res] of this.pending) res({ error: { message: 'page closed' } });
      this.pending.clear();
    };
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
  }

  disconnect() {
    try {
      if (this.ws) this.ws.close();
    } catch {
      /* ignore */
    }
  }

  /** Close just this tab. */
  async close() {
    this.disconnect();
    try {
      await fetch(`http://127.0.0.1:${this.browser.port}/json/close/${this.targetId}`);
    } catch {
      /* best effort */
    }
  }

  _onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      this.pending.get(msg.id)(msg);
      this.pending.delete(msg.id);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      this.errors.push('exception: ' + (d.exception?.description || d.text));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      this.errors.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const entry = msg.params.entry;
      const t = entry.text || '';
      const u = entry.url || '';
      // A missing favicon is noise from a plain static file server.
      if (/favicon/.test(t) || /favicon/.test(u)) return;
      this.netFailures.push(u ? `${t} (${u})` : t);
    } else if (msg.method === 'Page.javascriptDialogOpening') {
      this.dialogs.push(msg.params.message);
      this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++this.nextId;
      this.pending.set(id, resolve);
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (e) {
        this.pending.delete(id);
        resolve({ error: { message: String(e) } });
      }
    });
  }

  /** Evaluate an expression in the page and return its value. */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(function(){ ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.error) throw new Error('eval failed: ' + r.error.message);
    if (r.result && r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('page threw: ' + (d.exception?.description || d.text));
    }
    return r.result?.result?.value;
  }

  /** Evaluate a raw expression string (must end in an expression). */
  async evalRaw(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result && r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('page threw: ' + (d.exception?.description || d.text));
    }
    return r.result?.result?.value;
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor('document.readyState === "complete"', { timeout: 20000, label: 'load ' + url });
  }

  /** Wait until the app has fetched its question pool. */
  async ready(min = 1, timeout = 20000) {
    await this.waitFor(`typeof DATA !== 'undefined' && DATA.all && DATA.all.length >= ${min}`, {
      timeout,
      label: 'app data loaded',
    });
  }

  async waitFor(expression, { timeout = 8000, interval = 60, label } = {}) {
    const started = Date.now();
    let last;
    for (;;) {
      try {
        last = await this.evalRaw(expression);
        if (last) return last;
      } catch (e) {
        last = 'threw: ' + e.message;
      }
      if (Date.now() - started > timeout) {
        throw new Error(`waitFor timed out after ${timeout}ms${label ? ` (${label})` : ''}: ${expression} — last=${JSON.stringify(last)}`);
      }
      await sleep(interval);
    }
  }

  async exists(sel) {
    return this.eval(`return !!document.querySelector(${JSON.stringify(sel)});`);
  }

  async count(sel) {
    return this.eval(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`);
  }

  async text(sel) {
    return this.eval(
      `var n = document.querySelector(${JSON.stringify(sel)}); return n ? n.innerText : null;`
    );
  }

  async attr(sel, name) {
    return this.eval(
      `var n = document.querySelector(${JSON.stringify(sel)}); return n ? n.getAttribute(${JSON.stringify(name)}) : null;`
    );
  }

  async click(sel, { index = 0 } = {}) {
    const ok = await this.eval(
      `var ns = document.querySelectorAll(${JSON.stringify(sel)});
       if (!ns[${index}]) return false;
       ns[${index}].click();
       return true;`
    );
    if (!ok) throw new Error(`click: no element for ${sel} at index ${index}`);
  }

  /** Set an input's value and fire the named event (default 'change'). */
  async setValue(sel, value, eventName = 'change') {
    const ok = await this.eval(
      `var n = document.querySelector(${JSON.stringify(sel)});
       if (!n) return false;
       n.value = ${JSON.stringify(value)};
       n.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
       return true;`
    );
    if (!ok) throw new Error(`setValue: no element for ${sel}`);
  }

  /** Emulate a viewport (and touch, if mobile) for responsive checks. */
  async setViewport({ width, height, mobile = false, deviceScaleFactor = 1 }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile,
    });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile });
  }

  /**
   * Install a hook that records blob downloads instead of saving them.
   * Idempotent. Call before clicking an export button, then use `downloads()`.
   */
  async captureDownloads() {
    await this.evalRaw(`(function () {
      if (window.__dlHook) return true;
      window.__dlHook = { blobs: [], names: [] };
      var origCreate = URL.createObjectURL;
      URL.createObjectURL = function (b) {
        window.__dlHook.blobs.push(b);
        return origCreate.call(URL, b);
      };
      var origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.href && String(this.href).indexOf('blob:') === 0) {
          window.__dlHook.names.push(this.download || null);
          return; // swallow it: cancel the real download
        }
        return origClick.apply(this, arguments);
      };
      return true;
    })()`);
  }

  /** Everything captured since the last `captureDownloads()` call. */
  async downloads() {
    return (
      (await this.evalRaw(`(function () {
        var h = window.__dlHook;
        if (!h || !h.blobs.length) return Promise.resolve([]);
        return Promise.all(h.blobs.map(function (b, i) {
          return b.text().then(function (t) {
            return { name: h.names[i] || null, size: b.size, text: t };
          });
        }));
      })()`)) || []
    );
  }

  clearErrors() {
    this.errors.length = 0;
    this.netFailures.length = 0;
    this.dialogs.length = 0;
  }

  /** Everything that looks like a real client-side problem. */
  problems() {
    return [...this.errors, ...this.netFailures];
  }
}

/* ------------------------------------------------------------------- suite --- */

class Suite {
  constructor(name) {
    this.name = name;
    this.passed = 0;
    this.failures = [];
    this.notes = [];
    this.t0 = Date.now();
  }

  check(label, cond, detail) {
    if (cond) {
      this.passed++;
      console.log(`    ✓ ${label}`);
    } else {
      this.failures.push(label + (detail !== undefined ? ` — ${detail}` : ''));
      console.log(`    ✗ ${label}${detail !== undefined ? ` — ${detail}` : ''}`);
    }
    return !!cond;
  }

  eq(label, actual, expected) {
    return this.check(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  near(label, actual, expected, tolerance) {
    return this.check(
      label,
      Math.abs(actual - expected) <= tolerance,
      `expected ${expected} ±${tolerance}, got ${actual}`
    );
  }

  note(msg) {
    this.notes.push(msg);
    console.log(`    · ${msg}`);
  }

  async group(label, fn) {
    console.log(`\n  ${label}`);
    const before = this.failures.length;
    try {
      await fn();
    } catch (e) {
      this.failures.push(`${label} [threw] — ${e.message}`);
      console.log(`    ✗ group threw — ${e.message}`);
    }
    return this.failures.length === before;
  }

  summary() {
    const ms = Date.now() - this.t0;
    const total = this.passed + this.failures.length;
    console.log(`\n  ${this.name}: ${this.passed}/${total} passed in ${(ms / 1000).toFixed(1)}s`);
    if (this.failures.length) {
      console.log('  failures:');
      for (const f of this.failures) console.log(`    ✗ ${f}`);
    }
    return this.failures.length === 0;
  }
}

module.exports = { launch, Suite, sleep, findChrome };
