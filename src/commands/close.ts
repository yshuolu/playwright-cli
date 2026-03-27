/**
 * close
 *
 * Close the browser and clean up the session.
 */

import { chromium } from 'playwright';
import { readSession, clearSession } from '../session.js';

export async function close(): Promise<void> {
  const session = readSession();
  if (!session) {
    console.error('No browser session to close.');
    return;
  }

  try {
    const browser = await chromium.connectOverCDP(session.wsEndpoint);
    await browser.close();
  } catch {
    // Browser may already be dead — that's fine
  }

  clearSession();
  console.error('Browser closed.');
}
