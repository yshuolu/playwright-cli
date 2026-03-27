import {
  clearSession,
  readSession
} from "./chunk-HHEN3XC6.js";

// src/commands/close.ts
import { chromium } from "playwright";
async function close() {
  const session = readSession();
  if (!session) {
    console.error("No browser session to close.");
    return;
  }
  try {
    const browser = await chromium.connectOverCDP(session.wsEndpoint);
    await browser.close();
  } catch {
  }
  clearSession();
  console.error("Browser closed.");
}
export {
  close
};
