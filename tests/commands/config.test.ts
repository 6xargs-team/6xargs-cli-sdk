import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("conf", () => ({
  default: class MockConf {
    private _store: Record<string, unknown> = {};
    get store() { return this._store; }
    set store(v: Record<string, unknown>) { this._store = { ...v }; }
    clear() { this._store = {}; }
  },
}));

import { configGet, configSet, configList, configReset, configSwitchProfile } from "../../src/commands/config.js";
import { UserError } from "../../src/lib/errors.js";

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("configGet", () => {
  it("prints the current api_base value", () => {
    configGet("api_base");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("api.6xargs.com")
    );
  });

  it("prints output_format value", () => {
    configGet("output_format");
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("table"));
  });

  it("throws UserError for unknown key", () => {
    expect(() => configGet("nonexistent_key")).toThrow(UserError);
  });

  it("throws UserError with helpful message listing valid keys", () => {
    expect(() => configGet("bad_key")).toThrow(/Unknown config key/);
  });
});

describe("configSet", () => {
  it("sets output_format to a valid value", () => {
    configSet("output_format", "json");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("output_format = json")
    );
  });

  it("sets output_format back to table", () => {
    configSet("output_format", "table");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("output_format = table")
    );
  });

  it("throws UserError for invalid output_format value", () => {
    expect(() => configSet("output_format", "xml")).toThrow(UserError);
  });

  it("throws UserError for non-settable key", () => {
    expect(() => configSet("jwt", "sometoken")).toThrow(UserError);
  });

  it("throws UserError for plain http api_base", () => {
    expect(() => configSet("api_base", "http://example.com")).toThrow(UserError);
  });

  it("accepts https api_base", () => {
    configSet("api_base", "https://staging.6xargs.com");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("api_base = https://staging.6xargs.com")
    );
  });

  it("accepts http://localhost for dev", () => {
    configSet("api_base", "http://localhost:3000");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("api_base")
    );
  });
});

describe("configList", () => {
  it("outputs the current profile name", () => {
    configList();
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => String(c[0]))
      .join("");
    expect(output).toContain("default");
  });

  it("never exposes the JWT bearer token", () => {
    configList();
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => String(c[0]))
      .join("");
    // JWT tokens start with eyJ (base64 header)
    expect(output).not.toMatch(/eyJ[A-Za-z0-9]/);
  });
});

describe("configReset", () => {
  it("resets config and prints confirmation", () => {
    configReset();
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("reset")
    );
  });
});

describe("configSwitchProfile", () => {
  it("switches to named profile and prints confirmation", () => {
    configSwitchProfile("staging");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("staging")
    );
  });

  it("creates the profile if it does not exist", () => {
    configSwitchProfile("new-profile-xyz");
    configGet("api_base"); // should not throw — new profile has defaults
    expect(process.stdout.write).toHaveBeenCalled();
  });
});
