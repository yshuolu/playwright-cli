import {
  findBrowser
} from "./chunk-SXDDRUBI.js";

// src/commands/profiles.ts
function profiles() {
  const browser = findBrowser();
  if (!browser) {
    console.error("No Chromium browser found.");
    process.exit(1);
  }
  console.log(`${browser.config.name} profiles:`);
  for (const p of browser.allProfiles) {
    console.log(`  ${p.name} \u2014 "${p.displayName}"${p.isDefault ? " (default)" : ""}`);
  }
}
export {
  profiles
};
