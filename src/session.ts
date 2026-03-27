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

// ---------------------------------------------------------------------------
// State cache — reuse extracted cookies + localStorage between sessions
// ---------------------------------------------------------------------------

const STATE_CACHE_FILE = join(SESSION_DIR, 'state-cache.json');
const STATE_CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

interface CachedState {
  cookies: any[];
  localStorage: Record<string, string>;
  extractedAt: string;
  domain: string;
  profile: string;
}

export function readStateCache(domain: string, profile: string): CachedState | null {
  if (!existsSync(STATE_CACHE_FILE)) return null;
  try {
    const cached: CachedState = JSON.parse(readFileSync(STATE_CACHE_FILE, 'utf-8'));
    const age = Date.now() - new Date(cached.extractedAt).getTime();
    if (age > STATE_CACHE_MAX_AGE_MS) return null;
    if (cached.domain !== domain || cached.profile !== profile) return null;
    return cached;
  } catch {
    return null;
  }
}

export function saveStateCache(state: { cookies: any[]; localStorage: Record<string, string> }, domain: string, profile: string): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  const cached: CachedState = { ...state, extractedAt: new Date().toISOString(), domain, profile };
  writeFileSync(STATE_CACHE_FILE, JSON.stringify(cached));
}

export function clearStateCache(): void {
  try { unlinkSync(STATE_CACHE_FILE); } catch {}
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
