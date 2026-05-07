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

import {
  validateApiKey,
  maskApiKey,
  login,
  logout,
  hardLogout,
  getAuthStatus,
  getJwt,
} from "../../src/lib/auth.js";
import { resetConfig, setProfileField, getCurrentProfile } from "../../src/lib/config.js";
import { UserError, AuthError } from "../../src/lib/errors.js";
import { authTokenOk } from "../fixtures/responses.js";

beforeEach(() => {
  resetConfig();
  mockRequest.mockReset();
});

describe("validateApiKey", () => {
  it("accepts valid key", () => {
    expect(() => validateApiKey("sk_live_6xargs_" + "a".repeat(24))).not.toThrow();
  });

  it("rejects short key", () => {
    expect(() => validateApiKey("sk_live_6xargs_short")).toThrow(UserError);
  });

  it("rejects wrong prefix", () => {
    expect(() => validateApiKey("sk_test_6xargs_" + "a".repeat(24))).toThrow(UserError);
  });
});

describe("maskApiKey", () => {
  it("shows first 20 chars and last 4", () => {
    const key = "sk_live_6xargs_" + "a".repeat(24);
    const masked = maskApiKey(key);
    expect(masked).toContain("...");
    expect(masked.startsWith("sk_live_6xargs_")).toBe(true);
  });
});

describe("login", () => {
  it("stores credentials on success", async () => {
    mockRequest.mockResolvedValueOnce(authTokenOk);
    const result = await login("sk_live_6xargs_" + "a".repeat(24), "maico");

    expect(result.firm.name).toBe("Delta Protect");
    expect(result.firm.plan).toBe("pro");

    const status = getAuthStatus();
    expect(status.authenticated).toBe(true);
    expect(status.firmName).toBe("Delta Protect");
    expect(status.username).toBe("maico");
  });

  it("throws UserError on invalid api key format", async () => {
    await expect(login("bad-key")).rejects.toThrow(UserError);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("propagates API errors", async () => {
    mockRequest.mockRejectedValueOnce(new Error("network failure"));
    await expect(login("sk_live_6xargs_" + "a".repeat(24))).rejects.toThrow();
  });
});

describe("logout / hardLogout", () => {
  beforeEach(async () => {
    mockRequest.mockResolvedValueOnce(authTokenOk);
    await login("sk_live_6xargs_" + "a".repeat(24), "maico");
  });

  it("logout clears JWT but keeps API key", () => {
    logout();
    const status = getAuthStatus();
    expect(status.authenticated).toBe(false);
    const profile = getCurrentProfile();
    expect(profile.api_key).toBeDefined();
  });

  it("hardLogout clears all credentials", () => {
    hardLogout();
    const status = getAuthStatus();
    expect(status.authenticated).toBe(false);
  });
});

describe("getAuthStatus", () => {
  it("returns not authenticated when no JWT", () => {
    const status = getAuthStatus();
    expect(status.authenticated).toBe(false);
  });

  it("returns expired when jwt_expires_at is in the past", () => {
    setProfileField("jwt", "fake.jwt.token");
    setProfileField("jwt_expires_at", "2020-01-01T00:00:00Z");
    const status = getAuthStatus();
    expect(status.authenticated).toBe(false);
    expect(status.expired).toBe(true);
  });

  it("returns authenticated when JWT is valid and not expired", () => {
    setProfileField("jwt", "fake.jwt.token");
    setProfileField("jwt_expires_at", "2099-01-01T00:00:00Z");
    setProfileField("firm_name", "Delta Protect");
    setProfileField("plan", "pro");
    const status = getAuthStatus();
    expect(status.authenticated).toBe(true);
    expect(status.firmName).toBe("Delta Protect");
  });
});

describe("getJwt", () => {
  it("throws AuthError when not logged in", () => {
    expect(() => getJwt()).toThrow(AuthError);
  });

  it("throws AuthError when token is expired", () => {
    setProfileField("jwt", "fake.jwt.token");
    setProfileField("jwt_expires_at", "2020-01-01T00:00:00Z");
    expect(() => getJwt()).toThrow(AuthError);
  });

  it("returns JWT when valid", () => {
    setProfileField("jwt", "fake.jwt.token");
    setProfileField("jwt_expires_at", "2099-01-01T00:00:00Z");
    expect(getJwt()).toBe("fake.jwt.token");
  });
});
