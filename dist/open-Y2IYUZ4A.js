import {
  findBrowser
} from "./chunk-SXDDRUBI.js";
import {
  hasSession,
  readStateCache,
  saveSession,
  saveStateCache
} from "./chunk-YAW7MKUF.js";

// src/commands/open.ts
import { chromium } from "playwright";
import { spawn as spawn2 } from "child_process";

// src/extract/browser-state.ts
import { spawn } from "child_process";
import {
  mkdtempSync,
  cpSync,
  rmSync,
  existsSync,
  unlinkSync,
  mkdirSync
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import http from "http";
import { randomFillSync } from "crypto";
var msgId = 0;
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    }).on("error", reject);
  });
}
function wsSend(socket, method, params = {}) {
  const id = ++msgId;
  const payload = Buffer.from(JSON.stringify({ id, method, params }));
  const mask = Buffer.alloc(4);
  randomFillSync(mask);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(6);
    header[0] = 129;
    header[1] = 128 | payload.length;
    mask.copy(header, 2);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(8);
    header[0] = 129;
    header[1] = 128 | 126;
    header.writeUInt16BE(payload.length, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 129;
    header[1] = 128 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
    mask.copy(header, 10);
  }
  socket.write(Buffer.concat([header, masked]));
  return id;
}
function wsConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(wsUrl);
    const key = Buffer.from(Math.random().toString()).toString("base64");
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Connection": "Upgrade",
        "Upgrade": "websocket",
        "Sec-WebSocket-Key": key,
        "Sec-WebSocket-Version": "13"
      }
    });
    req.on("upgrade", (_res, socket) => {
      let pendingResolve = null;
      const queue = [];
      let buf = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (true) {
          if (buf.length < 2) return;
          const len = buf[1] & 127;
          let start = 2, pLen = len;
          if (len === 126) {
            if (buf.length < 4) return;
            pLen = buf.readUInt16BE(2);
            start = 4;
          } else if (len === 127) {
            if (buf.length < 10) return;
            pLen = Number(buf.readBigUInt64BE(2));
            start = 10;
          }
          if (buf.length < start + pLen) return;
          const data = buf.subarray(start, start + pLen).toString();
          buf = buf.subarray(start + pLen);
          try {
            const parsed = JSON.parse(data);
            if (pendingResolve) {
              const r = pendingResolve;
              pendingResolve = null;
              r(parsed);
            } else queue.push(parsed);
          } catch {
          }
        }
      });
      resolve({
        socket,
        receive: () => queue.length > 0 ? Promise.resolve(queue.shift()) : new Promise((r) => {
          pendingResolve = r;
        })
      });
    });
    req.on("error", reject);
    req.end();
  });
}
async function cdp(socket, receive, method, params = {}) {
  const id = wsSend(socket, method, params);
  const deadline = Date.now() + 1e4;
  while (Date.now() < deadline) {
    const msg = await Promise.race([receive(), sleep(1e4).then(() => null)]);
    if (msg === null) throw new Error(`CDP timeout: ${method}`);
    if (msg.id === id) return msg;
  }
  throw new Error(`CDP timeout: ${method}`);
}
async function extractBrowserState(browser, domain) {
  const tempDir = mkdtempSync(join(tmpdir(), "vibe-browser-"));
  const tempUserDataDir = join(tempDir, "userdata");
  try {
    cpSync(browser.userDataDir, tempUserDataDir, { recursive: true });
  } catch {
    mkdirSync(tempUserDataDir, { recursive: true });
    const localState = join(browser.userDataDir, "Local State");
    if (existsSync(localState)) cpSync(localState, join(tempUserDataDir, "Local State"));
    cpSync(
      join(browser.userDataDir, browser.profileName),
      join(tempUserDataDir, browser.profileName),
      { recursive: true }
    );
  }
  for (const lock of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      unlinkSync(join(tempUserDataDir, lock));
    } catch {
    }
  }
  const port = 9200 + Math.floor(Math.random() * 800);
  const proc = spawn(browser.executable, [
    `--remote-debugging-port=${port}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${tempUserDataDir}`,
    `--profile-directory=${browser.profileName}`
  ], { stdio: ["ignore", "ignore", "ignore"], detached: false });
  const state = { cookies: [], localStorage: {} };
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      try {
        targets = await httpGet(`http://127.0.0.1:${port}/json`);
        if (targets?.length) break;
      } catch {
      }
    }
    if (!targets?.length) throw new Error("CDP endpoint never became ready");
    const wsUrl = (targets.find((t) => t.type === "page") || targets[0]).webSocketDebuggerUrl;
    const { socket, receive } = await wsConnect(wsUrl);
    const cookieResult = await cdp(socket, receive, "Network.getAllCookies");
    const raw = cookieResult.result?.cookies || [];
    state.cookies = raw.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      expires: c.expires === -1 ? -1 : c.expires ?? -1,
      secure: c.secure || false,
      httpOnly: c.httpOnly || false,
      sameSite: c.sameSite === "Strict" ? "Strict" : c.sameSite === "Lax" ? "Lax" : "None"
    }));
    if (domain) {
      const protocol = domain.includes("localhost") || domain.match(/^\d/) ? "http" : "https";
      await cdp(socket, receive, "Page.enable");
      await cdp(socket, receive, "Page.navigate", { url: `${protocol}://${domain}` });
      await sleep(2e3);
      const lsResult = await cdp(socket, receive, "Runtime.evaluate", {
        expression: "JSON.stringify(Object.fromEntries(Object.entries(localStorage)))",
        returnByValue: true
      });
      const lsValue = lsResult.result?.result?.value;
      if (lsValue) {
        try {
          state.localStorage = JSON.parse(lsValue);
        } catch {
        }
      }
    }
    socket.destroy();
  } finally {
    try {
      proc.kill("SIGTERM");
    } catch {
    }
    await sleep(500);
    try {
      proc.kill("SIGKILL");
    } catch {
    }
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
    }
  }
  return state;
}

// src/commands/open.ts
import http2 from "http";
function sleep2(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function httpGet2(url) {
  return new Promise((resolve, reject) => {
    http2.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON`));
        }
      });
    }).on("error", reject);
  });
}
function findChromiumExecutable() {
  try {
    const browserType = chromium;
    return browserType.executablePath();
  } catch {
    return null;
  }
}
async function open(opts) {
  if (hasSession()) {
    console.error("Browser already open. Run `playwright-cli close` first, or use `navigate`.");
    process.exit(1);
  }
  let state = null;
  if (opts.cookies) {
    const domain = new URL(opts.url).host;
    const profileKey = opts.profile || "default";
    const cached = readStateCache(domain, profileKey);
    if (cached) {
      state = { cookies: cached.cookies, localStorage: cached.localStorage };
      console.error(`Reusing cached state (${state.cookies.length} cookies + ${Object.keys(state.localStorage).length} localStorage entries)`);
    } else {
      const devBrowser = findBrowser(opts.profile);
      if (!devBrowser) {
        console.error("No Chromium browser found for cookie extraction.");
        console.error("Launching without cookies.");
      } else {
        const profile = devBrowser.allProfiles.find((p) => p.name === devBrowser.profileName);
        console.error(`Extracting from ${devBrowser.config.name} \u2014 "${profile?.displayName || devBrowser.profileName}"`);
        state = await extractBrowserState(devBrowser, domain);
        console.error(`Extracted ${state.cookies.length} cookies + ${Object.keys(state.localStorage).length} localStorage entries`);
        saveStateCache(state, domain, profileKey);
      }
    }
  }
  const cdpPort = 9300 + Math.floor(Math.random() * 700);
  const execPath = findChromiumExecutable();
  if (!execPath) {
    console.error("Chromium not found. Run: npx playwright install chromium");
    process.exit(1);
  }
  const browserArgs = [
    `--remote-debugging-port=${cdpPort}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    ...opts.headless ? ["--headless=new", "--disable-gpu"] : ["--start-maximized"]
  ];
  const browserProc = spawn2(execPath, browserArgs, {
    detached: true,
    stdio: "ignore"
  });
  browserProc.unref();
  const browserPid = browserProc.pid;
  const cdpUrl = `http://127.0.0.1:${cdpPort}`;
  for (let i = 0; i < 30; i++) {
    await sleep2(200);
    try {
      const targets = await httpGet2(`${cdpUrl}/json/version`);
      if (targets) break;
    } catch {
    }
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext({ viewport: null });
  if (state && state.cookies.length > 0) {
    await context.addCookies(state.cookies);
    console.error("Cookies injected.");
  }
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  await page.goto(opts.url, { waitUntil: "networkidle" });
  if (state && Object.keys(state.localStorage).length > 0) {
    await page.evaluate((items) => {
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    }, state.localStorage);
    await page.reload({ waitUntil: "networkidle" });
    console.error("localStorage injected.");
  }
  saveSession({
    wsEndpoint: cdpUrl,
    pid: browserPid,
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const title = await page.title();
  const finalUrl = page.url();
  console.log(JSON.stringify({ url: finalUrl, title }, null, 2));
  console.error(`Browser ready (pid: ${browserPid}, cdp: ${cdpUrl})`);
}
export {
  open
};
