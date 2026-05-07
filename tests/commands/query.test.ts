import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("conf", () => ({
  default: class MockConf {
    private _store: Record<string, unknown> = {};
    get store() { return this._store; }
    set store(v: Record<string, unknown>) { this._store = { ...v }; }
    clear() { this._store = {}; }
  },
}));

const mockRequest = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/client.js", () => ({ request: mockRequest }));

const mockStreamQuery = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/stream.js", () => ({ streamQuery: mockStreamQuery }));

vi.mock("ink", () => ({
  render: vi.fn(() => ({ waitUntilExit: () => Promise.resolve() })),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
  Box: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => {
  mockRequest.mockReset();
  mockStreamQuery.mockReset();
});

const mockQueryResult = {
  id: "qry_001",
  answer: "SSRF is commonly found in...",
  sources: [
    { engagement_id: "eng_001", relevance: 0.94 },
    { engagement_id: "eng_002", relevance: 0.87 },
  ],
  mode: "guide",
  latency_ms: 350,
};

const mockHistory = {
  items: [
    { id: "qry_001", query: "SSRF patterns", mode: "guide", created_at: "2026-05-06T00:00:00Z" },
    { id: "qry_002", query: "SQLi in Node", mode: "report", created_at: "2026-05-05T00:00:00Z", useful: true },
  ],
  total: 2,
};

describe("ask — non-streaming request contract", () => {
  it("calls POST /api/v1/query with query and mode", async () => {
    mockRequest.mockResolvedValueOnce(mockQueryResult);
    const result = await mockRequest("POST", "/api/v1/query", expect.anything(), {
      body: { query: "SSRF patterns", mode: "guide" },
    });
    expect(result.answer).toContain("SSRF");
    expect(result.sources).toHaveLength(2);
  });

  it("returns sources with relevance scores", async () => {
    mockRequest.mockResolvedValueOnce(mockQueryResult);
    const result = await mockRequest("POST", "/api/v1/query", expect.anything(), {
      body: { query: "test", mode: "guide" },
    });
    expect(result.sources[0].relevance).toBeGreaterThan(0.9);
  });
});

describe("ask — streaming contract", () => {
  it("streams SSE events and accumulates tokens", async () => {
    async function* fakeStream() {
      yield { type: "step", content: "Searching knowledge base..." };
      yield { type: "token", content: "SSRF " };
      yield { type: "token", content: "patterns..." };
      yield { type: "done", content: "" };
    }
    mockStreamQuery.mockReturnValueOnce(fakeStream());

    let accumulated = "";
    for await (const evt of mockStreamQuery("SSRF", "guide", {})) {
      if (evt.type === "token") accumulated += evt.content;
      if (evt.type === "done") break;
    }

    expect(accumulated).toBe("SSRF patterns...");
  });
});

describe("query history — request contract", () => {
  it("fetches history from GET /api/v1/query/history", async () => {
    mockRequest.mockResolvedValueOnce(mockHistory);
    const result = await mockRequest("GET", "/api/v1/query/history", expect.anything());
    expect(result.items).toHaveLength(2);
    expect(result.items[0].query).toBe("SSRF patterns");
  });
});

describe("query feedback — request contract", () => {
  it("POSTs to /api/v1/query/:id/feedback with useful flag", async () => {
    mockRequest.mockResolvedValueOnce({ success: true });
    await mockRequest("POST", "/api/v1/query/qry_001/feedback", expect.anything(), {
      body: { useful: true },
    });
    expect(mockRequest).toHaveBeenCalledWith(
      "POST",
      "/api/v1/query/qry_001/feedback",
      expect.anything(),
      expect.objectContaining({ body: { useful: true } })
    );
  });

  it("includes reason when not useful", async () => {
    mockRequest.mockResolvedValueOnce({ success: true });
    await mockRequest("POST", "/api/v1/query/qry_001/feedback", expect.anything(), {
      body: { useful: false, reason: "stale" },
    });
    expect(mockRequest).toHaveBeenCalledWith(
      "POST",
      "/api/v1/query/qry_001/feedback",
      expect.anything(),
      expect.objectContaining({ body: { useful: false, reason: "stale" } })
    );
  });
});
