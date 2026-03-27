import {
  connect
} from "./chunk-HHEN3XC6.js";

// src/commands/exec.ts
async function exec(code) {
  const { browser, context, page } = await connect();
  try {
    const fn = new Function("page", "context", "browser", `return (async () => { ${code} })();`);
    const result = await fn(page, context, browser);
    if (result !== void 0) {
      console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
    }
  } finally {
    browser.close().catch(() => {
    });
  }
}
export {
  exec
};
