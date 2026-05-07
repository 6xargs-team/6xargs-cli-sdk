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

const mockFirm = {
  id: "firm_abc123",
  name: "Delta Protect",
  plan: "pro",
  engagements_indexed: 14,
  queries_this_month: 42,
  created_at: "2026-01-01T00:00:00Z",
};

const mockKeys = [
  {
    id: "key_001",
    name: "CI pipeline",
    prefix: "sk_live_6xargs_abc",
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "key_002",
    name: "Local dev",
    prefix: "sk_live_6xargs_def",
    created_at: "2026-04-15T00:00:00Z",
    last_used_at: "2026-05-01T00:00:00Z",
  },
];

const mockNewKey = {
  id: "key_003",
  name: "New key",
  prefix: "sk_live_6xargs_xyz",
  key: "sk_live_6xargs_xyz123456789012345678901234",
  created_at: "2026-05-06T00:00:00Z",
};

describe("firm info — request contract", () => {
  it("fetches from GET /api/v1/firms/:id", async () => {
    mockRequest.mockResolvedValueOnce(mockFirm);
    const result = await mockRequest("GET", "/api/v1/firms/firm_abc123", expect.anything());
    expect(result.name).toBe("Delta Protect");
    expect(result.plan).toBe("pro");
    expect(result.engagements_indexed).toBe(14);
  });

  it("includes usage statistics", async () => {
    mockRequest.mockResolvedValueOnce(mockFirm);
    const result = await mockRequest("GET", "/api/v1/firms/firm_abc123", expect.anything());
    expect(result.queries_this_month).toBe(42);
    expect(result.created_at).toBeDefined();
  });
});

describe("firm keys list — request contract", () => {
  it("fetches from GET /api/v1/keys", async () => {
    mockRequest.mockResolvedValueOnce(mockKeys);
    const result = await mockRequest("GET", "/api/v1/keys", expect.anything());
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("CI pipeline");
  });

  it("returns keys with prefix (not full key)", async () => {
    mockRequest.mockResolvedValueOnce(mockKeys);
    const result = await mockRequest("GET", "/api/v1/keys", expect.anything());
    expect(result[0].prefix).toContain("sk_live_6xargs_");
    expect(result[0]).not.toHaveProperty("key"); // full key not returned by list
  });
});

describe("firm keys create — request contract", () => {
  it("calls POST /api/v1/keys with name body", async () => {
    mockRequest.mockResolvedValueOnce(mockNewKey);
    const result = await mockRequest("POST", "/api/v1/keys", expect.anything(), {
      body: { name: "New key" },
    });
    expect(mockRequest).toHaveBeenCalledWith(
      "POST",
      "/api/v1/keys",
      expect.anything(),
      expect.objectContaining({ body: { name: "New key" } })
    );
    expect(result.key).toContain("sk_live_6xargs_");
  });

  it("returns full key in create response (shown once)", async () => {
    mockRequest.mockResolvedValueOnce(mockNewKey);
    const result = await mockRequest("POST", "/api/v1/keys", expect.anything(), {
      body: { name: "test" },
    });
    expect(result.key.length).toBeGreaterThan(30);
    expect(result.id).toBe("key_003");
  });
});

describe("firm keys revoke — request contract", () => {
  it("calls DELETE /api/v1/keys/:id", async () => {
    mockRequest.mockResolvedValueOnce({});
    await mockRequest("DELETE", "/api/v1/keys/key_001", expect.anything());
    expect(mockRequest).toHaveBeenCalledWith(
      "DELETE",
      "/api/v1/keys/key_001",
      expect.anything()
    );
  });

  it("resolves on success (204-style empty response)", async () => {
    mockRequest.mockResolvedValueOnce({});
    await expect(
      mockRequest("DELETE", "/api/v1/keys/key_002", expect.anything())
    ).resolves.toEqual({});
  });
});
