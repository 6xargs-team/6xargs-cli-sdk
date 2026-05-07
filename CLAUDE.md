# CLAUDE.md — 6xargs CLI SDK
## Identity
You are building `6xargs` — a developer CLI that connects pentesting firms to the 6xargs operational memory API. Architecture: `stripe-cli` meets `claude-code` for offensive security. Thin client over REST API. Zero local AI processing.

## Rules
1. English only. NEVER use emojis.
2. Comments: explicit, is a public package, take good production practices from startups like strpe,codex.
3. Complete solution in single file write — not incremental. You has a strict budget of 19 tool calls try to never reach 19, if you reach 19, stop and tell me that the tool-calls is gone & your progress with a brief round borders table.
4. Run tests once. Pass → stop. Fail → fix once, retest. Never iterate twice on same failure.
5. TypeScript strict mode. No `any`. No `as` casts unless unavoidable + commented.
6. Zero runtime dependencies beyond: commander, chalk, ora, undici, zod, conf.
7. Every command must work non-interactively (flags) and interactively (prompts).
8. Exit codes: 0 success, 1 user error, 2 API error, 3 auth error, 130 SIGINT.
9. Update MEMORY.md on every major change (max 50 words, technical summary).

## Stack, Languages & Distribution
| Layer | Tool |
|---|---|
| Strict languages | **TypeScript** (primary) / **Go** (binary builds, Phase 2) |
| Runtime | Node.js >=20 LTS |
| Package manager | pnpm |
| CLI framework | Commander.js |
| HTTP | undici (native fetch) |
| Validation | zod |
| Config | conf (XDG-aware) |
| Output | chalk + ora (spinner) | termcn (Ink-based React components) via shadcn registry |
| Build | tsup (esbuild) |
| Test | vitest |
| Lint | eslint + prettier |
| Distribution | npm `@6xargs/cli` + standalone via pkg |
| CI/CD | GitHub Actions |
--------------------------
|   DISTRIBUTION    |
| Channel | Command |
|---|---|
| bun | `bunx @6xargs/cli` |
| npm/npx | `npx @6xargs/cli` or `npm i -g @6xargs/cli` |
| brew | `brew install 6xargs/tap/6xargs` (Phase 2 — Go binary) |

TypeScript for development velocity and backend type sharing.
Go for Phase 2 standalone binary distribution (brew, pkg managers) — compiled from same API contract.

## Terminal UI — termcn

Built on [Ink](https://github.com/vadimdemedes/ink) (React for CLIs).
Distributed via shadcn registry. Replaces chalk + ora for all output rendering.

### Installation
```bash
# bun
bunx shadcn@latest add @termcn/spinner @termcn/alert @termcn/table @termcn/badge @termcn/tool-call

# npm/npx
npx shadcn@latest add @termcn/spinner @termcn/alert @termcn/table @termcn/badge @termcn/tool-call

# pnpm
pnpm dlx shadcn@latest add @termcn/spinner @termcn/alert @termcn/table @termcn/badge @termcn/tool-call
```

### Component mapping — 6xargs commands
| termcn component | Used in |
|---|---|
| `<Spinner>` | `ingest upload --wait`, `ask` query in progress |
| `<Alert>` | errors, warnings, rate limit notices, auth failures |
| `<Table>` | `engagements list`, `ingest list`, `firm keys list` |
| `<Badge>` | plan tier (STARTER/GROWTH/ENTERPRISE), job status |
| `<ToolCall>` | `ask` response rendering — shows LangGraph agent steps |

### On start the cli should be this ux banner (only each time the cli is started, but not permanent):
- a short real-working loading animation with ascii. 
- after the loading will be a wide simplebanner of a border rectangle closing on the right side this purple octopus ascii:

                ▗▄▄▄▄▄▄▖
             ▗▛████████▜▖
           ▗▛████████████▜▖
          ▐██████▛▜██████▌
          ██████████████████
          ████!██████!████
          ▜██████████████▛
       ▗▞██▛▀▘▝██▘▝▀▜██▚▖
     ▗▞██▛▘  ▗████▖  ▝▜██▚▖
    ▐██▛    ▐██████▌    ▝██▌
   ▐██▘    ▗██▛▜██▚▖     ▝██▌
    ▜▌    ▗██▘  ▝██▖      ▐▛
     ▝▚▖ ▗██▘    ▝██▖   ▗▞▘
       ▝▚▞▘        ▝▚▞▘

- a tiny vetical line in the middle siplitting.
- on the left side this rounded rectanble (with the 6xargs start information):

╭───────────────────────────────────────╮
│ >_ OpenAI Codex (v0.118.0)            │
│                                       │
│ model:     gpt-5.4   /model to change │
│ directory: ~\Documents\6xargs         │
╰───────────────────────────────────────╯
### Permanent information:
- a minimalistic status bar just with crucial infromation about the user inspiring on this one:

● maico │ ● 6xargs-cli-sdk │ ● main │ ● Sonnet 4.6 │ ● sess ██████▒▒ 78% │ ● ctx ▒▒▒▒▒▒▒▒▒▒▒▒▒ ─ │ ● Wed 06 17:21

------------------------------------------------------------------------------------

### Architecture change
Ink renders via React reconciler to stdout. Entry point must mount an Ink app:

```tsx
// src/index.ts
import { render } from "ink";
import { App } from "./app.tsx";
render(<App args={process.argv.slice(2)} />);
```

Commands become React components, not imperative functions.
Commander.js still handles arg parsing — pass parsed args to Ink render tree.

### Rules
1. All terminal output via termcn components — no raw console.log in commands.
2. Spinner on stderr, content on stdout — pipe-safe.
3. Theme: default termcn theme unless firm has custom config (Phase 2).
4. `--no-color` flag disables Ink/termcn color output globally.
5. `--json` flag bypasses Ink entirely — raw JSON to stdout, no React rendering.

## Architecture
```
CLI (TypeScript/Node)
  → HTTPS (undici)
    → Cloudflare Edge (WAF, rate limit)
      → ExpressJS API Gateway
        → FastAPI → LangGraph Agent → PGVector
```
The CLI never touches LangGraph, PGVector, or PostgreSQL directly. It is a pure API client.

## Repository Structure
```
6xargs-cli/
├── src/
│   ├── index.ts                 # entrypoint — Commander program
│   ├── commands/
│   │   ├── auth.ts              # login, logout, whoami, token
│   │   ├── ingest.ts            # upload, status, list
│   │   ├── query.ts             # ask, history, feedback
│   │   ├── engagements.ts       # list, show, delete
│   │   ├── firms.ts             # info, keys create, keys revoke
│   │   ├── config.ts            # set, get, reset, switch-profile
│   │   └── health.ts            # ping, version
│   ├── lib/
│   │   ├── client.ts            # HTTP wrapper — undici, retry, auth header injection
│   │   ├── auth.ts              # token storage, refresh, keychain
│   │   ├── config.ts            # conf wrapper, env var resolution, profiles
│   │   ├── output.ts            # table, json, yaml, raw, streaming formatters
│   │   ├── errors.ts            # error codes, friendly messages, exit codes
│   │   ├── logger.ts            # debug/verbose logging, --debug flag
│   │   └── constants.ts         # API URLs, version, user-agent string
│   └── types/
│       ├── api.ts               # request/response types (mirror backend OpenAPI)
│       └── config.ts            # config schema (zod)
├── tests/
│   ├── commands/                # integration tests per command
│   ├── lib/                     # unit tests
│   └── fixtures/                # mock responses, sample PDFs
├── tsup.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── CLAUDE.md
├── MEMORY.md
└── README.md
```

## API Endpoints (backend — already built)
```
# Auth
POST   /api/v1/auth/token                  # API key → JWT
POST   /api/v1/keys                        # create API key
DELETE /api/v1/keys/:id                     # revoke key

# Ingestion
POST   /api/v1/ingestion/upload             # multipart PDF/JSON/CSV upload
GET    /api/v1/ingestion/status/:id         # job status polling

# Query
POST   /api/v1/query                        # { query, mode: "guide"|"report" }

# Engagements
GET    /api/v1/engagements                  # list indexed engagements
DELETE /api/v1/engagements/:id              # remove from index

# Firm
GET    /api/v1/firms/:id                    # firm details

# Metrics
GET    /api/v1/metrics/engagements-indexed
GET    /api/v1/metrics/query-latency
GET    /api/v1/metrics/validation-accuracy

# System
GET    /health
```
All requests: `Authorization: Bearer <jwt>` or `X-API-Key: sk_live_6xargs_*`

## Auth Flow
```
1. User runs: 6xargs login --api-key sk_live_6xargs_abc123
2. CLI validates format: /^sk_live_6xargs_[a-zA-Z0-9]{24,}$/
3. CLI calls POST /api/v1/auth/token { api_key }
4. Backend returns { jwt, expires_at, firm: { id, name, plan } }
5. CLI stores in ~/.6xargs/config.json (chmod 0600)
6. All requests inject JWT in Authorization header
7. On 401 → silent refresh with stored API key
8. On refresh fail → prompt re-login
```

### Config file: `~/.6xargs/config.json`
```json
{
  "current_profile": "default",
  "profiles": {
    "default": {
      "api_key": "sk_live_6xargs_...",
      "jwt": "eyJ...",
      "jwt_expires_at": "2026-05-07T...",
      "api_base": "https://api.6xargs.com",
      "firm_id": "firm_abc123",
      "firm_name": "Delta Protect",
      "plan": "pro",          /*this value just can be starter, pro & enterprise*/
      "output_format": "table"
    }
  }
}
```
Config schema validated by zod on every read. Corrupt config → reset + warn.

## Command Reference

### Auth
```bash
6xargs login                                  # interactive prompt (firste any user should login via username/password and after , set the apikey all 3 mandatory(1-username,2-password,3-apikey))
6xargs login --api-key sk_live_6xargs_...     # non-interactive
6xargs logout                                 # clear credentials
6xargs whoami                                 # firm, user, plan, usage
6xargs auth token                             # print JWT (for scripting/piping)
```

### Ingest
```bash
6xargs ingest upload ./report.pdf                         # single file
6xargs ingest upload ./reports/*.pdf                      # glob
6xargs ingest upload ./report.pdf --tags fintech,ssrf     # with metadata
6xargs ingest upload ./report.pdf --wait                  # block until processed
6xargs ingest status <job-id>                             # poll status
6xargs ingest list                                        # recent jobs
6xargs ingest list --status pending|completed|failed      # filter
```
Upload: multipart/form-data via undici. Max 50MB. Types: PDF, JSON, CSV.
`--wait` polls `/ingestion/status/:id` every 2s until terminal state.

### Query (evaluate if is better to use natural language so que queries or requests could call direct via api-key connected with components on this route C:\Users\maico\Documents\6xargs\apps\sixpi the cli is in in another and diferent github repository, so this will call externally i think but im not sure if is a good practice and possible)
```bash
6xargs ask "SSRF patterns in fintech Node.js stacks"     # guide mode (default)
6xargs ask "SSRF patterns" --mode report                  # report mode
6xargs ask "SSRF patterns" --json                         # JSON output
6xargs ask "SSRF patterns" --stream                       # SSE streaming
6xargs query history                                      # recent queries
6xargs query feedback <id> --useful                       # positive feedback
6xargs query feedback <id> --not-useful --reason "stale"  # negative
```
`ask` is the primary command — aliased at top level for speed.

### Engagements
```bash
6xargs engagements list                       # table output
6xargs engagements list --json                # JSON
6xargs engagements show <id>                  # detail view
6xargs engagements delete <id>                # confirm prompt
6xargs engagements delete <id> --force        # skip confirm
```

### Firm & Keys
```bash
6xargs firm info                              # firm details + plan + usage
6xargs firm keys list                         # API keys
6xargs firm keys create --name "CI pipeline"  # new key
6xargs firm keys revoke <id>                  # revoke
```

### Config
```bash
6xargs config set output_format json          # default output format
6xargs config set api_base https://...        # custom API base
6xargs config get output_format               # read single value
6xargs config list                            # all config
6xargs config reset                           # factory reset
6xargs config switch-profile staging          # named profiles
```

### System
```bash
6xargs health                                 # API ping + latency
6xargs version                                # CLI + API versions
6xargs --help                                 # global help
6xargs <command> --help                       # per-command help
6xargs status                                 # Usage,pricing,plan,account,limits
```

## Global Flags
```
--json            Force JSON output
--format <fmt>    Output: table|json|yaml|raw (default: table)
--debug           Show HTTP requests/responses, timing
--no-color        Disable chalk colors
--profile <name>  Use named profile
--api-base <url>  Override API base URL
--quiet           Suppress non-essential output
```

## HTTP Client (lib/client.ts)
```typescript
// Core contract — every API call goes through this
async function request<T>(method: string, path: string, opts?: {
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  stream?: boolean;
  timeout?: number;
}): Promise<ApiResponse<T>>
```
- Inject `Authorization`, `User-Agent: 6xargs-cli/<version>`, `X-Request-ID: <ulid>`
- Retry: 3 attempts on 5xx/network error, exponential backoff (1s, 2s, 4s)
- No retry on 4xx (client errors are deterministic)
- Timeout: 30s default, 120s for upload, 60s for query
- On 429: parse `Retry-After`, wait, retry once
- On 401: attempt token refresh, retry once
- `--debug` logs full request/response cycle to stderr

## Error Handling
| Exit Code | Meaning |
|---|---|
| 0 | Success |
| 1 | User error (bad input, missing args) |
| 2 | API error (5xx, network, timeout) |
| 3 | Auth error (invalid key, expired, revoked) |
| 130 | SIGINT (Ctrl+C) |

Every error prints: one-line description + suggested fix. No stack traces unless `--debug`.
```
Error: API key format invalid. Expected: sk_live_6xargs_<24+ chars>
  Run: 6xargs login --api-key <your-key>
```

## Output Formatting (lib/output.ts)
- **table**: aligned columns via string padding (no deps). Default for list commands.
- **json**: `JSON.stringify(data, null, 2)` to stdout. Pipe-friendly.
- **yaml**: minimal serializer (no deps). For config export.
- **raw**: unformatted API response body. For scripting.
- **stream**: line-by-line SSE parsing for `ask --stream`.
Spinner (ora) on stderr so stdout stays pipe-clean.

## Security Rules
1. API key stored in `~/.6xargs/config.json` with `chmod 0600`.
2. Never log API keys or JWT tokens, even in `--debug` mode. Mask: `sk_live_6xargs_...abc1`.
3. Never send API key in URL params — header only.
4. Validate all API responses with zod before trusting structure.
5. Validate file paths: no traversal (`..`), no symlinks outside cwd for uploads.
6. TLS only — reject non-HTTPS `api_base` (allow `http://localhost` for dev).
7. Clear credentials from memory after use (overwrite strings where possible).
8. `--api-key` flag value: mask in process title / ps output if platform supports.

## Testing Strategy
```bash
pnpm test              # vitest — unit + integration
pnpm test:unit         # lib/ only
pnpm test:integration  # commands/ with mock HTTP server
pnpm test:e2e          # real API (CI only, requires SIXARGS_TEST_KEY)
```
- Mock HTTP via msw (Mock Service Worker) — intercept undici requests.
- Fixtures in `tests/fixtures/` — sample API responses, sample PDFs.
- Coverage target: 80%+ on lib/, 60%+ on commands/.
- CI: lint → typecheck → test:unit → test:integration → build → smoke test binary.

## Build & Distribution
```bash
pnpm build             # tsup → dist/index.cjs (single bundle)
pnpm build:binary      # pkg → standalone binaries (linux, macos, windows)
```
- **npm**: `npx @6xargs/cli` or `npm i -g @6xargs/cli` → `6xargs` global command
- **Binary**: GitHub Releases — signed, checksummed, per-platform
- **Homebrew**: `brew install 6xargs/tap/6xargs` (Phase 2)
- `bin` field in package.json points to `dist/index.cjs`
- Shebang: `#!/usr/bin/env node`

## package.json (key fields)
```json
{
  "name": "@6xargs/cli",
  "version": "0.1.0",
  "bin": { "6xargs": "./dist/index.cjs" },
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

## .env.example
```bash
SIXARGS_API_KEY=sk_live_6xargs_...         # default API key (overrides config file)
SIXARGS_API_BASE=https://api.6xargs.com    # API base URL
SIXARGS_PROFILE=default                     # named profile
SIXARGS_OUTPUT_FORMAT=table                 # table|json|yaml|raw
SIXARGS_DEBUG=false                         # enable debug logging
SIXARGS_NO_COLOR=false                      # disable colors
```
Env vars take precedence over config file. Config file takes precedence over defaults.

## Implementation Order
```
Phase 1 — Skeleton (day 1)
  src/index.ts + Commander setup + global flags
  lib/config.ts + lib/constants.ts + lib/errors.ts
  commands/health.ts (simplest — validates full chain)
  tsup + vitest config
  CI pipeline

Phase 2 — Auth (day 2)
  lib/auth.ts + lib/client.ts
  commands/auth.ts (login, logout, whoami, token)
  Token refresh logic
  Config profiles

Phase 3 — Core (days 3-5)
  commands/ingest.ts (upload + status + list)
  commands/query.ts (ask + history + feedback)
  lib/output.ts (all formatters)
  Streaming SSE support

Phase 4 — Management (day 6)
  commands/engagements.ts
  commands/firms.ts
  commands/config.ts

Phase 5 — Polish (day 7)
  README.md with examples
  Binary builds (pkg)
  npm publish dry run
  E2E smoke tests
```

## Do Not Build
- Interactive REPL / shell mode (just use `ask` repeatedly)
- Local caching of query results
- Offline mode
- Plugin system
- Auto-update daemon
- GUI / TUI dashboard
- WebSocket connections (REST only)
- Local PDF processing (server handles everything)

## MEMORY.md Protocol
After every major change, append to MEMORY.md:
```
## [timestamp] — [component]
[max 50 words technical summary]
```
This file is the session bridge between coding agents (Claude Code, Cursor, etc).

------------------------------------------------------------------------------------

# Aditional & important:documentation

## **Success Metrics**

- **Developer Onboarding**: < 15 minutes from signup to first engagement indexed
- **Integration Time**: < 50min to integrate into existing pentest workflow
- **Proof of Value**: First query returns relevant past findings within seconds of indexing

## **Focus Areas (6xargs-cli Works only with a generated api-key and login (some could be redundant, so ignore ones))**

- **Ingestion Pipeline**: Upload engagement PDF → entity extraction → vectorDB semantic index
- **Real-Time Query**: Natural language query during active engagement → structured context from past findings
- **Isolated Per Firm**: Zero cross-tenant data — each firm's index is completely separate
- **Web2 + Web3**: Traditional web app findings + smart contract audit context
- **Feedback Loop**: Useful/not-useful signals per query result improve index relevance over time
- **Simple Integration**: One JavaScript SDK, CLI tool, clear examples for offensive security workflows

# **GUI UX/UI Design**
1. Use Redocly for API documentation - structure 
2. The API documentation pages will keep the same aspect-visuals and UI/UX from the api-dashboard
3. Use this resources for api docs structure:
    - https://redocly.com/docs
    - https://redocly.com/docs/cli
    - https://redocly.com/docs/redoc
    - https://redocly.com/api-governance
    - https://github.com/Redocly
## Use this just for visuals (frontend/UX/UI):
    - https://v0.app/templates/macos-widget-OlsQjQB6IO3
    - https://v0.app/templates/gokul-s-terminal-simpl-portfolio-OZv9LLI5mkR
    - https://reactbits.dev/components/carousel
    - https://kokonutui.com/docs/components/file-upload
    - https://kokonutui.com/docs/components/bento-grid
    - https://ui.shadcn.com/docs/components/accordion
    - https://www.prompt-kit.com/docs/tool
    - https://v0.app/templates/gokul-s-terminal-simpl-portfolio-OZv9LLI5mkR
    - https://kokonutui.com/docs/components/file-upload
    - https://www.prompt-kit.com/docs/tool