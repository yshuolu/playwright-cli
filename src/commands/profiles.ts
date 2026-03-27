/**
 * profiles
 *
 * List available browser profiles.
 */

import { findBrowser } from '../extract/profiles.js';

export function profiles(): void {
  const browser = findBrowser();
  if (!browser) {
    console.error('No Chromium browser found.');
    process.exit(1);
  }
  console.log(`${browser.config.name} profiles:`);
  for (const p of browser.allProfiles) {
    console.log(`  ${p.name} — "${p.displayName}"${p.isDefault ? ' (default)' : ''}`);
  }
}
