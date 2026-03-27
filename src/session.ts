/**
 * Session management — persists browser connection between CLI invocations.
 *
 * On `open`: launches Chromium with --remote-debugging-port, saves connection
 * info to ~/.vibe-browser/session.json.
 *
 * On subsequent commands: reads session.json, reconnects via connectOverCDP.
 *
 * On `close`: disconnects, kills browser, removes session.json.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SESSION_DIR = join(homedir(), '.vibe-browser');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

interface SessionInfo {
  wsEndpoint: string;
  pid: number;
  startedAt: string;
}

interface ConnectedSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export function hasSession(): boolean {
  return existsSync(SESSION_FILE);
}

export function readSession(): SessionInfo | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveSession(info: SessionInfo): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(info, null, 2));
}

export function clearSession(): void {
  try { unlinkSync(SESSION_FILE); } catch {}
}

export async function connect(): Promise<ConnectedSession> {
  const session = readSession();
  if (!session) {
    throw new Error('No browser session. Run `vibe-browser open <url>` first.');
  }

  try {
    const browser = await chromium.connectOverCDP(session.wsEndpoint);
    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) throw new Error('No browser context found');
    const pages = context.pages();
    const page = pages[pages.length - 1] || await context.newPage();
    return { browser, context, page };
  } catch (err: any) {
    clearSession();
    throw new Error(`Failed to connect to browser (session may be stale): ${err.message}`);
  }
}

export async function disconnect(browser: Browser): Promise<void> {
  try {
    // Disconnect Playwright's CDP connection without killing the browser process
    // browser.close() on a CDP-connected browser just disconnects
    await browser.close();
  } catch {}
}
