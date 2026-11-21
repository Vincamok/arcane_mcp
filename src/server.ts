import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";
import { ArcaneClient } from "./arcane.js";
import { buildInputSchema, parseOperations, toolName, type Operation } from "./openapi.js";

type Tool = { name: string; description: string; inputSchema: any; annotations?: any };
type Handler = (args: Record<string, any>) => Promise<string>;

export interface Built {
  tools: Tool[];
  handlers: Map<string, Handler>;
  operations: Operation[];
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + `\n…[truncated ${s.length - max} chars; narrow the query with limit/search parameters]` : s;
}

export async function buildTools(cfg: Config, client: ArcaneClient, spec: any): Promise<Built> {
  const operations = parseOperations(spec);
  const byId = new Map(operations.map((o) => [o.id, o]));
  const tools: Tool[] = [];
  const handlers = new Map<string, Handler>();
  const hasEnv = !!cfg.defaultEnvironmentId;

  const run = async (op: Operation, args: Record<string, any>) => {
    if (cfg.readOnly && op.method !== "GET") throw new Error(`Server is in read-only mode: ${op.method} ${op.path} is blocked`);
    if (!op.supported) throw new Error(`Operation ${op.id} (streaming/binary/multipart) is not supported through MCP`);
    const r = await client.call(op, args);
    const body = r.json !== undefined ? JSON.stringify(r.json, null, 1) : r.text;
    if (r.status >= 400) throw new Error(`HTTP ${r.status} ${op.method} ${op.path}\n${truncate(body, 4000)}`);
    return truncate(body || `OK (HTTP ${r.status})`, cfg.maxResponseChars);
  };

  // ---- generic meta tools (always available, cover the whole API) ----
  tools.push({
    name: "arcane_search_operations",
    description: `Search the ${operations.length} operations of the Arcane API (v${spec.info?.version}). Returns operationId, method, path and summary. Use with arcane_call.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords matched against id, path, summary" },
        tag: { type: "string", description: "Filter by tag, e.g. Containers, Projects, Swarm" },
        limit: { type: "number", default: 30 },
      },
    },
    annotations: { readOnlyHint: true },
  });
  handlers.set("arcane_search_operations", async (a) => {
    const q = String(a.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const tag = a.tag ? String(a.tag).toLowerCase() : undefined;
    const hits = operations
      .filter((o) => (!tag || o.tag.toLowerCase() === tag))
      .filter((o) => !cfg.readOnly || o.method === "GET")
      .filter((o) => q.every((w) => `${o.id} ${o.path} ${o.summary} ${o.tag}`.toLowerCase().includes(w)))
      .slice(0, Number(a.limit ?? 30));
    return hits.map((o) => `${o.id}\t${o.method} ${o.path}\t[${o.tag}] ${o.summary}${o.supported ? "" : " (unsupported)"}`).join("\n") || "No match";
  });

  tools.push({
    name: "arcane_describe_operation",
    description: "Show the parameters and JSON body schema of an Arcane API operation.",
    inputSchema: { type: "object", properties: { operationId: { type: "string" } }, required: ["operationId"] },
    annotations: { readOnlyHint: true },
  });
  handlers.set("arcane_describe_operation", async (a) => {
    const op = byId.get(String(a.operationId));
    if (!op) throw new Error(`Unknown operationId '${a.operationId}'`);
    return JSON.stringify({ id: op.id, method: op.method, path: op.path, summary: op.summary, description: op.description, input: buildInputSchema(spec, op, hasEnv) }, null, 1);
  });

  tools.push({
    name: "arcane_call",
    description:
      "Call any Arcane API operation by operationId (see arcane_search_operations). Pass path/query parameters in 'params' and the JSON payload in 'body'." +
      (cfg.readOnly ? " Server is read-only: only GET operations work." : " Beware: write/delete operations act on the real Docker host."),
    inputSchema: {
      type: "object",
      properties: {
        operationId: { type: "string" },
        params: { type: "object", description: "Path and query parameters, e.g. {\"id\":\"0\",\"containerId\":\"abc\"}" },
        body: { type: "object", description: "JSON request body" },
      },
      required: ["operationId"],
    },
  });
  handlers.set("arcane_call", async (a) => {
    const op = byId.get(String(a.operationId));
    if (!op) throw new Error(`Unknown operationId '${a.operationId}'`);
    return run(op, { ...(a.params ?? {}), ...(a.body !== undefined ? { body: a.body } : {}) });
  });

  // ---- one tool per operation for the selected toolsets ----
  if (cfg.toolsets !== "none") {
    for (const op of operations) {
      if (!op.supported) continue;
      if (cfg.toolsets !== "all" && !cfg.toolsets.has(op.tag.toLowerCase())) continue;
      if (cfg.readOnly && op.method !== "GET") continue;
      let name = toolName(op);
      if (handlers.has(name)) name = name.slice(0, 60) + "_" + tools.length;
      tools.push({
        name,
        description: `[${op.tag}] ${op.summary}. ${op.method} ${op.path}. ${op.description}`.trim().slice(0, 600),
        inputSchema: buildInputSchema(spec, op, hasEnv),
        annotations: { readOnlyHint: op.readOnly, destructiveHint: op.destructive, idempotentHint: ["GET", "PUT", "DELETE"].includes(op.method) },
      });
      handlers.set(name, (args) => run(op, args));
    }
  }
  return { tools, handlers, operations };
}

export function createServer(built: Built, version: string): Server {
  const server = new Server({ name: "arcane-mcp", version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: built.tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const h = built.handlers.get(req.params.name);
    if (!h) return { isError: true, content: [{ type: "text", text: `Unknown tool ${req.params.name}` }] };
    try {
      return { content: [{ type: "text", text: await h((req.params.arguments ?? {}) as Record<string, any>) }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: e?.message ?? String(e) }] };
    }
  });
  return server;
}
