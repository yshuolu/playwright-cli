import {
  clearSession,
  readSession
} from "./chunk-HHEN3XC6.js";

// src/commands/close.ts
async function close() {
  const session = readSession();
  if (!session) {
    console.error("No browser session to close.");
    return;
  }
  try {
    process.kill(session.pid, "SIGTERM");
  } catch {
  }
  clearSession();
  console.error("Browser closed.");
}
export {
  close
};
