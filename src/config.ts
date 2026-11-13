export interface Config {
  baseUrl: string; // e.g. https://dock.vincz.fr  (without /api)
  apiKey?: string;
  token?: string;
  readOnly: boolean;
  toolsets: "all" | "none" | Set<string>; // tags (lowercased) exposed as individual tools
  defaultEnvironmentId?: string;
  maxResponseChars: number;
  timeoutMs: number;
  insecureTls: boolean;
  transport: "stdio" | "http";
  httpHost: string;
  httpPort: number;
  httpAuthToken?: string;
}

const bool = (v: string | undefined, d: boolean) =>
  v === undefined || v === "" ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase());

export function loadConfig(env = process.env, argv = process.argv.slice(2)): Config {
  const arg = (name: string) => {
    const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i < 0) return undefined;
    const a = argv[i];
    return a.includes("=") ? a.split("=").slice(1).join("=") : argv[i + 1] ?? "true";
  };
  const get = (flag: string, envName: string) => arg(flag) ?? env[envName];

  let url = get("url", "ARCANE_URL");
  if (!url) throw new Error("ARCANE_URL (or --url) is required, e.g. https://dock.vincz.fr");
  url = url.replace(/\/+$/, "").replace(/\/api$/, "");

  const apiKey = get("api-key", "ARCANE_API_KEY");
  const token = get("token", "ARCANE_TOKEN");
  if (!apiKey && !token) throw new Error("ARCANE_API_KEY (X-API-Key) or ARCANE_TOKEN (Bearer JWT) is required");

  const ts = (get("toolsets", "ARCANE_TOOLSETS") ?? "default").trim().toLowerCase();
  const DEFAULT = ["containers", "images", "projects", "networks", "volumes", "environments", "system", "dashboard", "image updates", "events"];
  const toolsets: Config["toolsets"] =
    ts === "all" ? "all" : ts === "none" ? "none" : new Set(ts === "default" ? DEFAULT : ts.split(",").map((s) => s.trim()).filter(Boolean));

  const transport = (get("transport", "MCP_TRANSPORT") ?? "stdio").toLowerCase();
  if (transport !== "stdio" && transport !== "http") throw new Error("MCP_TRANSPORT must be 'stdio' or 'http'");

  return {
    baseUrl: url,
    apiKey,
    token,
    readOnly: bool(get("read-only", "ARCANE_READ_ONLY"), false),
    toolsets,
    defaultEnvironmentId: get("environment", "ARCANE_ENVIRONMENT_ID"),
    maxResponseChars: Number(get("max-response-chars", "ARCANE_MAX_RESPONSE_CHARS") ?? 40000),
    timeoutMs: Number(get("timeout", "ARCANE_TIMEOUT_MS") ?? 30000),
    insecureTls: bool(get("insecure-tls", "ARCANE_INSECURE_TLS"), false),
    transport,
    httpHost: get("host", "MCP_HOST") ?? "0.0.0.0",
    httpPort: Number(get("port", "MCP_PORT") ?? 3000),
    httpAuthToken: get("http-token", "MCP_AUTH_TOKEN"),
  };
}
