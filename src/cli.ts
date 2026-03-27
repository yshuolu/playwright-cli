#!/usr/bin/env node

/**
 * playwright-cli — Browser automation CLI with built-in auth state injection.
 *
 * Wraps Playwright with automatic cookie + localStorage extraction from
 * Chrome profiles. One command to open an authenticated browser session,
 * then interact via subsequent commands.
 */

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): boolean {
  return args.includes(`--${name}`) || args.includes(`-${name[0]}`);
}

function hasHelp(): boolean {
  return args.includes('--help') || args.includes('-h');
}

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

function positional(index: number): string | undefined {
  let pos = 0;
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { i++; continue; }
    if (args[i].startsWith('-') && args[i].length === 2) { continue; }
    if (pos === index) return args[i];
    pos++;
  }
  return undefined;
}

const MAIN_HELP = `playwright-cli — Browser automation with built-in auth state injection.

Usage: playwright-cli <command> [options]

Lifecycle:
  1. open     — once per session. Launches browser. First run ~20s (extracts cookies),
                subsequent runs ~2s (cached). Browser stays open in the background.
  2. interact — navigate, click, fill, screenshot, snapshot, exec. Run as many as needed.
                Each command connects to the open browser, acts, and exits instantly.
  3. close    — once when done. Kills the browser.

  Do NOT close and reopen between tests. Use navigate to go to a new page.

Commands:
  open <url>       Launch browser. --cookies injects auth state from Chrome.
  navigate <url>   Go to a new URL (browser must be open).
  screenshot       Capture page as PNG.
  snapshot         Capture ARIA accessibility tree (text).
  click <sel>      Click an element.
  fill <sel> <val> Fill an input field.
  exec "<code>"    Execute Playwright code (access to page, context, browser).
  console          Get browser console messages.
  network          Get network requests.
  close            Kill browser and clean up session.
  profiles         List available Chrome profiles.

Run playwright-cli <command> -h for command-specific help.`;

const CMD_HELP: Record<string, string> = {
  open: `playwright-cli open — Launch browser with optional auth state injection.

Usage: playwright-cli open <url> [options]

Options:
  --cookies          Extract cookies + localStorage from Chrome and inject
                     into the browser before navigating. Uses the developer's
                     default Chrome profile.
  --headless         Run without a visible window. Only use when no display
                     is available (CI, cloud agents). Default is headed.
  --profile <name>   Use a specific Chrome profile. Pass the directory name
                     (e.g. "Profile 1") or display name (e.g. "Work").
                     Run 'playwright-cli profiles' to see available profiles.
  -h, --help         Show this help.

The browser stays alive after this command. Use 'navigate', 'screenshot',
'click', etc. to interact. Use 'close' when done.

Examples:
  playwright-cli open http://localhost:3000 --cookies
  playwright-cli open http://localhost:3000 --cookies --profile "Work"
  playwright-cli open http://localhost:3000 --cookies --headless`,

  navigate: `playwright-cli navigate — Navigate to a new URL.

Usage: playwright-cli navigate <url>

Options:
  -h, --help    Show this help.

Example:
  playwright-cli navigate http://localhost:3000/dashboard`,

  screenshot: `playwright-cli screenshot — Capture page as PNG.

Usage: playwright-cli screenshot [options]

Options:
  --output <path>   Save PNG to file (default: stdout).
  --full-page       Capture the full scrollable page.
  -h, --help        Show this help.

Examples:
  playwright-cli screenshot --output /tmp/page.png
  playwright-cli screenshot --full-page --output /tmp/full.png`,

  snapshot: `playwright-cli snapshot — Capture ARIA accessibility tree.

Usage: playwright-cli snapshot

Options:
  -h, --help    Show this help.

Returns the page's semantic structure as text — element roles, names, and
states. Useful for understanding page content without visual screenshots.

Example:
  playwright-cli snapshot`,

  click: `playwright-cli click — Click an element.

Usage: playwright-cli click <selector>

Options:
  -h, --help    Show this help.

The selector can be a CSS selector, text selector, or Playwright locator.

Examples:
  playwright-cli click "button.submit"
  playwright-cli click "text=Sign In"
  playwright-cli click "#login-btn"`,

  fill: `playwright-cli fill — Fill an input field.

Usage: playwright-cli fill <selector> <value>

Options:
  -h, --help    Show this help.

Examples:
  playwright-cli fill "#email" "test@example.com"
  playwright-cli fill "[name=password]" "secret123"`,

  exec: `playwright-cli exec — Execute Playwright code.

Usage: playwright-cli exec "<code>"

Options:
  -h, --help    Show this help.

The code has access to 'page', 'context', and 'browser' objects.
Use 'return' to output a value.

Examples:
  playwright-cli exec "return await page.title();"
  playwright-cli exec "await page.click('button'); return await page.textContent('.result');"
  playwright-cli exec "await page.waitForSelector('.loaded'); return 'ready';"`,

  console: `playwright-cli console — Get browser console messages.

Usage: playwright-cli console

Options:
  -h, --help    Show this help.

Returns console.log, console.error, etc. messages from the current page.`,

  network: `playwright-cli network — Get captured network requests.

Usage: playwright-cli network [options]

Options:
  --method <method>    Filter by HTTP method (GET, POST, etc.).
  --url <substring>    Filter by URL substring.
  -h, --help           Show this help.

Examples:
  playwright-cli network
  playwright-cli network --method POST
  playwright-cli network --url /api/`,

  close: `playwright-cli close — Close the browser and clean up.

Usage: playwright-cli close

Options:
  -h, --help    Show this help.

Closes the browser launched by 'open' and removes the session file.`,

  profiles: `playwright-cli profiles — List available Chrome profiles.

Usage: playwright-cli profiles

Options:
  -h, --help    Show this help.

Shows all profiles found in Chrome, Brave, Edge, or Arc. The default
profile is marked. Use the name with --profile in the 'open' command.`,
};

async function main() {
  // Global help
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(MAIN_HELP);
    return;
  }

  // Per-command help
  if (hasHelp() && CMD_HELP[command]) {
    console.log(CMD_HELP[command]);
    return;
  }

  switch (command) {
    case 'open': {
      const url = positional(0);
      if (!url) { console.log(CMD_HELP.open); process.exit(1); }
      const { open } = await import('./commands/open.js');
      await open({
        url,
        cookies: flag('cookies'),
        headless: flag('headless'),
        profile: flagValue('profile'),
      });
      break;
    }

    case 'navigate': {
      const url = positional(0);
      if (!url) { console.log(CMD_HELP.navigate); process.exit(1); }
      const { navigate } = await import('./commands/navigate.js');
      await navigate(url);
      break;
    }

    case 'screenshot': {
      const { screenshot } = await import('./commands/screenshot.js');
      await screenshot({
        mode: 'screenshot',
        fullPage: flag('full-page'),
        output: flagValue('output'),
      });
      break;
    }

    case 'snapshot': {
      const { screenshot } = await import('./commands/screenshot.js');
      await screenshot({ mode: 'snapshot', fullPage: false });
      break;
    }

    case 'click': {
      const selector = positional(0);
      if (!selector) { console.log(CMD_HELP.click); process.exit(1); }
      const { click } = await import('./commands/click.js');
      await click(selector);
      break;
    }

    case 'fill': {
      const selector = positional(0);
      const value = positional(1);
      if (!selector || value === undefined) { console.log(CMD_HELP.fill); process.exit(1); }
      const { fill } = await import('./commands/fill.js');
      await fill(selector, value);
      break;
    }

    case 'exec': {
      const code = positional(0);
      if (!code) { console.log(CMD_HELP.exec); process.exit(1); }
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
      console.error(`Unknown command: ${command}`);
      console.log(MAIN_HELP);
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
