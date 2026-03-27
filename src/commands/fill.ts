/**
 * fill <selector> <value>
 *
 * Fill an input element on the current page.
 */

import { connect } from '../session.js';

export async function fill(selector: string, value: string): Promise<void> {
  const { browser, page } = await connect();
  try {
    await page.fill(selector, value);
    console.log(JSON.stringify({ action: 'fill', selector, value, url: page.url() }));
  } finally {
    browser.close().catch(() => {});
  }
}
