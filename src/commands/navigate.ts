/**
 * navigate <url>
 *
 * Navigates the current page to a new URL.
 */

import { connect } from '../session.js';

export async function navigate(url: string): Promise<void> {
  const { browser, page } = await connect();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const title = await page.title();
    console.log(JSON.stringify({ url: page.url(), title }, null, 2));
  } finally {
    browser.close().catch(() => {});
  }
}
