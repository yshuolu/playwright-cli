# playwright-cli

**Playwright for authenticated testing. One command to get a logged-in browser.**

The problem with `@anthropic-ai/playwright-mcp` and standard Playwright tooling: they launch a clean browser with no sessions. Your app requires login? The agent is stuck.

playwright-cli fixes this. It copies the developer's Chrome profile, extracts cookies + localStorage via CDP, injects them into a fresh Playwright browser, and navigates — all in one command. The agent gets an authenticated session without touching a login form.

## Install

```bash
git clone https://github.com/yshuolu/playwright-cli.git ~/playwright-cli
cd ~/playwright-cli && npm install
```

## Quick Start

```bash
# Open an authenticated browser (steals session from your Chrome)
npx tsx ~/playwright-cli/src/cli.ts open http://localhost:3000 --cookies

# Take a screenshot
npx tsx ~/playwright-cli/src/cli.ts screenshot --output /tmp/page.png

# Get the ARIA accessibility tree
npx tsx ~/playwright-cli/src/cli.ts snapshot

# Interact
npx tsx ~/playwright-cli/src/cli.ts click "text=Dashboard"
npx tsx ~/playwright-cli/src/cli.ts fill "#search" "query"

# Run arbitrary Playwright code
npx tsx ~/playwright-cli/src/cli.ts exec "return await page.title();"

# Done
npx tsx ~/playwright-cli/src/cli.ts close
```

## How Auth Works

When you pass `--cookies`, the CLI:

1. Finds your default Chrome/Brave/Edge/Arc profile
2. Copies it to a temp directory
3. Launches headless Chrome with the copied profile
4. Calls `Network.getAllCookies` via CDP (the browser decrypts its own cookies — no Keychain prompts)
5. Navigates to the target domain and reads `localStorage` via `Runtime.evaluate`
6. Kills the headless browser, cleans up the temp dir
7. Injects cookies + localStorage into a fresh Playwright browser via `context.addCookies()` and `page.evaluate()`

You're logged in. No passwords, no tokens, no OAuth flows.

## Commands

| Command | What it does |
|---|---|
| `open <url>` | Launch browser and navigate. `--cookies` injects auth state. `--headed` shows the window. |
| `navigate <url>` | Go to a new URL in the current browser. |
| `screenshot` | Capture PNG. `--output <path>` to save to file. `--full-page` for full scroll. |
| `snapshot` | Capture ARIA accessibility tree as text. |
| `click <selector>` | Click an element. |
| `fill <selector> <value>` | Fill an input field. |
| `exec "<code>"` | Run Playwright code. Access to `page`, `context`, `browser`. |
| `console` | Get browser console messages. |
| `network` | Get network requests. `--method POST` or `--url /api/` to filter. |
| `close` | Close browser and clean up session. |
| `profiles` | List available Chrome profiles. |

Every command supports `-h` for help.

## Multiple Profiles

```bash
# See what's available
npx tsx ~/playwright-cli/src/cli.ts profiles
# Chrome profiles:
#   Default — "Person 1" (default)
#   Profile 1 — "Work"
#   Profile 2 — "Personal"

# Use a specific profile
npx tsx ~/playwright-cli/src/cli.ts open http://localhost:3000 --cookies --profile "Work"
```

## How Sessions Work

The `open` command launches a browser and keeps it alive. Session info is saved to `~/.vibe-browser/session.json`. Subsequent commands (`screenshot`, `click`, `navigate`, etc.) reconnect to the same browser via CDP. `close` kills the browser and removes the session file.

## Browser Support

Automatically detects and extracts from:

| Browser | macOS | Linux | Windows |
|---|---|---|---|
| Chrome | Yes | Yes | Yes |
| Brave | Yes | Yes | Yes |
| Edge | Yes | Yes | Yes |
| Arc | Yes | Yes | -- |

## License

MIT
