export const healthOk = { status: "ok", version: "0.1.0", timestamp: "2026-05-06T12:00:00Z" };
export const healthDown = { status: "down" };

export const authTokenOk = {
  jwt: "eyJhbGciOiJIUzI1NiJ9.test.sig",
  expires_at: "2026-06-06T12:00:00Z",
  firm: { id: "firm_abc123", name: "Delta Protect", plan: "pro" },
};

export const engagementsList = {
  data: [
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
  ],
};

export const ingestJobPending = {
  id: "job_abc123",
  status: "pending",
  filename: "report.pdf",
  created_at: "2026-05-06T12:00:00Z",
  tags: ["fintech", "ssrf"],
};

export const ingestJobCompleted = {
  ...ingestJobPending,
  status: "completed",
  completed_at: "2026-05-06T12:01:00Z",
};
