/**
 * network [--method GET|POST|...] [--url <substring>]
 *
 * Get captured network requests from the current page.
 */

import { connect } from '../session.js';

interface NetworkOptions {
  method?: string;
  url?: string;
}

export async function network(opts: NetworkOptions): Promise<void> {
  const { browser, page } = await connect();
  try {
    // Enable request interception for a short window
    const requests: any[] = [];
    const handler = (request: any) => {
      const entry = {
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        headers: request.headers(),
      };
      if (opts.method && entry.method !== opts.method.toUpperCase()) return;
      if (opts.url && !entry.url.includes(opts.url)) return;
      requests.push(entry);
    };
    page.on('request', handler);
    await page.waitForTimeout(500);
    page.off('request', handler);

    console.log(JSON.stringify(requests, null, 2));
  } finally {
    browser.close().catch(() => {});
  }
}
