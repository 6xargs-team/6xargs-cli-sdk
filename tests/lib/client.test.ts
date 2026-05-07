import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

vi.mock("conf", () => ({
  default: class MockConf {
    private _store: Record<string, unknown> = {};
    get store() { return this._store; }
    set store(val: Record<string, unknown>) { this._store = { ...val }; }
    clear() { this._store = {}; }
  },
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock("undici", () => ({ fetch: mockFetch }));

import { request } from "../../src/lib/client.js";
import { ApiError, AuthError } from "../../src/lib/errors.js";

const TestSchema = z.object({ status: z.string() });

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Map<string, string>(),
    json: () => Promise.resolve(body),
  };
}

function errResponse(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    statusText: "Error",
    headers: new Map<string, string>(),
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubEnv("SIXARGS_DEBUG", "false");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("request — success", () => {
  it("parses and returns validated response", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ status: "ok" }));
    const result = await request("GET", "/health", TestSchema);
    expect(result).toEqual({ status: "ok" });
  });
});

describe("request — 4xx", () => {
  it("throws ApiError on 400 with error field", async () => {
    mockFetch.mockResolvedValueOnce(errResponse(400, { error: "bad request" }));
    await expect(request("GET", "/health", TestSchema)).rejects.toThrow(ApiError);
  });

  it("throws AuthError on 401", async () => {
    mockFetch.mockResolvedValueOnce(errResponse(401));
    await expect(request("GET", "/health", TestSchema)).rejects.toThrow(AuthError);
  });
});

describe("request — 5xx with retry", () => {
  it("retries on 503 and eventually throws", async () => {
    mockFetch.mockResolvedValue(errResponse(503));

    const promise = request("GET", "/health", TestSchema);
    // Pre-attach rejection handler BEFORE advancing timers to prevent unhandled rejection warnings
    const assertion = expect(promise).rejects.toThrow(ApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("succeeds on retry after initial 503", async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse({ status: "ok" }));

    const promise = request("GET", "/health", TestSchema);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("request — network error with retry", () => {
  it("retries on network failure and throws after exhaustion", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const promise = request("GET", "/health", TestSchema);
    const assertion = expect(promise).rejects.toThrow(ApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe("request — schema mismatch", () => {
  it("throws ApiError when response does not match schema", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ unexpected: "field" }));
    await expect(request("GET", "/health", TestSchema)).rejects.toThrow(ApiError);
  });
});
