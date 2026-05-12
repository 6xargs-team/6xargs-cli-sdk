# 6xargs CLI

Operational reasoning CLI for offensive security firms. Index engagement findings, query during active engagements, and manage your firm's context from the terminal.

```
npx @6xargs/cli ask "SSRF patterns in fintech Node.js stacks"
```

---

## Installation

```bash
# npx (no install)
npx @6xargs/cli <command>

# Global install
npm install -g @6xargs/cli

# bun
bunx @6xargs/cli <command>

# pnpm
pnpm dlx @6xargs/cli <command>
```

Requires Node.js >= 20 LTS.

---

## Quick Start

```bash
# 1. Authenticate
6xargs login --api-key sk_live_6xargs_...

# 2. Index an engagement PDF
6xargs ingest upload ./pentest-report-q1.pdf --wait

# 3. Query your knowledge base
6xargs ask "what SSRF patterns did we find in fintech clients?"

# 4. Check your firm
6xargs firm info
```

---

## Authentication

### Login

Interactive (prompts for username, password, and API key):
```bash
6xargs login
```

Non-interactive (CI/CD):
```bash
6xargs login --api-key sk_live_6xargs_abc123...
```

### Other auth commands

```bash
6xargs logout             # End session (keeps API key stored)
6xargs logout --hard      # Remove all credentials
6xargs whoami             # Show current user, firm, plan, token expiry
6xargs auth token         # Print JWT to stdout (for scripting)
```

---

## Ingest

Index engagement findings into the knowledge base.

```bash
# Upload a single file
6xargs ingest upload ./report.pdf

# Upload and wait for indexing to complete
6xargs ingest upload ./report.pdf --wait

# Upload with tags
6xargs ingest upload ./report.pdf --tags fintech,ssrf,node

# Upload all PDFs in a directory
6xargs ingest upload ./reports/*.pdf --wait

# Check status of an upload job
6xargs ingest status job_abc123

# List recent uploads
6xargs ingest list
6xargs ingest list --status pending
6xargs ingest list --status completed
6xargs ingest list --status failed
```

Supported formats: `.pdf`, `.json`, `.csv` (max 50 MB per file).

### Vendor export formats

Import directly from PlexTrac or AttackForge — the CLI normalizes the export before indexing:

```bash
# PlexTrac JSON export
6xargs ingest upload ./plextrac-export.json --source plextrac --wait

# AttackForge JSON export
6xargs ingest upload ./attackforge-export.json --source attackforge --wait

# Auto-detect format
6xargs ingest upload ./export.json --source auto --wait
```

---

## Query

Ask the knowledge base questions grounded in your indexed findings.

```bash
# Guide mode (default) — concise, actionable answer
6xargs ask "SSRF patterns in fintech Node.js stacks"

# Report mode — structured, detailed output
6xargs ask "SSRF patterns" --mode report

# Stream the response token by token
6xargs ask "SQL injection patterns in Django ORM" --stream

# JSON output (for piping to jq)
6xargs ask "XSS in React SPAs" --json

# Query history
6xargs query history

# Submit feedback on a result
6xargs query feedback qry_abc123 --useful
6xargs query feedback qry_abc123 --not-useful --reason "stale findings from 2023"
```

---

## Engagements

Manage indexed engagements in your knowledge base.

```bash
# List all indexed engagements
6xargs engagements list
6xargs engagements list --json

# View engagement details
6xargs engagements show eng_abc123

# Remove an engagement from the index
6xargs engagements delete eng_abc123          # prompts for confirmation
6xargs engagements delete eng_abc123 --force  # skip confirmation
```

---

## Firm & API Keys

```bash
# View firm details, plan, and usage stats
6xargs firm info

# API key management
6xargs firm keys list
6xargs firm keys create --name "CI pipeline"
6xargs firm keys revoke key_abc123          # prompts for confirmation
6xargs firm keys revoke key_abc123 --force
```

API keys created via `firm keys create` display the full key once at creation time. Store it securely — it cannot be retrieved again.

---

## Configuration

```bash
# View all config
6xargs config list

# Read a value
6xargs config get output_format
6xargs config get api_base

# Set a value
6xargs config set output_format json
6xargs config set api_base https://staging.6xargs.com

# Named profiles (e.g. separate staging/prod credentials)
6xargs config switch-profile staging
6xargs config switch-profile default

# Reset to defaults
6xargs config reset
6xargs config reset --force
```

### Settable keys

| Key | Values | Default |
|-----|--------|---------|
| `output_format` | `table`, `json`, `yaml`, `raw` | `table` |
| `api_base` | any HTTPS URL | `https://api.6xargs.com` |

---

## System

```bash
6xargs health        # Check API availability and latency
6xargs version       # Print CLI version
6xargs --help        # Global help
6xargs <cmd> --help  # Per-command help
```

---

## Global Flags

All commands accept these flags:

| Flag | Description |
|------|-------------|
| `--json` | Force JSON output (bypasses Ink rendering) |
| `--format <fmt>` | `table`, `json`, `yaml`, `raw` |
| `--debug` | Show HTTP requests, responses, and timing |
| `--no-color` | Disable terminal colors |
| `--profile <name>` | Use a named config profile |
| `--api-base <url>` | Override API base URL for this invocation |
| `--quiet` | Suppress non-essential output |

---

## Output Formats

```bash
# Pipe JSON output to jq
6xargs engagements list --json | jq '.[].name'

# YAML (human-readable, config export)
6xargs firm info --format yaml

# Raw (unformatted API response body)
6xargs ingest status job_abc123 --format raw

# Table (default)
6xargs ingest list
```

Spinner and progress output always goes to **stderr**, keeping **stdout** clean for piping.

---

## Security

6xargs implements a three-layer security model for client data. Every engagement you index is protected at the application, cryptographic, and network level.

### Layer 1 — Multi-tenant isolation (RLS)

Every query, ingest, and retrieval operation is scoped to your firm's identifier via PostgreSQL Row-Level Security. No application-level `WHERE firm_id = ?` is required — the database enforces it. A missing or mismatched firm context returns zero rows.

- Cross-tenant data access is structurally impossible — not just a policy.
- The ingest pipeline (`sixpi_app` role) has `SELECT + INSERT` only — it cannot delete embeddings.
- Deletion operations use a separate `sixpi_delete` role, isolated from the ingest path.

### Layer 2 — AES-256-GCM encryption at rest

All chunk text is encrypted with AES-256-GCM before being written to the database. Embeddings (vectors) are computed from plaintext first, then the plaintext is encrypted — semantic search works normally, but the database stores only ciphertext.

```
embed(plaintext)   → vector (semantically meaningful)
encrypt(plaintext) → $gcm$... (written to DB)
decrypt on retrieval → plaintext delivered to LLM in-memory only
```

- Per-firm key derivation via HKDF-SHA256 — one compromised firm does not expose others.
- A full database breach or `pg_dump` leak yields only `$gcm$...` ciphertext.
- Cross-tenant chunk substitution raises `InvalidTag` at the cryptographic layer — blocked even if RLS is bypassed.
- Master key is stored in OpenBao (not in environment variables or config files).

**NDA posture:** 6xargs stores zero readable report content. Competitors (PlexTrac, AttackForge) store full unencrypted reports — their breach is your client's NDA breach.

### Layer 3 — VPC Sovereignty (Enterprise)

Enterprise clients can deploy 6xargs entirely within their own AWS or GCP account. No data leaves their cloud boundary.

```
Customer cloud account
  Public subnet  → ALB (TLS termination)
  Private subnet → FastAPI + PGVector + OpenBao (no direct internet access)
                   OpenBao auto-unseals via AWS KMS / GCP KMS
```

- 6xargs provides a Terraform kit (`infra/terraform/`). The customer runs `terraform apply` in their own account.
- 6xargs never has access to the customer's infrastructure.
- Per-customer Terraform state is isolated in the customer's own S3 bucket.
- Local simulation available for evaluation: `infra/vpc-local/` — Docker isolated networks + Nginx ALB.

| Plan | Data isolation | Encryption | VPC sovereignty |
|---|---|---|---|
| Starter / Growth | RLS per firm | AES-256-GCM | 6xargs-managed cloud |
| Enterprise | RLS per firm | AES-256-GCM | Customer's own AWS/GCP account |

Full technical detail: [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)

---

## Environment Variables

Environment variables take precedence over config file values.

| Variable | Description |
|----------|-------------|
| `SIXARGS_API_KEY` | API key (overrides stored key) |
| `SIXARGS_API_BASE` | API base URL |
| `SIXARGS_PROFILE` | Named profile to use |
| `SIXARGS_OUTPUT_FORMAT` | Default output format |
| `SIXARGS_DEBUG` | `true` to enable debug logging |
| `SIXARGS_NO_COLOR` | `true` to disable colors |

---

## CI/CD Usage

```bash
# Non-interactive login with env var
SIXARGS_API_KEY=sk_live_6xargs_... 6xargs ingest upload ./report.pdf --wait

# Or set in CI secrets and use the flag
6xargs login --api-key "$SIXARGS_API_KEY"
6xargs ingest upload ./report.pdf --wait --json | jq '.[] | {id, status}'
```

The `--json` flag and non-zero exit codes make the CLI scriptable:

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | User error (bad input, missing args) |
| `2` | API error (5xx, network timeout) |
| `3` | Auth error (invalid key, expired) |
| `130` | Interrupted (Ctrl+C) |

---

## Binary Distribution

Standalone binaries (no Node.js required) are published to GitHub Releases.

```bash
# Linux x64
curl -L https://github.com/r3vskd/6xargs-cli-sdk/releases/latest/download/6xargs-linux \
  -o /usr/local/bin/6xargs && chmod +x /usr/local/bin/6xargs

# macOS x64
curl -L https://github.com/r3vskd/6xargs-cli-sdk/releases/latest/download/6xargs-macos \
  -o /usr/local/bin/6xargs && chmod +x /usr/local/bin/6xargs

# Windows — download 6xargs-win.exe from the Releases page
```

---

## Development

```bash
git clone https://github.com/r3vskd/6xargs-cli-sdk
cd 6xargs-cli-sdk
pnpm install

pnpm dev           # Watch mode (rebuilds on change)
pnpm build         # Production ESM build -> dist/index.mjs
pnpm test          # Unit + integration tests
pnpm typecheck     # TypeScript strict check
pnpm lint          # ESLint

# Run against real API (requires test key)
SIXARGS_TEST_KEY=sk_live_6xargs_... pnpm test:e2e
```

### Config file location

```
~/.config/6xargs/config.json    # Linux / macOS
%APPDATA%\6xargs\config.json    # Windows
```

Config is validated against a zod schema on every read. Corrupt config resets to defaults with a warning.

---

## Local Testing

No live API needed. `mock-server.js` ships with the repo and simulates every endpoint.

### 1. Build and start the mock server

```bash
# Terminal 1 — build once (skip if dist/ is current)
pnpm build

# Terminal 2 — keep the mock server running throughout
node mock-server.js
# 6xargs mock server  http://localhost:9000
# Demo API key: sk_live_6xargs_DemoDay2025ShowcaseABC12
```

### 2. Set shorthand variables

```bash
# bash / zsh
export API="http://localhost:9000"
export KEY="sk_live_6xargs_DemoDay2025ShowcaseABC12"
```

```powershell
# PowerShell
$api = "http://localhost:9000"
$key = "sk_live_6xargs_DemoDay2025ShowcaseABC12"
```

### 3. Health check

```bash
6xargs --api-base $API health
# API: OK (27ms)  http://localhost:9000/health
```

### 4. Login

```bash
6xargs --api-base $API login --api-key $KEY --username demo
# Authenticated
#   firm:  Demo Security Firm
#   plan:  PRO
```

### 5. Verify session

```bash
6xargs --api-base $API whoami
# user:  demo   firm: Demo Security Firm   plan: PRO
```

### 6. List engagements

```bash
6xargs --api-base $API engagements list
# ID           NAME                INDUSTRY    FINDINGS  INDEXED
# eng_demo001  Acme Corp Web App   fintech     14        ...
# eng_demo002  Globex API Gateway  healthcare  8         ...

# JSON output
6xargs --api-base $API engagements list --json
```

### 7. Engagement detail

```bash
6xargs --api-base $API engagements show eng_demo001
```

### 8. Ingest a file

```bash
# Fire and forget — returns job ID immediately
6xargs --api-base $API ingest upload tests/fixtures/demo-finding.json

# Block until indexed
6xargs --api-base $API ingest upload tests/fixtures/demo-finding.json --wait
# demo-finding.json  job_<id>  completed

# Check status of a specific job
6xargs --api-base $API ingest status job_demo001
```

### 9. Query the knowledge base

```bash
6xargs --api-base $API ask "SSRF patterns in fintech Node.js stacks"
# Answer + sources + latency (guide mode default)

# Report mode — structured output
6xargs --api-base $API ask "SSRF patterns" --mode report

# JSON (pipe to jq)
6xargs --api-base $API ask "SSRF patterns" --json | jq '.answer'
```

### 10. Query history

```bash
6xargs --api-base $API query history
```

### 11. Firm info and API keys

```bash
6xargs --api-base $API firm info
6xargs --api-base $API firm keys list
```

### 12. Error handling

```bash
# Bad key format — exits 1
6xargs --api-base $API login --api-key bad-key --username demo

# Unreachable host — exits 2
6xargs --api-base http://localhost:9999 health
```

### 13. Logout

```bash
6xargs logout          # clear session, keep API key
6xargs logout --hard   # remove all credentials
```

### One-shot script

```bash
# Run all steps in sequence
for cmd in \
  "health" \
  "login --api-key $KEY --username demo" \
  "whoami" \
  "engagements list" \
  "engagements show eng_demo001" \
  "ingest upload tests/fixtures/demo-finding.json --wait" \
  "ingest status job_demo001" \
  'ask "SSRF patterns in fintech Node.js stacks"' \
  "query history" \
  "firm info" \
  "firm keys list"
do
  echo "--- $cmd ---"
  eval "6xargs --api-base $API $cmd"
done
```

---

## License

MIT
