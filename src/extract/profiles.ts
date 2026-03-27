/**
 * Detect Chromium browsers and profiles on the system.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform, homedir } from 'node:os';
import type { BrowserConfig, ProfileInfo, ResolvedBrowser } from './types.js';

export const CHROMIUM_BROWSERS: BrowserConfig[] = [
  {
    name: 'Chrome',
    mac: 'Google/Chrome',
    linux: 'google-chrome',
    win: 'Google\\Chrome\\User Data',
    macExec: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linuxExec: 'google-chrome',
    winExec: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  },
  {
    name: 'Brave',
    mac: 'BraveSoftware/Brave-Browser',
    linux: 'BraveSoftware/Brave-Browser',
    win: 'BraveSoftware\\Brave-Browser\\User Data',
    macExec: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    linuxExec: 'brave-browser',
    winExec: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  },
  {
    name: 'Edge',
    mac: 'Microsoft Edge',
    linux: 'microsoft-edge',
    win: 'Microsoft\\Edge\\User Data',
    macExec: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    linuxExec: 'microsoft-edge',
    winExec: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  },
  {
    name: 'Arc',
    mac: 'Arc/User Data',
    linux: 'arc',
    win: 'Arc\\User Data',
    macExec: '/Applications/Arc.app/Contents/MacOS/Arc',
    linuxExec: 'arc',
    winExec: null,
  },
];

function getUserDataDir(browser: BrowserConfig): string | null {
  const p = platform();
  if (p === 'darwin') return join(homedir(), 'Library', 'Application Support', browser.mac);
  if (p === 'linux') return join(homedir(), '.config', browser.linux);
  if (p === 'win32') return join(process.env.LOCALAPPDATA || '', browser.win);
  return null;
}

function getExecutable(browser: BrowserConfig): string | null {
  const p = platform();
  if (p === 'darwin') return browser.macExec;
  if (p === 'linux') return browser.linuxExec;
  if (p === 'win32') return browser.winExec;
  return null;
}

export function listProfiles(userDataDir: string): ProfileInfo[] {
  const profiles: ProfileInfo[] = [];
  let lastUsed: string | null = null;

  const localStatePath = join(userDataDir, 'Local State');
  if (existsSync(localStatePath)) {
    try {
      const localState = JSON.parse(readFileSync(localStatePath, 'utf-8'));
      lastUsed = localState?.profile?.last_used || null;
    } catch {}
  }

  const entries = readdirSync(userDataDir);
  for (const entry of entries) {
    if (entry === 'Default' || entry.startsWith('Profile ')) {
      const prefsPath = join(userDataDir, entry, 'Preferences');
      let displayName = entry;
      if (existsSync(prefsPath)) {
        try {
          const prefs = JSON.parse(readFileSync(prefsPath, 'utf-8'));
          displayName = prefs?.profile?.name || entry;
        } catch {}
      }
      profiles.push({
        name: entry,
        displayName,
        isDefault: entry === lastUsed || (lastUsed === null && entry === 'Default'),
      });
    }
  }

  profiles.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.name.localeCompare(b.name);
  });

  return profiles;
}

export function findBrowser(profileOverride?: string): ResolvedBrowser | null {
  for (const config of CHROMIUM_BROWSERS) {
    const userDataDir = getUserDataDir(config);
    const exec = getExecutable(config);
    if (userDataDir && existsSync(userDataDir) && exec) {
      if (platform() !== 'linux' && !existsSync(exec)) continue;

      const allProfiles = listProfiles(userDataDir);
      if (allProfiles.length === 0) continue;

      let profileName: string;
      if (profileOverride) {
        const match = allProfiles.find(
          p => p.name === profileOverride || p.displayName === profileOverride
        );
        if (!match) {
          console.error(`Profile "${profileOverride}" not found in ${config.name}.`);
          console.error('Available profiles:');
          for (const p of allProfiles) {
            console.error(`  ${p.name} — "${p.displayName}"${p.isDefault ? ' (default)' : ''}`);
          }
          process.exit(1);
        }
        profileName = match.name;
      } else {
        profileName = allProfiles[0].name;
      }

      return { config, userDataDir, executable: exec, profileName, allProfiles };
    }
  }
  return null;
}
