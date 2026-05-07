import { describe, it, expect } from "vitest";
import { table, json, yaml, raw, format } from "../../src/lib/output.js";

describe("json", () => {
  it("pretty-prints objects", () => {
    const out = json({ a: 1, b: "x" });
    expect(out).toContain('"a": 1');
    expect(out).toContain('"b": "x"');
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("raw", () => {
  it("returns string as-is with newline", () => {
    expect(raw("hello")).toBe("hello\n");
  });

  it("serializes objects without indent", () => {
    expect(raw({ x: 1 })).toBe('{"x":1}\n');
  });
});

describe("table", () => {
  it("returns no-results for empty array", () => {
    expect(table([])).toBe("(no results)\n");
  });

  it("renders header and rows", () => {
    const out = table([{ id: "abc", name: "test", status: "ok" }]);
    expect(out).toContain("ID");
    expect(out).toContain("NAME");
    expect(out).toContain("abc");
    expect(out).toContain("test");
  });

  it("truncates long values", () => {
    const long = "x".repeat(60);
    const out = table([{ val: long }]);
    expect(out).toContain("...");
    expect(out).not.toContain(long);
  });

  it("replaces null/undefined with dash", () => {
    const out = table([{ a: null, b: undefined }]);
    expect(out.match(/-/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("joins array values with comma", () => {
    const out = table([{ tags: ["fintech", "ssrf"] }]);
    expect(out).toContain("fintech, ssrf");
  });

  it("respects column order from opts.columns", () => {
    const out = table([{ id: "1", name: "n", status: "ok" }], {
      columns: ["status", "id"],
    });
    const statusIdx = out.indexOf("STATUS");
    const idIdx = out.indexOf("ID");
    expect(statusIdx).toBeLessThan(idIdx);
  });
});

describe("yaml", () => {
  it("serializes primitives", () => {
    expect(yaml(42)).toBe("42");
    expect(yaml(true)).toBe("true");
    expect(yaml(null)).toBe("null");
  });

  it("serializes flat objects", () => {
    const out = yaml({ name: "test", count: 3 });
    expect(out).toContain("name: test");
    expect(out).toContain("count: 3");
  });

  it("serializes arrays", () => {
    const out = yaml(["a", "b", "c"]);
    expect(out).toContain("- a");
    expect(out).toContain("- b");
  });

  it("quotes strings with special chars", () => {
    const out = yaml({ key: "val: with colon" });
    expect(out).toContain('"val: with colon"');
  });
});

describe("format", () => {
  it("delegates to json for json fmt", () => {
    const out = format({ x: 1 }, "json");
    expect(out).toContain('"x": 1');
  });

  it("delegates to yaml for yaml fmt", () => {
    const out = format({ x: 1 }, "yaml");
    expect(out).toContain("x: 1");
  });

  it("wraps single object in array for table", () => {
    const out = format({ id: "abc", name: "test" }, "table");
    expect(out).toContain("abc");
  });
});
