#!/usr/bin/env node

// src/cli.ts
var args = process.argv.slice(2);
var command = args[0];
function flag(name) {
  return args.includes(`--${name}`) || args.includes(`-${name[0]}`);
}
function hasHelp() {
  return args.includes("--help") || args.includes("-h");
}
function flagValue(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return void 0;
}
function positional(index) {
  let pos = 0;
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      i++;
      continue;
    }
    if (args[i].startsWith("-") && args[i].length === 2) {
      continue;
    }
    if (pos === index) return args[i];
    pos++;
  }
  return void 0;
}
var MAIN_HELP = `playwright-cli \u2014 Browser automation with built-in auth state injection.

Usage: playwright-cli <command> [options]

Commands:
  open <url>       Launch browser and navigate. Use --cookies to inject auth state.
  navigate <url>   Navigate the current page to a new URL.
  screenshot       Capture page as PNG.
  snapshot         Capture page as ARIA accessibility tree (text).
  click <sel>      Click an element.
  fill <sel> <val> Fill an input field.
  exec "<code>"    Execute arbitrary Playwright code.
  console          Get browser console messages.
  network          Get captured network requests.
  close            Close the browser and clean up session.
  profiles         List available Chrome profiles.

Run playwright-cli <command> -h for command-specific help.`;
var CMD_HELP = {
  open: `playwright-cli open \u2014 Launch browser with optional auth state injection.

Usage: playwright-cli open <url> [options]

Options:
  --cookies          Extract cookies + localStorage from Chrome and inject
                     into the browser before navigating. Uses the developer's
                     default Chrome profile.
  --headed           Show the browser window (default: headless).
  --profile <name>   Use a specific Chrome profile. Pass the directory name
                     (e.g. "Profile 1") or display name (e.g. "Work").
                     Run 'playwright-cli profiles' to see available profiles.
  -h, --help         Show this help.

The browser stays alive after this command. Use 'navigate', 'screenshot',
'click', etc. to interact. Use 'close' when done.

Examples:
  playwright-cli open http://localhost:3000 --cookies
  playwright-cli open https://myapp.com --cookies --headed
  playwright-cli open http://localhost:3000 --cookies --profile "Work"`,
  navigate: `playwright-cli navigate \u2014 Navigate to a new URL.

Usage: playwright-cli navigate <url>

Options:
  -h, --help    Show this help.

Example:
  playwright-cli navigate http://localhost:3000/dashboard`,
  screenshot: `playwright-cli screenshot \u2014 Capture page as PNG.

Usage: playwright-cli screenshot [options]

Options:
  --output <path>   Save PNG to file (default: stdout).
  --full-page       Capture the full scrollable page.
  -h, --help        Show this help.

Examples:
  playwright-cli screenshot --output /tmp/page.png
  playwright-cli screenshot --full-page --output /tmp/full.png`,
  snapshot: `playwright-cli snapshot \u2014 Capture ARIA accessibility tree.

Usage: playwright-cli snapshot

Options:
  -h, --help    Show this help.

Returns the page's semantic structure as text \u2014 element roles, names, and
states. Useful for understanding page content without visual screenshots.

Example:
  playwright-cli snapshot`,
  click: `playwright-cli click \u2014 Click an element.

Usage: playwright-cli click <selector>

Options:
  -h, --help    Show this help.

The selector can be a CSS selector, text selector, or Playwright locator.

Examples:
  playwright-cli click "button.submit"
  playwright-cli click "text=Sign In"
  playwright-cli click "#login-btn"`,
  fill: `playwright-cli fill \u2014 Fill an input field.

Usage: playwright-cli fill <selector> <value>

Options:
  -h, --help    Show this help.

Examples:
  playwright-cli fill "#email" "test@example.com"
  playwright-cli fill "[name=password]" "secret123"`,
  exec: `playwright-cli exec \u2014 Execute Playwright code.

Usage: playwright-cli exec "<code>"

Options:
  -h, --help    Show this help.

The code has access to 'page', 'context', and 'browser' objects.
Use 'return' to output a value.

Examples:
  playwright-cli exec "return await page.title();"
  playwright-cli exec "await page.click('button'); return await page.textContent('.result');"
  playwright-cli exec "await page.waitForSelector('.loaded'); return 'ready';"`,
  console: `playwright-cli console \u2014 Get browser console messages.

Usage: playwright-cli console

Options:
  -h, --help    Show this help.

Returns console.log, console.error, etc. messages from the current page.`,
  network: `playwright-cli network \u2014 Get captured network requests.

Usage: playwright-cli network [options]

Options:
  --method <method>    Filter by HTTP method (GET, POST, etc.).
  --url <substring>    Filter by URL substring.
  -h, --help           Show this help.

Examples:
  playwright-cli network
  playwright-cli network --method POST
  playwright-cli network --url /api/`,
  close: `playwright-cli close \u2014 Close the browser and clean up.

Usage: playwright-cli close

Options:
  -h, --help    Show this help.

Closes the browser launched by 'open' and removes the session file.`,
  profiles: `playwright-cli profiles \u2014 List available Chrome profiles.

Usage: playwright-cli profiles

Options:
  -h, --help    Show this help.

Shows all profiles found in Chrome, Brave, Edge, or Arc. The default
profile is marked. Use the name with --profile in the 'open' command.`
};
async function main() {
  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(MAIN_HELP);
    return;
  }
  if (hasHelp() && CMD_HELP[command]) {
    console.log(CMD_HELP[command]);
    return;
  }
  switch (command) {
    case "open": {
      const url = positional(0);
      if (!url) {
        console.log(CMD_HELP.open);
        process.exit(1);
      }
      const { open } = await import("./open-AEWDFNZT.js");
      await open({
        url,
        cookies: flag("cookies"),
        headed: flag("headed"),
        profile: flagValue("profile")
      });
      break;
    }
    case "navigate": {
      const url = positional(0);
      if (!url) {
        console.log(CMD_HELP.navigate);
        process.exit(1);
      }
      const { navigate } = await import("./navigate-UGDOUSEE.js");
      await navigate(url);
      break;
    }
    case "screenshot": {
      const { screenshot } = await import("./screenshot-KZ4HQXDQ.js");
      await screenshot({
        mode: "screenshot",
        fullPage: flag("full-page"),
        output: flagValue("output")
      });
      break;
    }
    case "snapshot": {
      const { screenshot } = await import("./screenshot-KZ4HQXDQ.js");
      await screenshot({ mode: "snapshot", fullPage: false });
      break;
    }
    case "click": {
      const selector = positional(0);
      if (!selector) {
        console.log(CMD_HELP.click);
        process.exit(1);
      }
      const { click } = await import("./click-LSAIFEXN.js");
      await click(selector);
      break;
    }
    case "fill": {
      const selector = positional(0);
      const value = positional(1);
      if (!selector || value === void 0) {
        console.log(CMD_HELP.fill);
        process.exit(1);
      }
      const { fill } = await import("./fill-QA7U7L2F.js");
      await fill(selector, value);
      break;
    }
    case "exec": {
      const code = positional(0);
      if (!code) {
        console.log(CMD_HELP.exec);
        process.exit(1);
      }
      const { exec } = await import("./exec-FJBZ3A7U.js");
      await exec(code);
      break;
    }
    case "console": {
      const { consoleLogs } = await import("./console-PUFMKDOW.js");
      await consoleLogs();
      break;
    }
    case "network": {
      const { network } = await import("./network-3HTPFQ3P.js");
      await network({
        method: flagValue("method"),
        url: flagValue("url")
      });
      break;
    }
    case "close": {
      const { close } = await import("./close-3TZ4ZNNV.js");
      await close();
      break;
    }
    case "profiles": {
      const { profiles } = await import("./profiles-UBPB3YRR.js");
      profiles();
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.log(MAIN_HELP);
      process.exit(1);
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
