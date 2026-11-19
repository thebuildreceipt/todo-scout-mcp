# todo-scout-mcp

A tiny MCP server that lets any AI assistant find TODOs, FIXMEs and HACKs in your codebase.
Built in the video **"MCP Explained in 8 Minutes (Build Your First Server)"**.

**Receipts:** about 100 lines of TypeScript · $0 to run (local, no API key) · ~20 min to build.

## What it exposes

| Type | Name | What it does |
|---|---|---|
| Tool | `find_todos` | Scans a folder and returns `file:line [TAG] text` |
| Tool | `todo_stats` | Counts items per file, most first |
| Resource | `todo-scout://guide` | Triage rules the AI can read |

## Run it

```bash
npm install
npm test        # builds, starts the server, calls every tool against ./example-project
```

## Connect it to Claude Code

```bash
npm run build
claude mcp add todo-scout -- node "$(pwd)/dist/index.js"
```

Then ask: *"Use todo-scout to find the FIXMEs in /path/to/my/project and fix the worst one."*

## Connect it to Claude Desktop / Cursor

Add to the app's MCP config:

```json
{
  "mcpServers": {
    "todo-scout": { "command": "node", "args": ["/ABSOLUTE/PATH/demo-repo/dist/index.js"] }
  }
}
```

## The one gotcha

Never `console.log` in a stdio MCP server. Stdout is the protocol channel, so log to stderr (`console.error`).

MIT License
