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

vi.mock("ink", () => ({
  render: vi.fn(() => ({ waitUntilExit: () => Promise.resolve() })),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
  Box: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => {
  mockRequest.mockReset();
});

const mockEngagements = [
  {
    id: "eng_001",
    name: "Fintech App Q1",
    industry: "fintech",
    stack: ["node", "postgres"],
    indexed_at: "2026-04-01T00:00:00Z",
    findings_count: 12,
  },
  {
    id: "eng_002",
    name: "DeFi Protocol Audit",
    industry: "web3",
    stack: ["solidity", "hardhat"],
    indexed_at: "2026-04-15T00:00:00Z",
    findings_count: 7,
  },
];

describe("engagements list — request contract", () => {
  it("fetches from GET /api/v1/engagements and returns array", async () => {
    mockRequest.mockResolvedValueOnce(mockEngagements);
    const result = await mockRequest("GET", "/api/v1/engagements", expect.anything());
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("eng_001");
    expect(result[1].industry).toBe("web3");
  });

  it("returns engagement with all expected fields", async () => {
    mockRequest.mockResolvedValueOnce([mockEngagements[0]]);
    const result = await mockRequest("GET", "/api/v1/engagements", expect.anything());
    expect(result[0].findings_count).toBe(12);
    expect(result[0].stack).toContain("node");
  });
});

describe("engagements show — request contract", () => {
  it("fetches from GET /api/v1/engagements/:id", async () => {
    mockRequest.mockResolvedValueOnce(mockEngagements[0]);
    const result = await mockRequest(
      "GET",
      "/api/v1/engagements/eng_001",
      expect.anything()
    );
    expect(result.name).toBe("Fintech App Q1");
    expect(result.industry).toBe("fintech");
    expect(result.indexed_at).toBe("2026-04-01T00:00:00Z");
  });
});

describe("engagements delete — request contract", () => {
  it("calls DELETE /api/v1/engagements/:id", async () => {
    mockRequest.mockResolvedValueOnce({});
    await mockRequest("DELETE", "/api/v1/engagements/eng_001", expect.anything());
    expect(mockRequest).toHaveBeenCalledWith(
      "DELETE",
      "/api/v1/engagements/eng_001",
      expect.anything()
    );
  });

  it("handles empty body (204) without error", async () => {
    mockRequest.mockResolvedValueOnce({});
    await expect(
      mockRequest("DELETE", "/api/v1/engagements/eng_002", expect.anything())
    ).resolves.toEqual({});
  });
});
