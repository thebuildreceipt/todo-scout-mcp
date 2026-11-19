#!/usr/bin/env node
/**
 * todo-scout-mcp — a tiny MCP server.
 *
 * It gives any MCP-compatible AI assistant (Claude Code, Claude Desktop, Cursor, ...)
 * two TOOLS and one RESOURCE:
 *   - find_todos:      scan a folder for TODO / FIXME / HACK comments
 *   - todo_stats:      count them per file so the AI can prioritise
 *   - resource "todo-scout://guide": how the AI should triage what it finds
 *
 * Talks over stdio: the AI app starts this process and sends JSON-RPC messages.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const TAGS = ["TODO", "FIXME", "HACK"] as const;
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "venv", ".venv", "__pycache__"]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".go", ".rs", ".java", ".rb", ".php", ".swift", ".kt", ".c", ".cpp", ".h", ".cs", ".md"]);
const MAX_FILES = 5000;

type Hit = { file: string; line: number; tag: string; text: string };

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  if (files.length >= MAX_FILES) return files;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) await walk(full, files);
    } else if (CODE_EXT.has(path.extname(entry.name))) {
      files.push(full);
      if (files.length >= MAX_FILES) break;
    }
  }
  return files;
}

async function scan(root: string, tags: readonly string[]): Promise<Hit[]> {
  const info = await stat(root);
  if (!info.isDirectory()) throw new Error(`${root} is not a directory`);
  const pattern = new RegExp(`\\b(${tags.join("|")})\\b[:\\s]?(.*)`);
  const hits: Hit[] = [];
  for (const file of await walk(root)) {
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((content, i) => {
      const m = content.match(pattern);
      if (m) hits.push({ file: path.relative(root, file), line: i + 1, tag: m[1], text: m[2].trim() });
    });
  }
  return hits;
}

const server = new McpServer({ name: "todo-scout", version: "1.0.0" });

server.registerTool(
  "find_todos",
  {
    title: "Find TODOs",
    description: "Scan a project folder for TODO, FIXME and HACK comments. Returns file, line and comment text.",
    inputSchema: {
      path: z.string().describe("Absolute path to the project folder"),
      tags: z.array(z.enum(TAGS)).optional().describe("Which tags to look for (default: all)"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ path: root, tags }) => {
    const hits = await scan(root, tags ?? TAGS);
    const body = hits.length
      ? hits.map((h) => `${h.file}:${h.line}  [${h.tag}] ${h.text}`).join("\n")
      : "No TODOs found. Clean codebase!";
    return { content: [{ type: "text", text: `Found ${hits.length} item(s):\n${body}` }] };
  }
);

server.registerTool(
  "todo_stats",
  {
    title: "TODO stats",
    description: "Count TODO/FIXME/HACK comments per file, sorted by most first.",
    inputSchema: { path: z.string().describe("Absolute path to the project folder") },
    annotations: { readOnlyHint: true },
  },
  async ({ path: root }) => {
    const counts = new Map<string, number>();
    for (const h of await scan(root, TAGS)) counts.set(h.file, (counts.get(h.file) ?? 0) + 1);
    const rows = [...counts].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${String(n).padStart(3)}  ${f}`);
    return { content: [{ type: "text", text: rows.length ? rows.join("\n") : "No TODOs found." }] };
  }
);

server.registerResource(
  "triage-guide",
  "todo-scout://guide",
  { title: "TODO triage guide", description: "How to prioritise TODOs", mimeType: "text/markdown" },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "# Triage rules\n1. FIXME first: these are known bugs.\n2. HACK next: tech debt that can break.\n3. TODO last, oldest files first.\nAlways suggest the smallest fix.",
    }],
  })
);

await server.connect(new StdioServerTransport());
// Never console.log in a stdio server: stdout is the protocol channel. Use stderr.
console.error("todo-scout MCP server running on stdio");
