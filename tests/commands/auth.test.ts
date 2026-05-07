import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("conf", () => ({
  default: class MockConf {
    private _store: Record<string, unknown> = {};
    get store() { return this._store; }
    set store(val: Record<string, unknown>) { this._store = { ...val }; }
    clear() { this._store = {}; }
  },
}));

const mockRequest = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/client.js", () => ({ request: mockRequest }));

vi.mock("ink", () => ({
  render: vi.fn(() => ({ waitUntilExit: () => Promise.resolve() })),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
  Box: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
}));

// Skip interactive prompts in tests
vi.mock("../../src/lib/prompt.js", () => ({
  prompt: vi.fn(async () => "test-user"),
  promptSecret: vi.fn(async () => "test-password"),
}));

import { loginAction } from "../../src/commands/auth.js";
import { resetConfig, setProfileField } from "../../src/lib/config.js";
import { authTokenOk } from "../fixtures/responses.js";

beforeEach(() => {
  resetConfig();
  mockRequest.mockReset();
});

describe("loginAction", () => {
  it("returns result on successful API call", async () => {
    mockRequest.mockResolvedValueOnce(authTokenOk);
    const noop = () => {};

    const { result, error } = await loginAction({
      apiKey: "sk_live_6xargs_" + "a".repeat(24),
      username: "maico",
      json: false,
      onExit: noop,
    });

    expect(error).toBeNull();
    expect(result?.firm.name).toBe("Delta Protect");
  });

  it("returns error on invalid api key", async () => {
    let exitCode = 0;
    const { result, error } = await loginAction({
      apiKey: "bad-key",
      username: "maico",
      json: false,
      onExit: (code) => { exitCode = code; },
    });

    expect(result).toBeNull();
    expect(error?.message).toContain("Invalid API key");
    expect(exitCode).toBe(0); // non-json mode — Ink handles exit code
  });

  it("returns error when API call fails", async () => {
    mockRequest.mockRejectedValueOnce(new Error("network error"));

    const { result, error } = await loginAction({
      apiKey: "sk_live_6xargs_" + "a".repeat(24),
      username: "maico",
      json: false,
      onExit: () => {},
    });

    expect(result).toBeNull();
    expect(error?.message).toBe("network error");
  });

  it("uses prompts when apiKey is not provided", async () => {
    const { prompt } = await import("../../src/lib/prompt.js");
    mockRequest.mockResolvedValueOnce(authTokenOk);

    await loginAction({ json: false, onExit: () => {} });

    expect(prompt).toHaveBeenCalled();
  });
});
