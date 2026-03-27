import {
  connect
} from "./chunk-YAW7MKUF.js";

// src/commands/navigate.ts
async function navigate(url) {
  const { browser, page } = await connect();
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const title = await page.title();
    console.log(JSON.stringify({ url: page.url(), title }, null, 2));
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  navigate
};
