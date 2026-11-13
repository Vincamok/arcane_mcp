#!/usr/bin/env node
import { createServer as createHttp } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { ArcaneClient } from "./arcane.js";
import { buildTools, createServer } from "./server.js";

const VERSION = "0.1.0";
const log = (...a: unknown[]) => console.error("[arcane-mcp]", ...a); // never stdout (stdio protocol)

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.error(`arcane-mcp ${VERSION}
Env/flags: ARCANE_URL (--url), ARCANE_API_KEY (--api-key) | ARCANE_TOKEN, ARCANE_READ_ONLY, ARCANE_TOOLSETS (default|all|none|tag,tag),
ARCANE_ENVIRONMENT_ID, ARCANE_INSECURE_TLS, MCP_TRANSPORT (stdio|http), MCP_PORT, MCP_HOST, MCP_AUTH_TOKEN`);
  process.exit(0);
}

const cfg = loadConfig();
const client = new ArcaneClient(cfg);
const spec = await client.getSpec();
const built = await buildTools(cfg, client, spec);
log(`Arcane ${spec.info?.version} @ ${cfg.baseUrl} — ${built.tools.length} tools, ${built.operations.length} operations${cfg.readOnly ? ", read-only" : ""}`);

if (cfg.transport === "stdio") {
  await createServer(built, VERSION).connect(new StdioServerTransport());
} else {
  const http = createHttp(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/health") { res.writeHead(200).end("ok"); return; }
    if (url.pathname !== "/mcp") { res.writeHead(404).end("Not found"); return; }
    if (cfg.httpAuthToken && req.headers.authorization !== `Bearer ${cfg.httpAuthToken}`) {
      res.writeHead(401, { "WWW-Authenticate": "Bearer" }).end("Unauthorized");
      return;
    }
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end("Method not allowed"); return; }
    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      // stateless: one server+transport per request
      const server = createServer(built, VERSION);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e: any) {
      log("request error", e?.message);
      if (!res.headersSent) res.writeHead(500).end("Internal error");
    }
  });
  http.listen(cfg.httpPort, cfg.httpHost, () => log(`HTTP MCP endpoint on http://${cfg.httpHost}:${cfg.httpPort}/mcp`));
  if (!cfg.httpAuthToken) log("WARNING: MCP_AUTH_TOKEN not set — anyone who can reach this port can drive your Docker host");
}
