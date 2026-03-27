/**
 * open <url> [--cookies] [--headed] [--profile <name>]
 *
 * Launches a browser, optionally injects cookies + localStorage from the
 * developer's Chrome profile, navigates to the URL.
 * Saves session info so subsequent commands can reconnect.
 */

import { chromium } from 'playwright';
import { saveSession, hasSession, clearSession } from '../session.js';
import { findBrowser } from '../extract/profiles.js';
import { extractBrowserState } from '../extract/browser-state.js';

interface OpenOptions {
  url: string;
  cookies: boolean;
  headed: boolean;
  profile?: string;
}

export async function open(opts: OpenOptions): Promise<void> {
  if (hasSession()) {
    console.error('Browser already open. Run `vibe-browser close` first, or use `navigate`.');
    process.exit(1);
  }

  // Extract browser state if --cookies
  let state: { cookies: any[]; localStorage: Record<string, string> } | null = null;
  if (opts.cookies) {
    const browser = findBrowser(opts.profile);
    if (!browser) {
      console.error('No Chromium browser found for cookie extraction.');
      console.error('Launching without cookies.');
    } else {
      const profile = browser.allProfiles.find(p => p.name === browser.profileName);
      console.error(`Extracting from ${browser.config.name} — "${profile?.displayName || browser.profileName}"`);
      const domain = new URL(opts.url).host;
      state = await extractBrowserState(browser, domain);
      console.error(`Extracted ${state.cookies.length} cookies + ${Object.keys(state.localStorage).length} localStorage entries`);
    }
  }

  // Launch browser with CDP endpoint so other processes can connect
  const cdpPort = 9300 + Math.floor(Math.random() * 700);
  const browser = await chromium.launch({
    headless: !opts.headed,
    args: [`--remote-debugging-port=${cdpPort}`],
  });

  // Wait for CDP to be ready
  await new Promise(r => setTimeout(r, 1000));
  const cdpUrl = `http://127.0.0.1:${cdpPort}`;

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  // Inject cookies before navigation
  if (state && state.cookies.length > 0) {
    await context.addCookies(state.cookies);
    console.error('Cookies injected.');
  }

  // Navigate
  const page = await context.newPage();
  await page.goto(opts.url, { waitUntil: 'networkidle' });

  // Inject localStorage after navigation (requires being on the domain)
  if (state && Object.keys(state.localStorage).length > 0) {
    await page.evaluate((items) => {
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    }, state.localStorage);
    await page.reload({ waitUntil: 'networkidle' });
    console.error('localStorage injected.');
  }

  // Save session
  saveSession({
    wsEndpoint: cdpUrl,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });

  // Output page info
  const title = await page.title();
  const url = page.url();
  console.log(JSON.stringify({ url, title }, null, 2));

  // Keep process alive — browser dies when process exits
  console.error(`Browser open at ${cdpUrl}`);
  console.error('Press Ctrl+C to close, or run `vibe-browser close` from another terminal.');

  await new Promise(() => {}); // hang forever
}
