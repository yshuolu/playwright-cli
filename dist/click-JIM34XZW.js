import {
  connect
} from "./chunk-YAW7MKUF.js";

// src/commands/click.ts
async function click(selector) {
  const { browser, page } = await connect();
  try {
    await page.click(selector);
    console.log(JSON.stringify({ action: "click", selector, url: page.url() }));
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  click
};
