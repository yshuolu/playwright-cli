/**
 * screenshot [--mode screenshot|snapshot|annotated] [--full-page]
 *
 * Captures the current page state.
 * - screenshot (default): PNG to stdout or file
 * - snapshot: ARIA accessibility tree (text)
 * - annotated: PNG with element labels (TBD)
 */

import { connect } from '../session.js';

interface ScreenshotOptions {
  mode: 'screenshot' | 'snapshot';
  fullPage: boolean;
  output?: string;
}

export async function screenshot(opts: ScreenshotOptions): Promise<void> {
  const { browser, page } = await connect();

  try {
    if (opts.mode === 'snapshot') {
      // Use Playwright's locator.ariaSnapshot for ARIA tree
      const snapshot = await page.locator('body').ariaSnapshot();
      console.log(snapshot);
    } else {
      const buffer = await page.screenshot({
        fullPage: opts.fullPage,
        type: 'png',
      });

      if (opts.output) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(opts.output, buffer);
        console.error(`Screenshot saved to ${opts.output}`);
      } else {
        // Write raw PNG to stdout
        process.stdout.write(buffer);
      }
    }
  } finally {
    browser.close().catch(() => {});
  }
}
