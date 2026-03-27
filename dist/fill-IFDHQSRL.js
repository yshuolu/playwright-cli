import {
  connect
} from "./chunk-YAW7MKUF.js";

// src/commands/fill.ts
async function fill(selector, value) {
  const { browser, page } = await connect();
  try {
    await page.fill(selector, value);
    console.log(JSON.stringify({ action: "fill", selector, value, url: page.url() }));
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  fill
};
