// Local demo server — simulates the 6xargs API for CLI testing without a live backend.
// Run:  node mock-server.js
// Then: node dist/index.mjs --api-base http://localhost:9000 login --api-key sk_live_6xargs_DemoDay2025ShowcaseABC12
import http from "http";

const DEMO_KEY = "sk_live_6xargs_DemoDay2025ShowcaseABC12";
const DEMO_JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmaXJtX2lkIjoiZmlybV9kZW1vMDAxIn0.demo";

// Static route table
const STATIC = {
  "GET /health": () => ({ status: "ok", version: "0.1.0" }),

  "POST /api/v1/auth/token": () => ({
    jwt: DEMO_JWT,
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    firm: { id: "firm_demo001", name: "Demo Security Firm", plan: "pro" },
  }),

  "POST /api/v1/query": (b) => ({
    id: "q_demo001",
    query: b?.query ?? "",
    mode:  b?.mode  ?? "guide",
    answer:
      "[DEMO] SSRF in Node.js typically surfaces in server-side URL fetching without " +
      "validation. Common patterns: axios/node-fetch with user-controlled URLs, blind " +
      "SSRF via webhook callbacks, metadata endpoint abuse (169.254.169.254). " +
      "Recommend: strict allowlist-based URL validation, disable redirects, block " +
      "RFC-1918 ranges at the HTTP client layer.",
    sources: [
      { engagement_id: "eng_demo001", relevance: 0.94, excerpt: "SSRF via unvalidated redirect in /api/fetch" },
      { engagement_id: "eng_demo002", relevance: 0.87, excerpt: "Blind SSRF in webhook URL parameter" },
    ],
    latency_ms: 312,
  }),

  "POST /api/v1/ingestion/upload": () => ({
    id:         `job_${Date.now()}`,
    filename:   "demo-finding.json",
    status:     "pending",
    created_at: new Date().toISOString(),
    tags:       [],
  }),

  "GET /api/v1/engagements": () => [
    { id: "eng_demo001", name: "Acme Corp Web App",  industry: "fintech",    findings_count: 14, indexed_at: new Date().toISOString(), stack: ["Node.js","React"] },
    { id: "eng_demo002", name: "Globex API Gateway", industry: "healthcare", findings_count:  8, indexed_at: new Date().toISOString(), stack: ["Python","FastAPI"] },
  ],

  "GET /api/v1/firms/firm_demo001": () => ({
    id: "firm_demo001", name: "Demo Security Firm", plan: "pro",
    engagements_indexed: 2, queries_this_month: 47,
    created_at: "2024-01-15T00:00:00Z",
  }),

  "GET /api/v1/keys": () => [
    { id: "key_demo001", name: "Demo Key", prefix: "sk_live_6xar",
      created_at: new Date().toISOString(), last_used_at: new Date().toISOString() },
  ],

  "POST /api/v1/keys": (b) => ({
    id: `key_${Date.now()}`, name: b?.name ?? "New Key",
    prefix: "sk_live_6xar",
    key: `sk_live_6xargs_NewKey${Date.now()}Created00`,
    created_at: new Date().toISOString(),
  }),

  "GET /api/v1/query/history": () => ({
    items: [
      { id: "q_demo001", query: "SSRF patterns in Node.js", mode: "guide", useful: true, created_at: new Date().toISOString() },
    ],
  }),
};

function respond(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

http.createServer((req, res) => {
  const { method, url } = req;
  const path = url.split("?")[0];

  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type" });
    res.end();
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch {}

    const key = `${method} ${path}`;
    let handler = STATIC[key];

    // Parametric fallback: /api/v1/ingestion/status/:id  /api/v1/engagements/:id  /api/v1/keys/:id
    if (!handler) {
      if (method === "GET"    && /^\/api\/v1\/ingestion\/status\//.test(path)) {
        const jobId = path.split("/").pop();
        handler = () => ({ id: jobId, filename: "demo-finding.json", status: "completed", created_at: new Date().toISOString(), completed_at: new Date().toISOString(), tags: [] });
      } else if (method === "GET" && /^\/api\/v1\/engagements\//.test(path)) {
        const id = path.split("/").pop();
        handler = () => ({ id, name: "Demo Engagement", industry: "fintech", findings_count: 5, indexed_at: new Date().toISOString(), stack: ["Node.js"] });
      } else if (method === "DELETE") {
        handler = () => ({});
      } else if (method === "POST" && /\/feedback$/.test(path)) {
        handler = () => ({ id: path.split("/")[4], useful: parsed?.useful ?? true });
      }
    }

    if (!handler) {
      respond(res, 404, { error: "Not found", path });
      return;
    }

    const result = handler(parsed, req);
    respond(res, 200, result);
    console.log(`  ${method.padEnd(6)} ${path}`);
  });
}).listen(9000, () => {
  console.log("6xargs mock server  http://localhost:9000");
  console.log("");
  console.log("Demo API key:");
  console.log("  " + DEMO_KEY);
  console.log("");
  console.log("Quick start:");
  console.log("  node dist/index.mjs --api-base http://localhost:9000 login --api-key " + DEMO_KEY);
  console.log("  node dist/index.mjs --api-base http://localhost:9000 health");
  console.log("  node dist/index.mjs --api-base http://localhost:9000 engagements list");
  console.log('  node dist/index.mjs --api-base http://localhost:9000 ask "SSRF patterns in Node.js"');
  console.log("  node dist/index.mjs --api-base http://localhost:9000 ingest upload tests/fixtures/demo-finding.json");
  console.log("");
});
