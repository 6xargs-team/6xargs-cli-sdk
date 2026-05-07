import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock conf before importing config module
vi.mock("conf", () => {
  return {
    default: class MockConf {
      private _store: Record<string, unknown> = {};
      get store() {
        return this._store;
      }
      set store(val: Record<string, unknown>) {
        this._store = { ...val };
      }
      clear() {
        this._store = {};
      }
    },
  };
});

// Reset module registry between tests so the store resets
import { getConfig, getCurrentProfile, setProfileField, switchProfile, resetConfig, getApiBase } from "../../src/lib/config.js";

beforeEach(() => {
  resetConfig();
});

describe("getConfig", () => {
  it("returns defaults when config is empty", () => {
    const config = getConfig();
    expect(config.current_profile).toBe("default");
    expect(config.profiles).toHaveProperty("default");
  });
});

describe("getCurrentProfile", () => {
  it("returns the default profile", () => {
    const profile = getCurrentProfile();
    expect(profile.api_base).toBe("https://api.6xargs.com");
    expect(profile.output_format).toBe("table");
  });
});

describe("setProfileField", () => {
  it("sets a field on the current profile", () => {
    setProfileField("api_base", "https://staging.6xargs.com");
    const profile = getCurrentProfile();
    expect(profile.api_base).toBe("https://staging.6xargs.com");
  });

  it("does not overwrite other fields", () => {
    setProfileField("firm_name", "Test Firm");
    setProfileField("api_base", "https://staging.6xargs.com");
    const profile = getCurrentProfile();
    expect(profile.firm_name).toBe("Test Firm");
    expect(profile.api_base).toBe("https://staging.6xargs.com");
  });
});

describe("switchProfile", () => {
  it("creates and switches to a new profile", () => {
    switchProfile("staging");
    const config = getConfig();
    expect(config.current_profile).toBe("staging");
    expect(config.profiles).toHaveProperty("staging");
  });

  it("preserves existing profiles when switching", () => {
    setProfileField("firm_name", "Prod Firm");
    switchProfile("staging");
    switchProfile("default");
    const profile = getCurrentProfile();
    expect(profile.firm_name).toBe("Prod Firm");
  });
});

describe("getApiBase", () => {
  it("returns override when provided", () => {
    expect(getApiBase("https://custom.example.com")).toBe("https://custom.example.com");
  });

  it("returns profile api_base by default", () => {
    expect(getApiBase()).toBe("https://api.6xargs.com");
  });

  it("prefers env var over profile", () => {
    vi.stubEnv("SIXARGS_API_BASE", "https://env.example.com");
    expect(getApiBase()).toBe("https://env.example.com");
    vi.unstubAllEnvs();
  });
});
