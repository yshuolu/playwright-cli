/**
 * exec <code>
 *
 * Execute arbitrary Playwright code against the current page.
 * The code receives `page`, `context`, and `browser` objects.
 *
 * Example:
 *   vibe-browser exec "await page.click('button'); return await page.title();"
 */

import { connect } from '../session.js';

export async function exec(code: string): Promise<void> {
  const { browser, context, page } = await connect();

  try {
    const fn = new Function('page', 'context', 'browser', `return (async () => { ${code} })();`);
    const result = await fn(page, context, browser);
    if (result !== undefined) {
      console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    }
  } finally {
    browser.close().catch(() => {});
  }
}
