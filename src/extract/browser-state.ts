/**
 * Extract cookies + localStorage from a Chromium browser profile via CDP.
 *
 * Copies the profile to a temp dir, launches headless with
 * --remote-debugging-port, extracts via CDP (browser handles its own
 * decryption), cleans up.
 */

import { spawn } from 'node:child_process';
import {
  mkdtempSync, cpSync, rmSync, existsSync, unlinkSync, mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { randomFillSync } from 'node:crypto';
import type { ResolvedBrowser, PlaywrightCookie, BrowserState } from './types.js';

// ---------------------------------------------------------------------------
// CDP helpers (zero dependency WebSocket client)
// ---------------------------------------------------------------------------

let msgId = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function httpGet(url: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function wsSend(socket: any, method: string, params: Record<string, unknown> = {}): number {
  const id = ++msgId;
  const payload = Buffer.from(JSON.stringify({ id, method, params }));
  const mask = Buffer.alloc(4);
  randomFillSync(mask);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];

  let header: Buffer;
  if (payload.length < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | payload.length;
    mask.copy(header, 2);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
    mask.copy(header, 10);
  }
  socket.write(Buffer.concat([header, masked]));
  return id;
}

function wsConnect(wsUrl: string): Promise<{ socket: any; receive: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(wsUrl);
    const key = Buffer.from(Math.random().toString()).toString('base64');
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Connection': 'Upgrade', 'Upgrade': 'websocket',
        'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13',
      },
    });
    req.on('upgrade', (_res, socket) => {
      let pendingResolve: ((d: any) => void) | null = null;
      const queue: any[] = [];
      let buf = Buffer.alloc(0);

      socket.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        while (true) {
          if (buf.length < 2) return;
          const len = buf[1] & 0x7f;
          let start = 2, pLen = len;
          if (len === 126) { if (buf.length < 4) return; pLen = buf.readUInt16BE(2); start = 4; }
          else if (len === 127) { if (buf.length < 10) return; pLen = Number(buf.readBigUInt64BE(2)); start = 10; }
          if (buf.length < start + pLen) return;
          const data = buf.subarray(start, start + pLen).toString();
          buf = buf.subarray(start + pLen);
          try {
            const parsed = JSON.parse(data);
            if (pendingResolve) { const r = pendingResolve; pendingResolve = null; r(parsed); }
            else queue.push(parsed);
          } catch {}
        }
      });

      resolve({
        socket,
        receive: () => queue.length > 0
          ? Promise.resolve(queue.shift())
          : new Promise(r => { pendingResolve = r; }),
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function cdp(socket: any, receive: () => Promise<any>, method: string, params: Record<string, unknown> = {}): Promise<any> {
  const id = wsSend(socket, method, params);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const msg = await Promise.race([receive(), sleep(10000).then(() => null)]);
    if (msg === null) throw new Error(`CDP timeout: ${method}`);
    if (msg.id === id) return msg;
  }
  throw new Error(`CDP timeout: ${method}`);
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

export async function extractBrowserState(
  browser: ResolvedBrowser,
  domain?: string,
): Promise<BrowserState> {
  const tempDir = mkdtempSync(join(tmpdir(), 'vibe-browser-'));
  const tempUserDataDir = join(tempDir, 'userdata');

  // Copy profile
  try {
    cpSync(browser.userDataDir, tempUserDataDir, { recursive: true });
  } catch {
    mkdirSync(tempUserDataDir, { recursive: true });
    const localState = join(browser.userDataDir, 'Local State');
    if (existsSync(localState)) cpSync(localState, join(tempUserDataDir, 'Local State'));
    cpSync(
      join(browser.userDataDir, browser.profileName),
      join(tempUserDataDir, browser.profileName),
      { recursive: true },
    );
  }

  // Remove locks
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { unlinkSync(join(tempUserDataDir, lock)); } catch {}
  }

  // Launch headless
  const port = 9200 + Math.floor(Math.random() * 800);
  const proc = spawn(browser.executable, [
    `--remote-debugging-port=${port}`,
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking',
    '--disable-sync', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${tempUserDataDir}`,
    `--profile-directory=${browser.profileName}`,
  ], { stdio: ['ignore', 'ignore', 'ignore'], detached: false });

  const state: BrowserState = { cookies: [], localStorage: {} };

  try {
    // Poll for CDP
    let targets: any[] | null = null;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      try {
        targets = await httpGet(`http://127.0.0.1:${port}/json`);
        if (targets?.length) break;
      } catch {}
    }
    if (!targets?.length) throw new Error('CDP endpoint never became ready');

    const wsUrl = (targets.find((t: any) => t.type === 'page') || targets[0]).webSocketDebuggerUrl;
    const { socket, receive } = await wsConnect(wsUrl);

    // Extract ALL cookies
    const cookieResult = await cdp(socket, receive, 'Network.getAllCookies');
    const raw: any[] = cookieResult.result?.cookies || [];
    state.cookies = raw.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expires === -1 ? -1 : (c.expires ?? -1),
      secure: c.secure || false,
      httpOnly: c.httpOnly || false,
      sameSite: (c.sameSite === 'Strict' ? 'Strict' : c.sameSite === 'Lax' ? 'Lax' : 'None') as PlaywrightCookie['sameSite'],
    }));

    // Extract localStorage for target domain
    if (domain) {
      const protocol = domain.includes('localhost') || domain.match(/^\d/) ? 'http' : 'https';
      await cdp(socket, receive, 'Page.enable');
      await cdp(socket, receive, 'Page.navigate', { url: `${protocol}://${domain}` });
      await sleep(2000);
      const lsResult = await cdp(socket, receive, 'Runtime.evaluate', {
        expression: 'JSON.stringify(Object.fromEntries(Object.entries(localStorage)))',
        returnByValue: true,
      });
      const lsValue = lsResult.result?.result?.value;
      if (lsValue) {
        try { state.localStorage = JSON.parse(lsValue); } catch {}
      }
    }

    socket.destroy();
  } finally {
    try { proc.kill('SIGTERM'); } catch {}
    await sleep(500);
    try { proc.kill('SIGKILL'); } catch {}
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }

  return state;
}
