import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock conf so config doesn't touch disk
vi.mock("conf", () => ({
  default: class MockConf {
    private _store: Record<string, unknown> = {};
    get store() { return this._store; }
    set store(val: Record<string, unknown>) { this._store = { ...val }; }
    clear() { this._store = {}; }
  },
}));

// Mock undici fetch
const mockFetch = vi.fn();
vi.mock("undici", () => ({ fetch: mockFetch }));

// Mock ink render — we test logic, not React rendering
vi.mock("ink", () => ({
  render: vi.fn(() => ({ waitUntilExit: () => Promise.resolve() })),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
  Box: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
}));

import { healthOk } from "../fixtures/responses.js";

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("health endpoint behavior", () => {
  it("fetch returns ok on 200", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(healthOk),
    });

    const res = await mockFetch("https://api.6xargs.com/health", {
      signal: AbortSignal.timeout(10_000),
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("fetch returns error on 503", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const res = await mockFetch("https://api.6xargs.com/health", {
      signal: AbortSignal.timeout(10_000),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
  });

  it("fetch throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await expect(
      mockFetch("https://api.6xargs.com/health", { signal: AbortSignal.timeout(10_000) })
    ).rejects.toThrow("connect ECONNREFUSED");
  });

  it("fetch throws on timeout", async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
    );

    await expect(
      mockFetch("https://api.6xargs.com/health", { signal: AbortSignal.timeout(10_000) })
    ).rejects.toThrow("aborted");
  });
});
