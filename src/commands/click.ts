/**
 * click <selector>
 *
 * Click an element on the current page.
 */

import { connect } from '../session.js';

export async function click(selector: string): Promise<void> {
  const { browser, page } = await connect();
  try {
    await page.click(selector);
    console.log(JSON.stringify({ action: 'click', selector, url: page.url() }));
  } finally {
    browser.close().catch(() => {});
  }
}
