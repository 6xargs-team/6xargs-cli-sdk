# 6xargs CLI

Operational memory CLI for offensive security firms. Index engagement findings, query your knowledge base during active engagements, and manage your firm's context from the terminal.

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

## License

MIT
