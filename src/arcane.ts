import { Agent, fetch as undiciFetch } from "undici";
import type { Config } from "./config.js";
import type { Operation } from "./openapi.js";

export class ArcaneClient {
  private dispatcher;
  constructor(private cfg: Config) {
    this.dispatcher = cfg.insecureTls ? new Agent({ connect: { rejectUnauthorized: false } }) : undefined;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.cfg.apiKey) h["X-API-Key"] = this.cfg.apiKey;
    else if (this.cfg.token) h["Authorization"] = `Bearer ${this.cfg.token}`;
    return h;
  }

  async raw(method: string, path: string, query?: URLSearchParams, body?: unknown): Promise<{ status: number; text: string; json?: unknown }> {
    const url = `${this.cfg.baseUrl}/api${path}${query && [...query].length ? "?" + query : ""}`;
    const headers = this.headers();
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await undiciFetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
      dispatcher: this.dispatcher,
    });
    const text = await res.text();
    let json: unknown;
    try { json = text ? JSON.parse(text) : undefined; } catch { /* not json */ }
    return { status: res.status, text, json };
  }

  async getSpec(): Promise<any> {
    const r = await this.raw("GET", "/openapi.json");
    if (r.status !== 200 || !r.json) throw new Error(`Cannot load OpenAPI spec from ${this.cfg.baseUrl}/api/openapi.json (HTTP ${r.status})`);
    return r.json;
  }

  /** Execute an operation with flat arguments (path/query params + body). */
  async call(op: Operation, args: Record<string, any>) {
    let path = op.path;
    const query = new URLSearchParams();
    const used = new Set<string>();
    for (const p of op.params) {
      const key = args[p.name] === undefined && args[`${p.in}_${p.name}`] !== undefined ? `${p.in}_${p.name}` : p.name;
      let v = args[key];
      if (v === undefined && p.in === "path" && p.name === "id" && this.cfg.defaultEnvironmentId && /\/environments\/\{id\}/.test(op.path)) v = this.cfg.defaultEnvironmentId;
      used.add(key);
      if (v === undefined || v === null) {
        if (p.required) throw new Error(`Missing required parameter '${p.name}'`);
        continue;
      }
      if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(String(v)));
      else if (Array.isArray(v)) v.forEach((x) => query.append(p.name, String(x)));
      else query.set(p.name, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    return this.raw(op.method, path, query, args.body);
  }
}
