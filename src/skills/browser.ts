export function browser(): string {
  return `---
description: Browse the web, interact with pages, fill forms, and extract data using a real browser via Playwright MCP. Use when user says 'open this page', 'browse to', 'fill out the form', 'scrape this site', 'take a screenshot', 'test this URL', 'check this website'. Do NOT use for web research across multiple sources (use /research-web instead).
---

# /browser — Browser Automation via Playwright

Control a real browser to navigate pages, interact with elements, fill forms, extract data, and test websites.

## Critical Rules

- **Install before first use** — run the setup command if Playwright MCP is not already configured.
- **Use accessibility snapshots by default** — they are faster and more reliable than vision-based interaction.
- **One action at a time** — wait for each action to complete before the next.
- **Close tabs when done** — don't leave browser sessions hanging.

## Setup

Before using browser tools, ensure the Playwright MCP server is configured.

**Check if already configured:**
\\\`\\\`\\\`bash
claude mcp list
\\\`\\\`\\\`

If \\\`playwright\\\` is not listed, install it:

\\\`\\\`\\\`bash
claude mcp add playwright -- npx @playwright/mcp@latest
\\\`\\\`\\\`

If \\\`npx\\\` is not available (bun-only environment):
\\\`\\\`\\\`bash
claude mcp add playwright -- bunx @playwright/mcp@latest
\\\`\\\`\\\`

After adding, tell the user to **restart Claude Code** for the MCP server to become available.

## Usage

Once configured, you have access to browser tools provided by the Playwright MCP server. The key tools are:

### Navigation
- \\\`browser_navigate\\\` — Go to a URL
- \\\`browser_go_back\\\` / \\\`browser_go_forward\\\` — History navigation
- \\\`browser_wait\\\` — Wait for page to settle

### Interaction
- \\\`browser_click\\\` — Click an element (by accessibility ref)
- \\\`browser_type\\\` — Type text into a focused field
- \\\`browser_select_option\\\` — Select from dropdowns
- \\\`browser_drag\\\` — Drag from one element to another
- \\\`browser_press_key\\\` — Press keyboard keys (Enter, Tab, etc.)

### Reading
- \\\`browser_snapshot\\\` — Get an accessibility snapshot of the current page (preferred over screenshots)
- \\\`browser_take_screenshot\\\` — Capture a visual screenshot

### Tabs
- \\\`browser_tab_list\\\` — List open tabs
- \\\`browser_tab_new\\\` — Open a new tab
- \\\`browser_tab_select\\\` — Switch to a tab
- \\\`browser_tab_close\\\` — Close a tab

## Workflow

1. **Navigate** to the target URL
2. **Snapshot** to understand the page structure
3. **Interact** with elements using their accessibility refs from the snapshot
4. **Snapshot again** to verify the result
5. **Extract** the data or confirm the action succeeded

### Example: fill out a form

\\\`\\\`\\\`
1. browser_navigate to "https://example.com/signup"
2. browser_snapshot to see the form fields
3. browser_click on the "Name" input field (ref from snapshot)
4. browser_type "Jane Doe"
5. browser_press_key "Tab" to move to next field
6. browser_type "jane@example.com"
7. browser_click on "Submit" button
8. browser_snapshot to verify success message
\\\`\\\`\\\`

### Example: extract data from a page

\\\`\\\`\\\`
1. browser_navigate to the target URL
2. browser_snapshot to read the page content
3. Parse the structured snapshot data for the information needed
4. browser_tab_close when done
\\\`\\\`\\\`

## Troubleshooting

**"Tool not found" errors:**
The Playwright MCP server is not running. Run:
\\\`\\\`\\\`bash
claude mcp add playwright -- npx @playwright/mcp@latest
\\\`\\\`\\\`
Then restart Claude Code.

**Browser doesn't open / headless issues:**
The browser runs headed by default. If running in a headless environment (CI, SSH), the MCP server needs the \\\`--headless\\\` flag:
\\\`\\\`\\\`bash
claude mcp add playwright -- npx @playwright/mcp@latest --headless
\\\`\\\`\\\`

**Page not loading / timeout:**
Use \\\`browser_wait\\\` after navigation to let the page settle. Some SPAs need extra time.

**Can't find an element:**
Take a fresh \\\`browser_snapshot\\\` — the page state may have changed. Use the accessibility refs from the latest snapshot, not cached ones.
`;
}
