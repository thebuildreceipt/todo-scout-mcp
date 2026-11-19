/** Starts the server as an MCP client would and calls each tool once. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: "smoke-test", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: [path.join(here, "index.js")] }));

const tools = await client.listTools();
console.log("Tools:", tools.tools.map((t) => t.name).join(", "));
const target = path.join(here, "..", "example-project");
for (const name of ["find_todos", "todo_stats"]) {
  const res = await client.callTool({ name, arguments: { path: target } });
  console.log(`\n--- ${name} ---\n` + (res.content as { text: string }[])[0].text);
}
const guide = await client.readResource({ uri: "todo-scout://guide" });
console.log("\n--- resource ---\n" + (guide.contents[0] as { text: string }).text);
await client.close();
