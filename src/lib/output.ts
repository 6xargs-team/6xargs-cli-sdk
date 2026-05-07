// Output formatters: table (zero-dep string padding), json, yaml (minimal inline serializer), raw.
// table() caps columns at MAX_COL_WIDTH to prevent long values from breaking terminal layout.
const MAX_COL_WIDTH = 45;

function cellValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "boolean") return val ? "yes" : "no";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 3) + "...";
}

export function table(
  rows: Record<string, unknown>[],
  opts: { columns?: string[] } = {}
): string {
  if (rows.length === 0) return "(no results)\n";

  const cols = opts.columns ?? Object.keys(rows[0] ?? {});
  const widths = cols.map((col) =>
    Math.max(col.length, ...rows.map((r) => truncate(cellValue(r[col]), MAX_COL_WIDTH).length))
  );

  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ");

  const sep = widths.map((w) => "─".repeat(w)).join("  ");
  const header = line(cols.map((c) => c.toUpperCase()));

  const body = rows.map((r) =>
    line(cols.map((c) => truncate(cellValue(r[c]), MAX_COL_WIDTH)))
  );

  return [header, sep, ...body].join("\n") + "\n";
}

export function json(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n";
}

export function raw(data: unknown): string {
  if (typeof data === "string") return data + "\n";
  return JSON.stringify(data) + "\n";
}

export function yaml(data: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (data === null || data === undefined) return "null";
  if (typeof data === "boolean" || typeof data === "number") return String(data);

  if (typeof data === "string") {
    if (data.includes("\n")) {
      return "|\n" + data.split("\n").map((l) => `${pad}  ${l}`).join("\n");
    }
    return /[:#\[\]{}&*?|<>=!%@`]/.test(data) ? `"${data.replace(/"/g, '\\"')}"` : data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    return data
      .map((v) => {
        const rendered = yaml(v, indent + 1);
        return typeof v === "object" && v !== null
          ? `${pad}-\n${pad}  ${rendered.replace(/\n/g, `\n${pad}  `)}`
          : `${pad}- ${rendered}`;
      })
      .join("\n");
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return keys
      .map((k) => {
        const v = obj[k];
        const isNested =
          (typeof v === "object" && v !== null) ||
          (Array.isArray(v) && (v as unknown[]).length > 0);
        if (isNested) {
          return `${pad}${k}:\n${yaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${yaml(v, indent)}`;
      })
      .join("\n");
  }

  return String(data);
}

export function format(
  data: unknown,
  fmt: string,
  opts: { columns?: string[] } = {}
): string {
  switch (fmt) {
    case "json":
      return json(data);
    case "yaml":
      return yaml(data) + "\n";
    case "raw":
      return raw(data);
    default: // table
      if (Array.isArray(data)) return table(data as Record<string, unknown>[], opts);
      if (typeof data === "object" && data !== null) {
        return table([data as Record<string, unknown>], opts);
      }
      return raw(data);
  }
}
