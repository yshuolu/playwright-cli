/**
 * open <url> [--cookies] [--headed] [--profile <name>]
 *
 * Launches Chromium as a detached background process with --remote-debugging-port,
 * optionally injects cookies + localStorage, navigates to the URL, and exits.
 *
 * The browser survives because it's a standalone OS process, not managed by Playwright.
 * Subsequent commands connect to it via CDP.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { saveSession, hasSession, readStateCache, saveStateCache } from '../session.js';
import { findBrowser } from '../extract/profiles.js';
import { extractBrowserState } from '../extract/browser-state.js';
import http from 'node:http';

interface OpenOptions {
  url: string;
  cookies: boolean;
  headless: boolean;
  profile?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON`)); }
      });
    }).on('error', reject);
  });
}

function findChromiumExecutable(): string | null {
  // Use Playwright's bundled Chromium
  try {
    const browserType = chromium;
    return (browserType as any).executablePath();
  } catch {
    return null;
  }
}

export async function open(opts: OpenOptions): Promise<void> {
  if (hasSession()) {
    console.error('Browser already open. Run `playwright-cli close` first, or use `navigate`.');
    process.exit(1);
  }

  // Extract browser state if --cookies (reuse cache if fresh)
  let state: { cookies: any[]; localStorage: Record<string, string> } | null = null;
  if (opts.cookies) {
    const domain = new URL(opts.url).host;
    const profileKey = opts.profile || 'default';

    // Check cache first
    const cached = readStateCache(domain, profileKey);
    if (cached) {
      state = { cookies: cached.cookies, localStorage: cached.localStorage };
      console.error(`Reusing cached state (${state.cookies.length} cookies + ${Object.keys(state.localStorage).length} localStorage entries)`);
    } else {
      const devBrowser = findBrowser(opts.profile);
      if (!devBrowser) {
        console.error('No Chromium browser found for cookie extraction.');
        console.error('Launching without cookies.');
      } else {
        const profile = devBrowser.allProfiles.find(p => p.name === devBrowser.profileName);
        console.error(`Extracting from ${devBrowser.config.name} — "${profile?.displayName || devBrowser.profileName}"`);
        state = await extractBrowserState(devBrowser, domain);
        console.error(`Extracted ${state.cookies.length} cookies + ${Object.keys(state.localStorage).length} localStorage entries`);
        saveStateCache(state, domain, profileKey);
      }
    }
  }

  // Launch Chromium as a detached OS process (survives our exit)
  const cdpPort = 9300 + Math.floor(Math.random() * 700);
  const execPath = findChromiumExecutable();
  if (!execPath) {
    console.error('Chromium not found. Run: npx playwright install chromium');
    process.exit(1);
  }

  const browserArgs = [
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    ...(opts.headless ? ['--headless=new', '--disable-gpu'] : ['--start-maximized']),
  ];

  const browserProc = spawn(execPath, browserArgs, {
    detached: true,
    stdio: 'ignore',
  });
  browserProc.unref();

  const browserPid = browserProc.pid!;
  const cdpUrl = `http://127.0.0.1:${cdpPort}`;

  // Wait for CDP to be ready
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const targets = await httpGet(`${cdpUrl}/json/version`);
      if (targets) break;
    } catch {}
  }

  // Connect via CDP using Playwright
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext({ viewport: null });

  // Inject cookies before navigation
  if (state && state.cookies.length > 0) {
    await context.addCookies(state.cookies);
    console.error('Cookies injected.');
  }

  // Navigate
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  await page.goto(opts.url, { waitUntil: 'networkidle' });

  // Inject localStorage after navigation
  if (state && Object.keys(state.localStorage).length > 0) {
    await page.evaluate((items) => {
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    }, state.localStorage);
    await page.reload({ waitUntil: 'networkidle' });
    console.error('localStorage injected.');
  }

  // Save session — browser PID so close can kill it
  saveSession({
    wsEndpoint: cdpUrl,
    pid: browserPid,
    startedAt: new Date().toISOString(),
  });

  // Output page info and exit — browser stays alive as a detached process
  const title = await page.title();
  const finalUrl = page.url();
  console.log(JSON.stringify({ url: finalUrl, title }, null, 2));
  console.error(`Browser ready (pid: ${browserPid}, cdp: ${cdpUrl})`);

  // Disconnect Playwright without closing the browser.
  // Do NOT call browser.close() — on a CDP connection it wipes the browser state.
  // Just exit the process. The detached Chromium process keeps running with its state intact.
}
