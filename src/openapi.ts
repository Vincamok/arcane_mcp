export interface Operation {
  id: string;
  method: string;
  path: string;
  tag: string;
  summary: string;
  description: string;
  params: { name: string; in: "path" | "query" | "header"; required: boolean; schema: any; description?: string }[];
  body?: { required: boolean; schema: any };
  destructive: boolean;
  readOnly: boolean;
  supported: boolean; // false for streams / multipart / binary
}

const METHODS = ["get", "post", "put", "patch", "delete"];

export function resolveRef(spec: any, node: any, depth = 0, seen: string[] = []): any {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => resolveRef(spec, n, depth, seen));
  if (node.$ref) {
    const ref: string = node.$ref;
    if (seen.includes(ref) || depth > 4) return { type: "object", description: `(see ${ref.split("/").pop()})` };
    const target = ref.replace(/^#\//, "").split("/").reduce((o: any, k) => o?.[k], spec);
    return resolveRef(spec, target, depth + 1, [...seen, ref]);
  }
  const out: any = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "examples" || k === "example" || k === "$schema" || k === "x-speakeasy") continue;
    out[k] = resolveRef(spec, v, depth, seen);
  }
  return out;
}

export function parseOperations(spec: any): Operation[] {
  const ops: Operation[] = [];
  for (const [path, item] of Object.entries<any>(spec.paths ?? {})) {
    for (const method of METHODS) {
      const o = item[method];
      if (!o) continue;
      const id: string = o.operationId ?? `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      const params = [...(item.parameters ?? []), ...(o.parameters ?? [])]
        .map((p: any) => resolveRef(spec, p))
        .filter((p: any) => ["path", "query"].includes(p.in))
        .map((p: any) => ({ name: p.name, in: p.in, required: !!p.required || p.in === "path", schema: p.schema ?? {}, description: p.description }));
      let body: Operation["body"];
      let supported = true;
      const rb = o.requestBody ? resolveRef(spec, o.requestBody) : undefined;
      if (rb) {
        const json = rb.content?.["application/json"] ?? rb.content?.["application/merge-patch+json"];
        if (json) body = { required: !!rb.required, schema: json.schema ?? {} };
        else if (rb.content) supported = false; // multipart, octet-stream...
      }
      const okResp = Object.entries<any>(o.responses ?? {}).find(([c]) => c.startsWith("2"))?.[1];
      const respTypes = Object.keys(resolveRef(spec, okResp)?.content ?? {});
      if (respTypes.some((t) => t.includes("event-stream") || t.includes("octet-stream") || t.includes("tar") || t.includes("zip"))) supported = false;
      ops.push({
        id,
        method: method.toUpperCase(),
        path,
        tag: (o.tags?.[0] as string) ?? "Other",
        summary: o.summary ?? id,
        description: o.description ?? "",
        params,
        body,
        readOnly: method === "get",
        destructive: method === "delete" || /\b(delete|remove|prune|destroy|kill|stop)\b/i.test(`${id} ${o.summary ?? ""}`),
        supported,
      });
    }
  }
  return ops;
}

/** Build a JSON Schema for the tool input of an operation. */
export function buildInputSchema(spec: any, op: Operation, hasDefaultEnv: boolean): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const p of op.params) {
    const key = properties[p.name] ? `${p.in}_${p.name}` : p.name;
    const s = resolveRef(spec, p.schema);
    properties[key] = { ...s, description: [p.description, p.in === "path" ? "(path)" : ""].filter(Boolean).join(" ") || undefined };
    const isEnv = p.in === "path" && p.name === "id" && /\/environments\/\{id\}/.test(op.path);
    if (p.required && !(isEnv && hasDefaultEnv)) required.push(key);
    if (isEnv && hasDefaultEnv) properties[key].description += " Defaults to the configured environment.";
  }
  if (op.body) {
    properties.body = { ...resolveRef(spec, op.body.schema), description: "JSON request body" };
    if (op.body.required) required.push("body");
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

export function toolName(op: Operation): string {
  return ("arcane_" + op.id.replace(/[^a-zA-Z0-9_-]+/g, "_")).slice(0, 64);
}
