import { describe, it, expect } from "vitest";
import {
  EXIT,
  CliError,
  UserError,
  ApiError,
  AuthError,
  formatError,
} from "../../src/lib/errors.js";

describe("EXIT codes", () => {
  it("has correct values", () => {
    expect(EXIT.SUCCESS).toBe(0);
    expect(EXIT.USER_ERROR).toBe(1);
    expect(EXIT.API_ERROR).toBe(2);
    expect(EXIT.AUTH_ERROR).toBe(3);
    expect(EXIT.SIGINT).toBe(130);
  });
});

describe("CliError", () => {
  it("stores message, exitCode, and hint", () => {
    const err = new CliError("something failed", EXIT.API_ERROR, "try again");
    expect(err.message).toBe("something failed");
    expect(err.exitCode).toBe(2);
    expect(err.hint).toBe("try again");
    expect(err.name).toBe("CliError");
  });

  it("is an instance of Error", () => {
    expect(new CliError("x", EXIT.SUCCESS)).toBeInstanceOf(Error);
  });
});

describe("UserError", () => {
  it("uses exit code 1", () => {
    const err = new UserError("bad input", "fix it");
    expect(err.exitCode).toBe(EXIT.USER_ERROR);
    expect(err.hint).toBe("fix it");
    expect(err.name).toBe("UserError");
  });
});

describe("ApiError", () => {
  it("uses exit code 2", () => {
    expect(new ApiError("timeout").exitCode).toBe(EXIT.API_ERROR);
  });
});

describe("AuthError", () => {
  it("uses exit code 3", () => {
    expect(new AuthError("invalid key").exitCode).toBe(EXIT.AUTH_ERROR);
  });
});

describe("formatError", () => {
  it("formats CliError", () => {
    const result = formatError(new UserError("bad flag", "remove it"));
    expect(result.message).toBe("bad flag");
    expect(result.hint).toBe("remove it");
    expect(result.exitCode).toBe(1);
  });

  it("formats plain Error", () => {
    const result = formatError(new Error("network failed"));
    expect(result.message).toBe("network failed");
    expect(result.exitCode).toBe(EXIT.API_ERROR);
  });

  it("formats unknown value", () => {
    const result = formatError("something went wrong");
    expect(result.message).toBe("something went wrong");
    expect(result.exitCode).toBe(EXIT.API_ERROR);
  });
});
