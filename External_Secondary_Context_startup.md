## 6xargs — Core Product
Operational memory platform for offensive security firms.Pentesting firms, Web3 audit firms, and MSSPs accumulate knowledge across hundreds of engagements — findings, attack patterns, methodologies, resolutions. That knowledge lives in PDFs and in the heads of senior consultants. When a senior leaves, it leaves with them. Every new engagement restarts from zero.
6xargs ingests historical engagements, indexes them semantically, and makes them queryable in real time during active engagements. A junior consultant with 6xargs operates with the accumulated knowledge of 200 past engagements instantly.
---
## Problem
- Cybersecurity turnover: ~20% annually — knowledge lost on every exit.
- 40% of billable time re-derives context that already existed internally.
- Reports get archived. Same vulnerability recurs 6 months later.
- No specialized tool exists for operational memory in offensive security. Notion, Confluence: generic — not built for security reasoning.
---
## Solution
1. Firm ingests historical engagements (PDFs, reports, findings, methodologies).
2. PGVector semantic engine indexes by industry, stack, vuln type, resolution.
3. During active engagement, consultant queries in natural language.
4. System returns structured context from past engagements instantly.
---
## Target Clients
- Pentesting firms (5–200 consultants)
- Web3 / smart contract audit firms
- MSSPs (Managed Security Service Providers)
---
## Revenue Model
| Plan | Target | Price |
|---|---|---|
| Starter | 5–15 consultants | $500–900/mo |
| Growth | 15–50 consultants | $1,500–3k/mo |
| Enterprise | 50+ / MSSP | $5k–15k/mo |
Pricing per firm. Switching cost grows with every engagement indexed.
---
## Moat
Structural switching cost: once 200+ engagements are indexed, migrating means losing years of accumulated, calibrated knowledge. Compounds — not linear.
---
## Competitive Landscape
| Competitor | What they do | Gap |
|---|---|---|
| Cyble | Broad threat intel, $48M, YC W21 | External signals — not internal memory |
| Notion/Confluence | Generic knowledge mgmt | Not built for offensive security |
| HackerOne | Bug bounty platform | Conflict of interest — won't build this |
| Recorded Future | Threat intel, acq. $2.65B | Actor/TTP focus — not engagement memory |
| Semgrep | Static code analysis | Code scanning — not operational memory |
No current competitor has operational memory specialized for offensive security firms.
---
## Stack

```
CI/CD:        GitHub Actions
Edge:         Cloudflare CDN + Workers (rate limiting, caching)
Hosting:      Railway (modular monolith)
Storage:      Cloudflare R2
Secrets:      Bitwarden / OpenBao
Infra:        Packer (reproducible images)

Control flow: Client → Cloudflare Edge → ExpressJS Core → PGBoss → FastAPI (uvicorn) → LangGraph Agent → PGVector pipeline

Response flow (parallel — fire and forget):
  FastAPI (agent response)
    ├── → Response Handler — Memory Write → PGBoss (F&F) → PostgreSQL / R2
    └── → ExpressJS Core → Response Handler — Client Delivery → Client

Core API:     Express + PostgreSQL + Prisma
Cache:        PostgreSQL native — NO REDIS EVER
              (indexes, sessions, NOTIFY/LISTEN, pub/sub)
Queue:        PGBoss (aggressive pooling + manual indexes)
Backups:      pg_dump automated via Railway
Agent:        LangGraph — Python 3.11 — PGVector semantic index
              FastAPI (agent <-> container + ingestion pipeline)
              HITL workflow — LLM decision first always
Containers:   debian-bookworm-slim-12.12
              Web2: 10–20 / 4vCPU / 8GB
              Web3: 5–15 / 4vCPU / 8GB + Solidity
              Auto-scale: min 15 / optimal 25 / max 35
Analysis:     (docker-compose.analysis.yml)
Frontend:     Remix + Vite + React (consultant query UI) + Express (metrics dashboard)
Auth:         JWT + API Keys — RBAC per firm
Payments:     Stripe (Phase 4+)
Observability:Prometheus + Grafana (Phase 4+)
```

## Architecture & Processes
### Infrastructure
- **CI/CD**: GitHub Actions — automated testing, building, deployment
- **Edge**: Cloudflare CDN + Workers — global caching, load balancing, rate limiting tier 1
- **Hosting**: Railway — modular monolith
- **Storage**: Cloudflare R2 — distributed object storage, per-firm prefix isolation
- **Secrets**: Bitwarden / OpenBao
- **Reproducible infra**: Packer — VM + container image creation, OS provisioning
### Control Flow
```
Client → Cloudflare Edge → ExpressJS Core → PGBoss → FastAPI (uvicorn) → LangGraph Agent → PGVector pipeline
```
### Response Flow (parallel — fire and forget)
```
FastAPI (agent response)
  ├── → Response Handler — Memory Write → PGBoss (F&F) → PostgreSQL / R2
  └── → ExpressJS Core → Response Handler — Client Delivery → Client
```
---
## RAG Ingestion Pipeline

When a report (PDF / JSON / CSV) is uploaded, the pipeline executes in order:

```
Step 1 — Entity Extraction
  Input: raw document
  Extract: stack, vuln class, severity, attack vector, resolution
  Model: claude-haiku-4-5-20251001 (cost-optimized for parsing)

Step 2 — Redaction
  Strip PII, secrets, tokens before any LLM call
  Nothing sensitive ever reaches the model

Step 3 — Vectorization
  Semantic content → PGVector embedding index
  Index isolated per firm (0 cross-tenant)
  Stored: Cloudflare R2 (embeddings) + PostgreSQL (metadata)

Step 4 — Structured Metadata Storage
  PostgreSQL: industry, stack, vuln type, severity, resolution, date
  Enables filtered retrieval without full vector search
```
###  Pipeline de Ingesta-Retrieval
```
---

## 1. INGESTA DE PDF

[ PDF Input ]
        |
        v
[ Detectar Complejidad ]
        |
        ├───────────────────────────────────────────────┐
        │                                               │
        v                                               v
 ┌───────────────────────┐                   ┌──────────────────────────┐
 │ SIMPLE (texto)        │                   │ MEDIO (tablas simples)   │
 └───────────────────────┘                   └──────────────────────────┘
        |                                               |
        v                                               v
[ pdfplumber ]                                [ unstructured.local ]
        |                                               |
        v                                               v
[ Claude Sonnet PII ]                         [ Claude Sonnet PII ]
        |                                               |
        v                                               v
[ all-MiniLM-L6-v2 ]                         [ MiniLM + reranker ]
        |                                               |
        v                                               v
[ PGVector ]                                 [ PGVector ]

                                ┌──────────────────────────────┐
                                │ PESADO (tablas complejas)    │
                                └──────────────────────────────┘
                                                |
                                                v
                                     [ unstructured.local ]
                                                |
                                                v
                                     [ Claude Sonnet PII ]
                                                |
                                                v
                                   [ bge-large + reranker ]
                                                |
                                                v
                                          [ PGVector ]

---

## 2. QUERY NUEVA (VULNERABILIDAD)

[ Nueva Query ]
        |
        v
[ Detectar Complejidad ]
        |
        ├───────────────┬───────────────────────┐
        │               │                       │
        v               v                       v

 ┌──────────────┐  ┌──────────────┐      ┌──────────────┐
 │ SIMPLE       │  │ MEDIO        │      │ PESADO       │
 └──────────────┘  └──────────────┘      └──────────────┘
        |               |                       |
        v               v                       v

[ PGVector ]     [ PGVector Top-20 ]     [ PGVector Top-20 ]
[ Top-5 ]               |                       |
                        v                       v
                [ reranker L6 ]        [ reranker L12 ]
                        |                       |
                        v                       v
                   [ Top-5 ]              [ Top-5 ]

(12ms / 78%)     (35ms / 88%)        (45ms / 94%)

---

## 3. FEEDBACK LOOP

[ Nuevo PDF ]
        |
        v
( mismo proceso de arriba )
        |
        v

[ PGVector Comparación ]
        |
        v

[ Resultado: SQLi repetido 95% ]

---

## 4. APRENDIZAJE AUTOMÁTICO

[ Cliente cambia stack ]
        |
        v
[ Nuevos vectores ]
        |
        v
[ RAG aprende automáticamente ]

---
```
### Pipeline Query Workflow (LangGraph Agent)
```
LangGraph Agent + PGVector
        │
        ├──→ PGVector search ──────────────────────→ RAG context assembly ──→ LLM Gen: Contextual Guidance ──→ Combined Response
        │                                                                                                           ↑
        └──────────────────────────────────────────────────────────────→ LLM Gen: Direct Answer ───────────────────┘
```

**Node responsibilities:**
- `PGVector search` — semantic similarity retrieval, max 3 chunks per query
- `RAG context assembly` — assembles retrieved chunks, hard cap 1,500 tokens
- `LLM Gen: Direct Answer` — answers that don't require historical context
- `LLM Gen: Contextual Guidance` — answers grounded in retrieved engagements
- `Combined Response` — merges both paths, attaches source references + audit trail
---
# **CONTEXT PART 2**

## Report & Contextual Guide Generation

### Approach: Structured prompt over cached index — no fine-tuning, no extra infra

At query time (during engagement) and at closure, the LangGraph query node already has:
- PGVector-retrieved chunks (max 3, ~1,500 tokens)
- Structured metadata from PostgreSQL (stack, vuln class, severity, resolution, industry)

Use that exact context with two purpose-specific prompts — one per output type.

### During Engagement — Contextual Guide

```python
GUIDE_PROMPT = """
You are a senior pentester. Given the engagement context and retrieved similar cases,
generate a prioritized attack surface brief.

Format:
## Contextual Guide
**Stack match:** {stack}
**Similar engagements:** {engagement_count}

### Vectors to verify first
1. {vector} — found in {n} similar cases, severity {sev}
...

### Patterns from index
- {finding_pattern}: {resolution_summary}
"""
```

Output: structured `.md` snippet injected directly into the consultant's active session.

### At Closure — Structured Report
```python
REPORT_PROMPT = """
Generate a pre-filled pentest report from the findings below.
Researcher validates and adjusts — do not invent findings not in context.

Format:
## Engagement Report
**Executive Summary:** {2-3 sentences}

## Findings
| # | Title | Severity | CVSS | Vector |
|---|-------|----------|------|--------|
...

## Remediation Patterns
- {finding}: {remediation from index}

## Notes for Reviewer
{low-confidence items flagged for manual review}
"""
```
### Implementation notes
- Both prompts use `cache_control` on the static template block — only the retrieved context changes per call.
- Haiku handles metadata assembly; Sonnet handles final generation.
- Output stored as `.md` in R2 per engagement, referenced in PostgreSQL.
- Confidence threshold: items below 0.6 similarity score are flagged `[REVIEW]` in the report rather than auto-filled.
- No new infra required — runs inside the existing `query_node` with a `mode` parameter: `"guide"` or `"report"`.
---
## LLM Cost Optimization — Anthropic Direct

### Strategy
- Anthropic direct only — no intermediaries, no external fees.
- Two mechanisms: prompt caching + model cascading.
- No OpenRouter until LLM spend exceeds $2,000/mo.

### Model Assignment

| Operation | Model | Input | Output |
|---|---|---|---|
| PDF ingestion, parsing, chunking | claude-haiku-4-5-20251001 | $1/1M | $5/1M |
| Semantic query, context retrieval | claude-sonnet-4-6 | $3/1M | $15/1M |
| Complex reasoning, edge cases | claude-sonnet-4-6 | $3/1M | $15/1M |
No Opus. Sonnet handles 100% of query workload.

### 1. Model Cascading in LangGraph
```python
from langchain_anthropic import ChatAnthropic

MODELS = {
    "ingestion": ChatAnthropic(model="claude-haiku-4-5-20251001", max_tokens=1024),
    "query": ChatAnthropic(model="claude-sonnet-4-6", max_tokens=2048),
}

def get_model(task_type: str) -> ChatAnthropic:
    return MODELS.get(task_type, MODELS["query"])
```

```python
def ingestion_node(state: AgentState) -> AgentState:
    llm = get_model("ingestion")
    # parse PDF chunks, extract metadata

def query_node(state: AgentState) -> AgentState:
    llm = get_model("query")
    # semantic search + context assembly
```
### 2. Prompt Caching — cache_control
Cache the system prompt + tool definitions. Identical across every request.
Cache reads cost 10% of normal input price — 90% reduction on that block.
TTL: 1h for stability.

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage

CACHED_SYSTEM_PROMPT = SystemMessage(
    content=[
        {
            "type": "text",
            "text": """
You are the 6xargs operational memory agent.
You reason over historical pentesting engagements indexed by PGVector.
Given a consultant query, retrieve the most relevant past findings,
attack patterns, and resolutions. Be precise and structured.
[...full system prompt here...]
""",
            "cache_control": {"type": "ephemeral", "ttl": "1h"},
        }
    ]
)
```
Cache tool definitions too — static per agent version:
```python
tools_block = {
    "type": "text",
    "text": "[...serialized tool schemas...]",
    "cache_control": {"type": "ephemeral", "ttl": "1h"},
}
```
### 3. RAG Chunk Budget — hard limit
Never send more than 3 chunks to the LLM. Each chunk max 512 tokens.
Max context injected per query: ~1,500 tokens.

```python
def assemble_context(chunks: list[str], max_chunks: int = 3) -> str:
    return "\n\n---\n\n".join(chunks[:max_chunks])
```
### 4. LangGraph State — avoid history explosion
Keep only last 2 exchanges in state, summarize the rest.

```python
class AgentState(TypedDict):
    query: str
    context: str        # assembled RAG chunks — max 1,500 tokens
    history: list[dict] # max 2 turns — older turns summarized
    result: str

def trim_history(history: list[dict], max_turns: int = 2) -> list[dict]:
    if len(history) <= max_turns:
        return history
    summary = summarize_old_turns(history[:-max_turns])
    return [{"role": "assistant", "content": summary}] + history[-max_turns:]
```
### Rules
- `cache_control` on every static block: system prompt, tool schemas, RAG preamble.
- Haiku for every ingestion task — no exceptions.
- Sonnet for queries — no Opus until proven necessary.
- Max 3 RAG chunks per query.
- Max 2 turns in LangGraph history state.
- Review actual token usage in Anthropic dashboard monthly.
---
# **CONTEXT PART 3**
## Services on Railway (Monolith split in 5)
### 1. EXPRESS.JS (API Gateway B2B — Backbone)
> Socket.IO for WebSockets

Express is the backbone. Central hub where all operations converge.

**Orchestrates:**
- Authentication (JWT, API Keys)
- FastAPI communication
- Data validation
- Logging and monitoring
- Rate limiting and security
- DB connection (Prisma)
- LangGraph via FastAPI
- Webhooks and notifications

**Abstracts to client:**
```
POST /api/knowledge/query
{ "query": "SSRF patterns in fintech stacks" }

1. Authenticate API key
2. Validate data
3. Enqueue job in PGBoss
4. Delegate to FastAPI / LangGraph
5. Persist to DB (F&F)
6. Deliver response to client
7. Log metrics
```

**Architectural properties:** modular, scalable, maintainable, extensible.

**Pipeline latencies:**
- Authentication Middleware                  ~5ms
- **Rate Limiting (2nd Layer)**              ~2ms
  - Ingestion: 10/15min
  - Auth: 5/15min
  - Webhooks: 30/1min
  - Registration: 3/1h
  - Dynamic Tiers (Starter / Growth / Enterprise)
- Request Validation                         ~3ms
- Webhook Handler (Unique API Key per firm)  ~5ms
- PostgreSQL + Prisma                        ~5–15ms
  - Client Data & Usage                      ~5ms
  - API Keys & Auth                          ~3ms
  - Ingestion Job Requests                   ~10ms
  - Usage & Billing                          ~8ms
  - Webhook Logs                             ~5ms
  - Query Results                            ~15ms
- Response Handler — Client Delivery         ~10ms
- Error Handler                              ~5ms
---
### 2. FASTAPI — Ingestion & Query
> uvicorn · `python:3.11-slim-bookworm` · Native WebSocket (HTTPS)
> Orchestrates communication between ExpressJS Core and LangGraph Agent

**LangGraph Orchestrator:**
- Intent Classifier Node                     ~10ms
- Redaction Layer (PII / secrets pre-LLM)   ~15ms
- Entity Extractor (stack, vuln type, severity, resolution) ~30ms
- PGVector Retriever (per-firm semantic search) ~20ms
- LLM Generation Node                        ~800–1500ms
- Source Reference + Audit Trail             ~10ms
- Response Handler — Memory Write → PGBoss (F&F) ~5ms

**Docker runtime — Debian-Slim:**
- Pool Web2: 10–20 containers, 4 vCPU / 8GB RAM — traditional pentesting firms
- Pool Web3: 5–15 containers, 4 vCPU / 8GB RAM + Solidity — Web3 / Hybrid
- Auto-scaling: min 15 / optimal 25 / max 35
- Isolation: Namespaces (PID, Network, Mount, UTS, IPC), AppArmor / SELinux, tmpfs ephemeral filesystem, CGroups

**AI Agent:**
- Entrypoint: `python sixmod.py`
- LLM decision-making first — before any other function
- HITL (Human-in-the-Loop) workflow
- Blacklist commands: nmap, scan, rm, and others
- Dropdown modes: PoC, web search, multi-fetch, edit, read
- OS packages: git, curl, iputils-ping, ca-certificates, nmap, netcat-openbsd, hping3
---
### 3. Frontend
- Remix, vite, react, etc — consultant natural language query interface (active deployment)
- ExpressJS/Remix/vite - Metrics
---
# 4. **Endpoints (ALL GRAPHANA & PROMETHEUS)**

**API Core Endpoints**

**Metrics:**
```
GET  /api/v1/metrics/engagements-indexed  # Engagements Indexed per Firm - count per firm/month
GET  /api/v1/metrics/validation-accuracy  # Vulnerability Validation Accuracy - tp / (tp+fp) from feedback
GET  /api/v1/metrics/query-latency     # Query Response Latency - avg query response time
```

**Core product endpoints — the actual product functionality a consultant or firm uses:**
```
POST /api/v1/ingestion/upload          # upload historical engagement PDFs
GET  /api/v1/ingestion/status/:id      # ingestion job status
POST /api/v1/query                     # natural language query during engagement
```

**System / event endpoints — infrastructure-level, not user-facing:**

```
POST /api/v1/webhooks/notify           # notify firm on ingestion complete
```

**Auth & API Keys**

```
POST /api/v1/auth/token
POST /api/v1/keys              # generate API key per firm
DELETE /api/v1/keys/:id
```

**Firm / Tenant Management**

```
POST /api/v1/firms             # onboard new firm
GET  /api/v1/firms/:id
```

**Engagement Management**

```
GET    /api/v1/engagements     # list indexed engagements per firm
DELETE /api/v1/engagements/:id # remove from index
```

**Compliance**

```
DELETE /api/v1/gdpr/delete-user-data
GET    /api/v1/gdpr/export
```

**Health**

```
GET /health
```

___
### Auth

```bash
curl -H "Authorization: Bearer sk_live_6xargs_abc123" \
     https://api.6xargs.com/v1/query
```
---
### 5. Databases & Storage

#### PostgreSQL — Isolation & Caching Layer
> NO REDIS, EVER — PostgreSQL native only

- Per-firm schema isolation (RLS + Tenant_id)
- Sessions Management                        ~1ms  — BTREE index
  - Session Token Lookup                     ~0.5ms
  - TTL-based expiration                     ~1ms
  - Concurrent sessions ~10K
- API Response Cache                         ~0.5ms — HASH index, ~85% hit rate
- PGVector Index Metadata per firm              ~5ms
- Pub/Sub (NOTIFY/LISTEN)                    ~5ms  — inter-service events, JSON payload

#### PGBoss (Job Queue — PostgreSQL Based)
- Ingestion Job Processing                   ~5ms
- Fire and Forget — Memory Write (non-blocking) ~3ms
- Connection Pooling 50+ conns               ~1ms
- Optimized indices                          ~1ms
> Just apply if is useful for response optimization. 
- (OPTIONAL if is useful)Partitioned Job Tables (date-based)        ~2ms
- (OPTIONAL if is useful)LISTEN/NOTIFY - Manual trigger. When inserting a report in Express, you can send a Postgres NOTIFY. Upon receiving the NOTIFY, the worker immediately fetches the job, eliminating the wait for the newJobCheckInterval
- (OPTIONAL if is useful)Adjust max_connections, use a pgbouncer pooler to open/close connections not slow the response time.
- (OPTIONAL if is useful)Minimize the 'archiveCompletedJobsEvery' and 'newJobCheckInterval':
```
const boss = new PgBoss({
  connectionString: '...',
  newJobCheckInterval: 50,
  archiveCompletedJobsEvery: '1 minute',
  deleteArchivedJobsEvery: '10 minutes'
});
```
- (OPTIONAL if is useful)Concurrency:
```
await boss.work('triage-queue', { teamSize: 20, batchSize: 10 }, async (jobs) => {
});
```

#### Cloudflare R2 (Object Storage — per-firm prefix isolation)
- Embeddings / PGVector snapshots               ~50ms
- Audit logs bucket                          ~40ms
- Contracts & MSA bucket                     ~30ms
- Assets bucket                              ~20ms

#### PG_DUMP (Automated Backup)
- Scheduled backups every 6h                 ~10min — Railway
- Compressed archives (gzip)                 ~5min
- Retention 30 days                          ~1min
- Railway Storage integration                ~2min
---

## Rate Limiting (triple layer)
| Layer | Implementation | Scope |
|---|---|---|
| Edge | Cloudflare Workers (`src/worker.js`) + KV | Per tier |
| Backend | Express middleware `rate-limit.middleware.js` | Per endpoint + tenant |
| Infra | Docker resource limits per container | Per job / firm |

| Plan | Requests/15min | Ingestion jobs/15min | SLA |
|---|---|---|---|
| Starter | 100 | 10 | 99% |
| Growth | 500 | 25 | 99.5% |
| Enterprise | 1000 | 50 | 99.9% |
---

## Semantic Memory
- **PGVector**: vector index per-firm over engagement corpus
- **LangGraph**: state orchestration (replaces linear LangGraph agent)
- **Retained**: embeddings + structured entities (stack, vuln type, severity, resolution, industry)
- **Not stored**: original PDFs, PII, evidence, secrets, raw report text — learned from, never persisted
- Total firm isolation: 0 cross-tenant in any query
- Embeddings mathematically irreversible to source document
---
# **CONTEXT PART 4**
## Technical Reorientation Delta
Stack unchanged. Input and output change.

| Component       | Before (deprecated)        | Now (active)                          |
|-----------------|---------------------------|---------------------------------------|
| PGVector index     | BB report similarity       | Engagement semantic index             |
| LangGraph Agent | Triage classification      | Contextual query during engagement    |
| PostgreSQL      | Report + job storage       | Knowledge graph per firm, isolated    |
| FastAPI         | Container orchestration    | Same + PDF ingestion pipeline         |
| Remix frontend  | Triage dashboard           | Consultant natural language interface |
| PGBoss          | Async triage queue         | Ingestion jobs + query job queue      |

Estimated dev effort: 3–4 weeks incremental. No rewrite.
---

## Stack
### Infrastructure
| Layer      | Tool                                          |
|------------|-----------------------------------------------|
| CI/CD      | GitHub Actions                                |
| Edge       | Cloudflare CDN + Workers (rate limiting, caching) |
| Hosting    | Railway (modular monolith)                    |
| Storage    | Cloudflare R2                                 |
| Secrets    | Bitwarden / OpenBao                           |
| Infra      | Packer (reproducible images)                  |

### Backend
| Layer        | Tool                                              |
|--------------|---------------------------------------------------|
| Core API     | Express + PostgreSQL + Prisma                     |
| Control flow | Express API → LangGraph Agent → Containers        |
| Cache        | PostgreSQL native — NO REDIS EVER (indexes, sessions, NOTIFY/LISTEN, pub/sub) |
| Queue        | PGBoss (aggressive pooling + manual indexes)      |
| Backups      | pg_dump automated via Railway                     |
| Auth         | JWT + API Keys — RBAC per firm                    |

### AI Agent
| Layer     | Tool                                                        |
|-----------|-------------------------------------------------------------|
| Agent     | LangGraph — Python 3.11 — PGVector semantic index              |
| Transport | FastAPI (agent <-> container + ingestion pipeline)          |
| Workflow  | HITL — LLM decision first always                           |

### Containers
| Pool     | Spec                                          |
|----------|-----------------------------------------------|
| Base     | debian-bookworm-slim-12.12                    |
| Web2     | 10–20 containers / 4 vCPU / 8GB RAM          |
| Web3     | 5–15 containers / 4 vCPU / 8GB RAM + Solidity|
| Scale    | min 15 / optimal 25 / max 35                  |
| Analysis | (docker-compose.analysis.yml) |

### Frontend & Observability
| Layer         | Tool                                              |
|---------------|---------------------------------------------------|
| Frontend      | Remix (consultant query UI) + Express (metrics dashboard) |
| Payments      | Stripe (Phase 4+)                                 |
| Observability | Prometheus + Grafana (Phase 4+)                   |
---

### Roles
| Role         | Access                                                         |
| ------------ | -------------------------------------------------------------- |
| Organization | Full program mgmt, billing, metrics                            |
| Admin        | API keys, users, audit logs                                    |
| Developer    | API integration, webhooks, docs                                |
| AI Agent     | Ingestion, indexing, query execution,  report guide generation |
---

## Roadmap
### Phase 0— Validation (immediate)
- 3 meetings with pentesting firms
- Goal: 1 data-sharing agreement (anonymized historical engagements)
- Key question: how much billable time is lost re-deriving past context?

### Phase 1— MVP (weeks 1–4)
- PDF ingestion pipeline for historical engagements
- PGVector semantic indexing: industry, stack, vuln type, resolution
- Natural language query endpoint
- Live demo with real client data

### Phase 2— Paid pilot (weeks 5–10)
- 1 client paying $500–1,500/mo
- Retention >60 days = PMF signal

### Phase 3— Second client (weeks 11–16)
- Onboard without manual assistance
- Validates scalability without founder bottleneck

### Phase 4—5 firms (months 5–8)
- MRR $5k–10k
- Accelerator / pre-seed pitch basis

### Phase 5–8 (post-traction)
- Advanced multi-tenant
- Prometheus + Grafana observability
- Stripe billing
- VC round preparation

------------------------------------------------

# **TECHNICAL ROADMAP - CHECKLIST**
# 6xargs — Internal Technical Roadmap
# Last updated: March 2026

### Phase 0 — Validation (now)

- [ ] 3 meetings with pentesting firms this weekend
- [ ] 1 data-sharing agreement (anonymized historical engagements)
- [ ] Confirm: how much billable time lost re-deriving past context?

### Phase 1 — MVP (weeks 1–4)

- [ ] PDF ingestion pipeline (FastAPI + PGBoss)
- [ ] PGVector semantic index: industry, stack, vuln type, resolution
- [ ] Natural language query endpoint
- [ ] Feedback loop: useful / not useful per result
- [ ] Live demo with real client data
- [ ] JWT auth + API keys
- [ ] Basic metrics endpoints

### Phase 2 — Paid Pilot (weeks 5–10)

- [ ] 1 client paying $500–1,500/mo
- [ ] Retention >60 days = PMF signal
- [ ] Per-firm knowledge graph isolation (multitenant)
- [ ] Webhook: notify on ingestion complete

### Phase 3 — Second Client (weeks 11–16)

- [ ] Onboard without manual assistance
- [ ] Validates scalability without founder bottleneck
- [ ] Basic dashboard: engagements indexed, query latency, accuracy

### Phase 4 — 5 Firms (months 5–8)

- [ ] MRR $5k–10k
- [ ] Stripe billing integrated
- [ ] Prometheus + Grafana (basic mode)
- [ ] Sales deck for accelerator / pre-seed pitch
- [ ] Isolated demo environment per prospect

### Phase 5–6 — Production Scale (months 8–12)

- [ ] Railway production environment hardened
- [ ] Automated pg_dump + Cloudflare R2 backup
- [ ] API docs published (GitHub + site, Stripe/OpenAI style)
- [ ] SOC 2 Type I preparation
- [ ] DPA + SLA templates for enterprise

### Phase 7 — Advanced Infra (post-traction)

- [ ] Packer for reproducible infra
- [ ] Advanced multi-tenant
- [ ] Web3 pipeline deep
- [ ] Per-container persistent memory

### Phase 8 — VC Ready (2026–2027)

- [ ] KPIs documented: query latency, engagements indexed, accuracy, churn
- [ ] Live demo with real metrics
- [ ] Validated pricing + case studies
- [ ] Enterprise pipeline: DPA + SLA + compliance

---
## Dashboard Metrics (North Star)

|Metric|Source|Endpoint|
|---|---|---|
|Query response latency|created_at → completed_at|/metrics/query-latency|
|Engagements indexed per firm|engagement_events table|/metrics/engagements-indexed|
|Validation accuracy|user feedback tp/fp|/metrics/validation-accuracy|

---

### Incident Response

|Severity|Response|Escalation|
|---|---|---|
|P0 Critical|15 min|CTO + CEO|
|P1 High|1 hr|Security team|
|P2 Medium|4 hr|DevOps lead|
|P3 Low|24 hr|Assigned dev|

---
## Do Not Build:

- Multi-region infra
- Enterprise SSO / OAuth2 (API keys only)
- Complex dashboards (JSON endpoints sufficient)
- Advanced multi-tenant
- Cost-per-analysis detail
- Global load balancing

---
# Security
This project must follow security best practices at all
times. Apply these rules to every file and endpoint you create:
## 1. Rate Limiting
- Implement rate limiting on ALL API endpoints.
- Use rate limiting middleware (such as express-rate-limit, @upstash/
ratelimit, or the equivalent in your framework).
- Recommended limits:
 - General API: 100 requests per IP every 15 minutes.
 - Auth (login/registration): 5 attempts per IP every 15 minutes.
 - Sensitive endpoints (payments, admin): 10 requests per IP every 15 minutes.
- Return a 429 (Too Many Requests) error with a clear message when the
limit is exceeded.
## 2. Environment Variables and Secrets
- NEVER hardcode API keys, tokens, passwords, or secrets directly into the
code.
- ALWAYS use environment variables (.env) for any credentials.
- Make sure .env is in .gitignore.
- If you need a new API key, create it as an environment variable and
document it in a .env.example (without the actual value, just the name of the
variable).
- When starting the app, validate that all necessary environment variables
exist. If any are missing, the app must not start.
## 3. Input Validation (Anti-Injection) 
- Validate and sanitize ALL user inputs before processing them (forms, query parameters, headers, request bodies). 
- Use a validation library (such as zod, joi, or yup) to define strict schemas. 
- Never construct SQL queries by concatenating strings with user input. ALWAYS use parameterized queries or an ORM (such as Drizzle, Prisma, etc.). 
- Escape any output rendered in HTML to prevent XSS. Use your framework’s built-in protections (React escapes by default, but be careful with `dangerouslySetInnerHTML`). 
- Reject and log any input that fails validation. 
## 4. Security Headers 
- Configure HTTP security headers: Content-Security-Policy, X-ContentType-Options, X-Frame-Options, Strict-Transport-Security. 
- Use middleware such as Helmet (Express) or the equivalent in your framework. 
## 5. Authentication and Sessions 
- Use secure tokens (httpOnly, secure, sameSite) for session cookies. 
- Implement CSRF protection on forms. 
- Passwords must be hashed with bcrypt or argon2. NEVER store them in plain text. 
## 6. Security Logging 
- Log failed authentication attempts. 
- Log requests that exceed the rate limit. 
- Log inputs rejected by validation (possible injection attempts). 
- NEVER log sensitive data (passwords, tokens, personal data).

# Extra security measures to avoid:
- API keys in the frontend, anyone can read them
- Railway tables without RLS, anyone can pull your data
- Endpoints with no auth, AI writes them to run, not to be safe
- Validation only on the frontend
- No rate limiting on login, signup, password reset, or AI endpoints
- No input validation
- Secrets hardcoded in the repo

    - Argon2 password hashing (never plaintext)
    - Zod input validation on all fields — blocks injection at boundary
    - JWT httpOnly/secure/sameSite cookies — mitigates XSS session theft
    - Helmet security headers (CSP, X-Content-Type, HSTS, X-Frame)
    - Rate limiting: 5 attempts/15min on auth endpoints
    - CSRF protection on forms
    - Never log passwords/tokens
    - Parameterized queries via Prisma (no SQL injection)