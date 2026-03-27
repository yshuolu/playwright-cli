import {
  connect
} from "./chunk-HHEN3XC6.js";

// src/commands/network.ts
async function network(opts) {
  const { browser, page } = await connect();
  try {
    const requests = [];
    const handler = (request) => {
      const entry = {
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        headers: request.headers()
      };
      if (opts.method && entry.method !== opts.method.toUpperCase()) return;
      if (opts.url && !entry.url.includes(opts.url)) return;
      requests.push(entry);
    };
    page.on("request", handler);
    await page.waitForTimeout(500);
    page.off("request", handler);
    console.log(JSON.stringify(requests, null, 2));
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  network
};
