/**
 * E2E smoke tests — require a real API key.
 * Run via: SIXARGS_TEST_KEY=sk_live_6xargs_... pnpm test:e2e
 * Skipped automatically when SIXARGS_TEST_KEY is not set.
 */
import { describe, it, expect, beforeAll } from "vitest";

const TEST_KEY = process.env["SIXARGS_TEST_KEY"];
const API_BASE = process.env["SIXARGS_API_BASE"] ?? "https://api.6xargs.com";
const E2E = Boolean(TEST_KEY);

let jwt: string | null = null;

describe.skipIf(!E2E)("e2e: health", () => {
  it("GET /health returns status ok", async () => {
    const { fetch } = await import("undici");
    const res = await fetch(`${API_BASE}/health`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe("ok");
  });
});

describe.skipIf(!E2E)("e2e: auth", () => {
  it("POST /api/v1/auth/token returns JWT with firm info", async () => {
    const { fetch } = await import("undici");
    const res = await fetch(`${API_BASE}/api/v1/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: TEST_KEY }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      jwt: string;
      expires_at: string;
      firm: { id: string; name: string; plan: string };
    };
    expect(data.jwt).toBeTruthy();
    expect(data.expires_at).toBeTruthy();
    expect(data.firm.id).toBeTruthy();
    jwt = data.jwt;
  });
});

describe.skipIf(!E2E)("e2e: query (requires indexed data)", () => {
  beforeAll(() => {
    if (!jwt) {
      console.warn("Skipping query e2e — auth step did not produce JWT");
    }
  });

  it("POST /api/v1/query returns a structured result", async () => {
    if (!jwt) return;
    const { fetch } = await import("undici");
    const res = await fetch(`${API_BASE}/api/v1/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query: "security findings", mode: "guide" }),
    });
    expect(res.ok).toBe(true);
    const data = (await res.json()) as {
      id: string;
      answer: string;
      sources: unknown[];
      mode: string;
    };
    expect(data.id).toBeTruthy();
    expect(data.answer).toBeTruthy();
    expect(Array.isArray(data.sources)).toBe(true);
    expect(data.mode).toBe("guide");
  });
});

describe.skipIf(!E2E)("e2e: engagements list", () => {
  it("GET /api/v1/engagements returns array", async () => {
    if (!jwt) return;
    const { fetch } = await import("undici");
    const res = await fetch(`${API_BASE}/api/v1/engagements`, {
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
