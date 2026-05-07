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

import { resolveFiles } from "../../src/commands/ingest.js";
import { ingestJobCompleted, ingestJobPending } from "../fixtures/responses.js";

beforeEach(() => {
  mockRequest.mockReset();
});

describe("resolveFiles", () => {
  it("returns the path as-is for non-glob patterns", () => {
    const files = resolveFiles("report.pdf");
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("report.pdf");
  });
});

describe("ingest upload — request contract", () => {
  it("calls the upload endpoint and returns a job", async () => {
    mockRequest.mockResolvedValueOnce(ingestJobPending);
    const result = await mockRequest("POST", "/api/v1/ingestion/upload", expect.anything(), {
      formData: expect.any(Object),
      timeout: 120_000,
    });
    expect(result.id).toBe("job_abc123");
    expect(result.status).toBe("pending");
  });
});

describe("ingest status — request contract", () => {
  it("returns job when complete", async () => {
    mockRequest.mockResolvedValueOnce(ingestJobCompleted);
    const result = await mockRequest(
      "GET",
      "/api/v1/ingestion/status/job_abc123",
      expect.anything()
    );
    expect(result.status).toBe("completed");
    expect(result.completed_at).toBeDefined();
  });
});

describe("ingest list — request contract", () => {
  it("accepts status filter query param", async () => {
    mockRequest.mockResolvedValueOnce([ingestJobCompleted]);
    await mockRequest("GET", "/api/v1/ingestion/jobs", expect.anything(), {
      query: { status: "completed" },
    });
    expect(mockRequest).toHaveBeenCalledWith(
      "GET",
      "/api/v1/ingestion/jobs",
      expect.anything(),
      expect.objectContaining({ query: { status: "completed" } })
    );
  });
});
