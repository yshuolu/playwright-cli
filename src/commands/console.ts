/**
 * console
 *
 * Get browser console log messages from the current page.
 */

import { connect } from '../session.js';

export async function consoleLogs(): Promise<void> {
  const { browser, page } = await connect();
  try {
    // Collect messages for a short window, or return what's buffered
    const messages: any[] = [];
    const handler = (msg: any) => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    };
    page.on('console', handler);

    // Give a moment for any pending messages
    await page.waitForTimeout(500);
    page.off('console', handler);

    // Also evaluate to get any errors
    const errors = await page.evaluate(() => {
      return (window as any).__vibe_console_errors || [];
    }).catch(() => []);

    console.log(JSON.stringify({ messages, errors }, null, 2));
  } finally {
    browser.close().catch(() => {});
  }
}
