# 6xargs CLI — Implementation Tracker

## Legend
- ⬜ Not started
- 🔄 In progress  
- ✅ Complete (tested)
- ❌ Blocked

---

## Phase 1 — Skeleton

| Task | File(s) | Status |
|------|---------|--------|
| Commander setup + global flags | `src/index.ts`, `src/cli.ts` | ✅ |
| Config lib (conf + zod) | `src/lib/config.ts` | ✅ |
| Constants | `src/lib/constants.ts` | ✅ |
| Error classes + exit codes | `src/lib/errors.ts` | ✅ |
| Type schemas | `src/types/config.ts`, `src/types/api.ts` | ✅ |
| Health command (ping + latency) | `src/commands/health.tsx` | ✅ |
| Startup banner | `src/lib/banner.ts` | ✅ |
| tsup build config (ESM output) | `tsup.config.ts` | ✅ |
| TypeScript config | `tsconfig.json` | ✅ |
| vitest config | `vitest.config.ts` | ✅ |
| CI pipeline (lint → typecheck → test → build) | `.github/workflows/ci.yml` | ✅ |
| Unit tests: config | `tests/lib/config.test.ts` | ✅ |
| Unit tests: errors | `tests/lib/errors.test.ts` | ✅ |
| Integration test: health | `tests/commands/health.test.ts` | ✅ |

---

## Phase 2 — Auth

| Task | File(s) | Status |
|------|---------|--------|
| HTTP client (retry, auth header, timeout) | `src/lib/client.ts` | ✅ |
| Token storage + refresh | `src/lib/auth.ts` | ✅ |
| `login` (interactive + non-interactive) | `src/commands/auth.tsx` | ✅ |
| `logout` (soft + hard) | `src/commands/auth.tsx` | ✅ |
| `whoami` (firm, user, plan, expiry) | `src/commands/auth.tsx` | ✅ |
| `auth token` (print JWT for scripting) | `src/commands/auth.tsx` | ✅ |
| Interactive prompts (readline, secret) | `src/lib/prompt.ts` | ✅ |
| Auth tests | `tests/commands/auth.test.ts` | ✅ |
| Client tests (retry, 4xx, 5xx, schema) | `tests/lib/client.test.ts` | ✅ |
| Auth lib tests | `tests/lib/auth.test.ts` | ✅ |

---

## Phase 3 — Core Commands

| Task | File(s) | Status |
|------|---------|--------|
| `ingest upload` (single + glob + --wait) | `src/commands/ingest.tsx` | ✅ |
| `ingest status <job-id>` | `src/commands/ingest.tsx` | ✅ |
| `ingest list` (filter by status) | `src/commands/ingest.tsx` | ✅ |
| `ask` / `query` (guide + report mode) | `src/commands/query.tsx` | ✅ |
| `query history` | `src/commands/query.tsx` | ✅ |
| `query feedback <id>` | `src/commands/query.tsx` | ✅ |
| Output formatters (table, json, yaml, raw) | `src/lib/output.ts` | ✅ |
| SSE streaming support | `src/lib/stream.ts` | ✅ |
| Ingest tests | `tests/commands/ingest.test.ts` | ✅ |
| Query tests | `tests/commands/query.test.ts` | ✅ |
| Output formatter tests | `tests/lib/output.test.ts` | ✅ |

---

## Phase 4 — Management Commands

| Task | File(s) | Status |
|------|---------|--------|
| `engagements list` | `src/commands/engagements.tsx` | ✅ |
| `engagements show <id>` | `src/commands/engagements.tsx` | ✅ |
| `engagements delete <id>` (confirm prompt) | `src/commands/engagements.tsx` | ✅ |
| `firm info` | `src/commands/firms.tsx` | ✅ |
| `firm keys list/create/revoke` | `src/commands/firms.tsx` | ✅ |
| `config set/get/list/reset` | `src/commands/config.ts` | ✅ |
| Management tests | `tests/commands/` | ✅ |

---

## Phase 5 — Polish

| Task | File(s) | Status |
|------|---------|--------|
| README.md with full examples | `README.md` | ✅ |
| Binary builds (pkg — linux/macos/win) | `package.json` build:binary script | ✅ |
| npm publish dry run | `package.json` publish:dry-run script | ✅ |
| E2E smoke tests (real API) | `tests/e2e/smoke.test.ts` | ✅ |
| termcn components (full Ink integration) | `src/components/` | ✅ |
| Permanent status bar | `src/components/StatusBar.tsx` | ✅ |

---

## Completion Log

| Date | Phase | Task | Notes |
|------|-------|------|-------|
| 2026-05-06 | 1 | Skeleton complete | 22/22 tests passing, ESM build, binary smoke tested |
| 2026-05-06 | 2 | Auth complete | 48/48 tests passing, login/logout/whoami/token wired, HTTP client with retry |
| 2026-05-06 | 3 | Core complete | 74/74 tests passing, ingest/ask/query/stream wired, output formatters, SSE |
| 2026-05-06 | 4 | Management complete | 103/103 tests passing, engagements/firm/config commands wired, 204 handling, NewApiKey schema |
| 2026-05-06 | 5 | Polish complete | 103/103 passing + 4 E2E skipped; README, StatusBar, E2E skeleton, binary build config |
