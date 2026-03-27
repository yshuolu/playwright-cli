import {
  connect
} from "./chunk-YAW7MKUF.js";

// src/commands/screenshot.ts
async function screenshot(opts) {
  const { browser, page } = await connect();
  try {
    if (opts.mode === "snapshot") {
      const snapshot = await page.locator("body").ariaSnapshot();
      console.log(snapshot);
    } else {
      const buffer = await page.screenshot({
        fullPage: opts.fullPage,
        type: "png"
      });
      if (opts.output) {
        const { writeFileSync } = await import("fs");
        writeFileSync(opts.output, buffer);
        console.error(`Screenshot saved to ${opts.output}`);
      } else {
        process.stdout.write(buffer);
      }
    }
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  screenshot
};
