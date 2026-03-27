#!/usr/bin/env node

/**
 * vibe-browser — Browser automation CLI with built-in auth state injection.
 *
 * Replaces Playwright MCP for authenticated testing. Extracts cookies +
 * localStorage from the developer's Chrome profile and injects them into
 * a Playwright browser automatically.
 *
 * Commands:
 *   open <url> [--cookies] [--headed] [--profile <name>]
 *   navigate <url>
 *   screenshot [--mode screenshot|snapshot] [--full-page] [--output <path>]
 *   click <selector>
 *   fill <selector> <value>
 *   exec <code>
 *   console
 *   network [--method <method>] [--url <substring>]
 *   close
 *   profiles
 */

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

function positional(index: number): string | undefined {
  // Skip command name, return nth positional arg (skipping flags)
  let pos = 0;
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { i++; continue; } // skip flag + value
    if (pos === index) return args[i];
    pos++;
  }
  return undefined;
}

async function main() {
  switch (command) {
    case 'open': {
      const url = positional(0);
      if (!url) { console.error('Usage: vibe-browser open <url> [--cookies] [--headed] [--profile <name>]'); process.exit(1); }
      const { open } = await import('./commands/open.js');
      await open({
        url,
        cookies: flag('cookies'),
        headed: flag('headed'),
        profile: flagValue('profile'),
      });
      break;
    }

    case 'navigate': {
      const url = positional(0);
      if (!url) { console.error('Usage: vibe-browser navigate <url>'); process.exit(1); }
      const { navigate } = await import('./commands/navigate.js');
      await navigate(url);
      break;
    }

    case 'screenshot': {
      const { screenshot } = await import('./commands/screenshot.js');
      await screenshot({
        mode: (flagValue('mode') || 'screenshot') as 'screenshot' | 'snapshot',
        fullPage: flag('full-page'),
        output: flagValue('output'),
      });
      break;
    }

    case 'snapshot': {
      // Shorthand for screenshot --mode snapshot
      const { screenshot } = await import('./commands/screenshot.js');
      await screenshot({ mode: 'snapshot', fullPage: false });
      break;
    }

    case 'click': {
      const selector = positional(0);
      if (!selector) { console.error('Usage: vibe-browser click <selector>'); process.exit(1); }
      const { click } = await import('./commands/click.js');
      await click(selector);
      break;
    }

    case 'fill': {
      const selector = positional(0);
      const value = positional(1);
      if (!selector || value === undefined) { console.error('Usage: vibe-browser fill <selector> <value>'); process.exit(1); }
      const { fill } = await import('./commands/fill.js');
      await fill(selector, value);
      break;
    }

    case 'exec': {
      const code = positional(0);
      if (!code) { console.error('Usage: vibe-browser exec "<playwright code>"'); process.exit(1); }
      const { exec } = await import('./commands/exec.js');
      await exec(code);
      break;
    }

    case 'console': {
      const { consoleLogs } = await import('./commands/console.js');
      await consoleLogs();
      break;
    }

    case 'network': {
      const { network } = await import('./commands/network.js');
      await network({
        method: flagValue('method'),
        url: flagValue('url'),
      });
      break;
    }

    case 'close': {
      const { close } = await import('./commands/close.js');
      await close();
      break;
    }

    case 'profiles': {
      const { profiles } = await import('./commands/profiles.js');
      profiles();
      break;
    }

    default:
      console.log(`vibe-browser — Browser automation with built-in auth state injection.

Commands:
  open <url> [--cookies] [--headed] [--profile <name>]
      Launch browser, navigate to URL. --cookies extracts and injects
      cookies + localStorage from Chrome. Stays open for subsequent commands.

  navigate <url>
      Navigate the current page to a new URL.

  screenshot [--mode screenshot|snapshot] [--full-page] [--output <path>]
      Capture page state. Default: PNG screenshot. Use --mode snapshot
      for ARIA accessibility tree.

  snapshot
      Shorthand for screenshot --mode snapshot.

  click <selector>
      Click an element.

  fill <selector> <value>
      Fill an input field.

  exec "<code>"
      Execute Playwright code. Has access to page, context, browser.

  console
      Get browser console messages.

  network [--method <method>] [--url <substring>]
      Get captured network requests.

  close
      Close the browser and clean up.

  profiles
      List available Chrome profiles.

Examples:
  vibe-browser open http://localhost:3000 --cookies
  vibe-browser screenshot --output /tmp/page.png
  vibe-browser snapshot
  vibe-browser click "text=Sign In"
  vibe-browser exec "await page.waitForSelector('.loaded'); return await page.title();"
  vibe-browser close`);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
