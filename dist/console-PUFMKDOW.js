import {
  connect
} from "./chunk-HHEN3XC6.js";

// src/commands/console.ts
async function consoleLogs() {
  const { browser, page } = await connect();
  try {
    const messages = [];
    const handler = (msg) => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    };
    page.on("console", handler);
    await page.waitForTimeout(500);
    page.off("console", handler);
    const errors = await page.evaluate(() => {
      return window.__vibe_console_errors || [];
    }).catch(() => []);
    console.log(JSON.stringify({ messages, errors }, null, 2));
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  consoleLogs
};
