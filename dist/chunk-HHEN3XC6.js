// src/session.ts
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var SESSION_DIR = join(homedir(), ".vibe-browser");
var SESSION_FILE = join(SESSION_DIR, "session.json");
function hasSession() {
  return existsSync(SESSION_FILE);
}
function readSession() {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
  } catch {
    return null;
  }
}
function saveSession(info) {
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(info, null, 2));
}
function clearSession() {
  try {
    unlinkSync(SESSION_FILE);
  } catch {
  }
}
async function connect() {
  const session = readSession();
  if (!session) {
    throw new Error("No browser session. Run `vibe-browser open <url>` first.");
  }
  try {
    const browser = await chromium.connectOverCDP(session.wsEndpoint);
    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) throw new Error("No browser context found");
    const pages = context.pages();
    const page = pages[pages.length - 1] || await context.newPage();
    return { browser, context, page };
  } catch (err) {
    clearSession();
    throw new Error(`Failed to connect to browser (session may be stale): ${err.message}`);
  }
}

export {
  hasSession,
  readSession,
  saveSession,
  clearSession,
  connect
};
