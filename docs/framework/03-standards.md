# 03 — Company standards

Part A is Antonio's list (2026-10-17), wording preserved, non-exhaustive. Part B maps each item
to what STYNX already enforces today (verified against STYNX `main` @ `63e5f788`, see
`03b-stynx-extraction.md`). Part C is the orchestrator's notes.

Tags: **rail** = satisfied by construction (scaffold/generator/helper emits it right);
**check** = verified locally by a deterministic tool; **both** = rail emits it, check guards it.

## Part A — the standards (author's words)

All our applications are webapp stack. Always:

### Platform
| # | Standard | Tag |
|---|---|---|
| S-01 | Backend database is PostgreSQL | rail |
| S-02 | Multi-tenancy and RLS are mandatory | both |
| S-03 | Backend REST API is NestJS | rail |
| S-04 | Angular on web frontends | rail |
| S-05 | AWS as sole cloud provider | rail |
| S-06 | Monorepo: db, api and backend services, frontends web and mobile, infra, CI/CD in the same git repo | rail |
| S-07 | PNPM, Corepack | both |
| S-08 | Docker-aware, not mandatory: local CI, checks, dev env and remote CI must be configurable to use Docker OR stay bare on localhost. **D-011**: stated as a declared contract where agents read it | both |

### Security and access
| # | Standard | Tag |
|---|---|---|
| S-10 | Authentication is OAuth2 | rail |
| S-11 | Authorization is RBAC | both |
| S-12 | Protected routes use Authorization bearer header + JWT; the token carries user permissions, checked on each request with no SQL query. **D-009**: pattern guideline; verified by a narrow agentic check over the permission-checking slice, no runtime enforcement | rail + agentic check |
| S-13 | Sessions backed by PostgreSQL tables | rail |

### API and data access
| # | Standard | Tag |
|---|---|---|
| S-20 | Fully OpenAPI / Swagger | both |
| S-21 | Raw SQL queries must share location and be as type-enforced as possible. **D-010**: every raw query type-safe/type-enforced, arguments checked and validated against known limits and schemas | both |
| S-22 | OpenAPI coverage and contract checks | check |
| S-23 | Public-API baselines | check |
| S-24 | Migration linter | check |

### Language and compiler
| # | Standard | Tag |
|---|---|---|
| S-30 | TypeScript is strongly preferred | rail |
| S-31 | Target recent ESM. **D-012 (Owner)**: v3 enforces **ESM only** | both |
| S-32 | Compiler strictness (`tools/tsconfig/base.json`, enforced): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `forceConsistentCasingInFileNames`, target ES2022 | both |
| S-33 | No `any`, avoid `unknown` types. **D-013 (Owner)**: `no-explicit-any` and all `no-unsafe-*` at `error` from day 0 | check |
| S-34 | No deep imports | check |
| S-35 | `no-unused-vars` | check |

### Code hygiene
| # | Standard | Tag |
|---|---|---|
| S-40 | Semantic versions (semver) and semantic commits must be adopted | both |
| S-41 | Accepted code must pass through Prettier and comply with lint patterns | check |
| S-42 | knip (dead code), depcheck, `madge --circular` | check |
| S-43 | actionlint | check |
| S-44 | `verify-stynx-boundary.ts` | check |

### Angular
| # | Standard | Tag |
|---|---|---|
| S-50 | `prefer-standalone`, `prefer-inject`, `prefer-on-push-component-change-detection`, `consistent-type-imports`, component class suffix, no input/output renames or `on` prefixes | both |
| S-51 | Templates require `@if/@for` control flow (`prefer-control-flow`), `eqeqeq`, no banana-in-box | check |

### Tests
| # | Standard | Tag |
|---|---|---|
| S-60 | Test lint (`tools/eslint-config/test.mjs`, rule family "CW-1"): bans bare `.toHaveBeenCalled()` and existence-only assertions (`toBeTruthy`, `toBeDefined`, `toBeNull`, …) because they survive mutations; bans relative `../../*/src` imports across packages | check |


### Adopted 2026-10-17 (D-014)
| # | Standard | Tag |
|---|---|---|
| S-14 | Postgres is the only async infrastructure: outbox, jobs, notifications via `FOR UPDATE SKIP LOCKED`; no SQS, no BullMQ | rail |
| S-15 | LGPD: every PII column declares legal basis and retention policy. **Opt-in at project bootstrap** | both |
| S-16 | i18n / multi-language / multi-locale is mandatory. Default language **en-US**; **pt-BR opted in at project bootstrap** | both |
| S-25 | Every write route declares idempotency (`@Idempotent()`/`@NoIdempotent()`), role binding, error contract, use-case claim and SLO; a coverage check verifies every route carries them | both |
| S-36 | Naming: no `enum` (string-literal unions / `as const`); named exports only; `<product>` prefix on public modules, services, components and DI tokens; kebab-case files with role suffix | check |
| S-70 | Request ID is UUIDv7 and required on every request, except a `GET`/`HEAD` liveness or readiness probe (`/healthz`, `/readyz`) that sends none (D-072) | both |

### Added 2026-10-18 — O-003 closed (D-049)

Numbers allocated once from the free ranges; rationale in `02-architecture.md` §12 and the sections
each row cites; mapping from both cross-reviews in `agents/consolidate-1/NOTES.md` §3.

| # | Standard | Tag | Enforced by |
|---|---|---|---|
| S-17 | One GUC namespace for request context (`app.tenant_id`, `app.actor_id`, `app.role`, `app.request_id`, `app.session_id`); RLS policies reference only it (03b §3 gap §12.3) | both | `sql-lint` LINT011, `db-apply` |
| S-18 | Three DB roles per product (`<product>_owner` BYPASSRLS for migrations, `_app`, `_reader`); app code never connects as owner; isolation tests never run as owner [fact: `expectRLSIsolated` throws only on a leak, `stynx:packages/testing/src/matchers.ts:38-44`, so it is vacuous under BYPASSRLS] | rail + check | `db-apply`, `integration`, generator |
| S-19 | STYNX tooling is consumed as published versioned ESM packages; v3 never vendors or re-expresses it; missing tooling is `UNKNOWN` (D-029) | rail | preflight |
| S-26 | Every external input (body, query, params, headers used by logic) is validated at the boundary with zod `parseDto` or a typed pipe; interface-typed handlers are a finding (03b §3 gap §12.1) | check | `route-contract` |
| S-27 | Every `defineQuery` declares argument limits ≤ the bound column's constraints, verified against the applied schema; rows are validated at runtime always (D-010) | both | `sql-typed`, `run` |
| S-28 | S-25 contract fields are decorators in code (`@Idempotent\|@NoIdempotent`, `@Permission`/`@RequireRoles`, `@ErrorContract`, `@UseCase`, `@Slo`); sidecar JSON forms are not declarations (D-016) | both | `route-contract` |
| S-29 | SLO **measurement** runs in the release lane only (D-038); packet acceptance verifies the `@Slo` declaration (D-005) | check | `route-contract`; release lane, outside the DAG |
| S-37 | Package layer direction is deny-by-default with an explicit allow list (03b §3 gap §12.5) | check | `lint` overlay |
| S-38 | "Named exports only" (S-36) applies to `src/**` and `test/**`; tool-mandated config entry points (`eslint.config.*`, `vitest.config.*`, `playwright.config.*`) follow the tool's contract; shared packages expose named factories only [fact: `stynx:tools/eslint-config/nest.mjs:2` default-exports because ESLint flat config requires it at the entry point] | check | `lint` |
| S-45 | Files with a `@generated` header are committed and byte-verified against the pinned generator and recorded inputs; a hand edit fails; seeds are excluded (D-015 held item, narrowed; INV-CLI-002) | check | `generated` |
| S-46 | A generator release passes the full option matrix in both runtimes and the negative-fixture matrix (removed validation / RLS / decorators / tests each fail the expected node) (03b §3) | both | generator suite invoking the full DAG |
| S-61 | Coverage = acceptance requirements covered (`expected` vs `observed` in `spec-tests`); no universal percentage; per-package thresholds only by declaration if a case appears (D-036) | check | `spec-tests` |
| S-62 | Test tiers are 04-layout §4's suffixes (unit, acceptance, integration, db, e2e); no wiring tier; every enabled tier glob matches ≥ 1 file (D-015 held item) | check | `layout`, `inventory` |
| S-63 | Spec-derived acceptance tests live in `domain/<m>/api/test/acceptance/*.acceptance.spec.ts`, derived from the frozen spec before the implementation exists or in a sparse worktree without it (D-035), protected; a change needs `// @acceptance-change: approved-by=` (D-022, D-016) | both | `test-integrity`, `spec-tests`, `protected-paths` |
| S-64 | No literal verdicts in tests or gates; no `.skip/.only/.todo` without an issue reference; required tests cannot disappear, be focused away or weakened without a verified contract-consistent correction; an annotation explains, it does not exempt (03b §3 gap §12.7) | check | `test-integrity`, `review` |
| S-65 | Every check reports `expected`/`observed`/`evaluated`; zero observations is `UNKNOWN`; `observed < expected` against a complete inventory is `FAIL`; never `PASS` on empty (v2's zero-file PASS made a rule) | harness | runner, `accept` |
| S-66 | Independent review by a model of a different family than the worker is a DAG node, executed pre-push on the pilot's machine and digest-verified in CI; equal, unknown or unconfigured family is `UNKNOWN` (D-003, D-028, D-037) | check | `review` |
| S-67 | Expected-red applies only to named unimplemented observations after collection, imports, start-up and DB setup succeed; each must reach its behavioural assertion; rail-provided behaviour stays green (D-004: liveness, not mutation testing) | check | `spec-tests --expect-red` |
| S-71 | Logging is pino with redaction; metrics are `prom-client`; no standard *against* OpenTelemetry (D-015 held item) | rail | template |

Amendments to existing rows, no new number (D-043, D-045): **S-24** gains LINT010–013 (§2). **S-31** is enforced by
`inventory`, `lint` and `typecheck` (§2). **S-70** by `route-contract` and `integration`. **S-40**
gains the changeset-vs-baseline check in `openapi`. **L-01** is not a standard: root `specs/`,
`packets/` and `decisions.md` are D-027 and D-031, which already amend 04-layout §1.

D-015 dispositions, as decided: byte-verification adopted narrowly (S-45); 100 % coverage rejected in
favour of S-61 (D-036); taxonomy is the layout's suffixes with no wiring tier (S-62); pino +
`prom-client` as the template default with no OpenTelemetry ban (S-71).

What v3 does not do and the author's open questions are 02 §13 and 02 §14; they are not
repeated here (D-073).

Amendments without a new number (D-043, D-045): **S-24** gains LINT010 (unique prefix), LINT011
(`app.*` GUC only), LINT012 (`@pii` annotation), LINT013 (applied migrations immutable). **S-31**
enforced by `inventory`, `lint`, `typecheck`. **S-70** by `route-contract`, `integration`. **S-40**
gains the changeset-vs-baseline check in `openapi`.

### Held (D-015) — disposed 2026-10-18 (D-049)
| Candidate | Note | Disposition |
|---|---|---|
| Byte-verified generated artifacts, `:write` / `--check` pairs | STYNX practice; cheap and exact | **Adopted, narrowed** → S-45 (`@generated` header files only; seeds excluded) |
| 100% coverage default, relaxed per package by declaration | STYNX `tools/repo-config/test-policy.json` | **Rejected** (D-036) → S-61 coverage = requirements covered |
| Test taxonomy unit / wiring / integration / db / e2e | STYNX ADR-TEST-TAXONOMY | **Adopted as layout suffixes, no wiring tier** → S-62 |
| pino + Prometheus, no OpenTelemetry | STYNX practice; layout report gap 14 | **Adopted as template default; no OTel ban** → S-71 |

## Part B — what STYNX enforces today, per standard

Status: **E** enforced by a failing tool · **D** documented only · **O** observed in code, not
guarded · **—** not present. Source: STYNX report §4, §8, §9, §12, verified 2026-10-17.

| # | STYNX mechanism today | Status | Gap to close in v3 |
|---|---|---|---|
| S-01 | `pg` + Drizzle; raw-pg import banned outside `data`/`cli` (lint) | E | — |
| S-02 | `ENABLE`+`FORCE RLS` idiom (43 sites); LINT001 requires RLS+policy in same migration; `expectRLSIsolated` test helper; INV-TENANCY-001 | E | Root `database/ddl` uses a different GUC dialect (`auth.*`/`stynx.*`) than runtime (`app.*`): policies there never see runtime context |
| S-03 | NestJS 11 as peer dep everywhere | O | No rule forbids another HTTP framework; acceptable as rail |
| S-04 | Angular 22, `angular-eslint` | O/E | — |
| S-05 | AWS SDK v3; S3 import restricted to `storage` (lint) | E (partial) | Only S3 is fenced |
| S-06 | pnpm + Turborepo monorepo | O | — |
| S-07 | `pnpm@9.15.0` via Corepack, `check:engines` | E | — |
| S-08 | testcontainers for int tests; `ci-local` tool | O | "Docker OR bare" is not a documented switch; needs a v3 contract |
| S-10 | Cognito + `angular-auth-oidc-client`; `jose` | O | No check that a route is OAuth2-protected except via RBAC binding |
| S-11 | INV-RBAC-001: every route role-bound or explicitly public; `api:coverage` | E | — |
| S-12 | JWT via `jose`; **permissions are NOT in the token**: `StynxAuthGuard` → `PermissionCache` (memory → Redis → SQL) per request | **gap** (corrected 2026-10-18; was wrongly "O") | STYNX auth is a migration item (D-025); the S-12 agentic sensor FAILs the current guard |
| S-13 | `@stynx-nyx/sessions` on PG | O | — |
| S-20 | OpenAPI derived from source; `api:coverage`; contract checks; generated SDK committed and byte-verified | E | SDK generator (`openapi-typescript-codegen`) is deprecated and unmaintained upstream (not archived; D-057) |
| S-21 | `$n` parameters only; raw pg only in `data`/`cli` | E (location) / O (typing) | "as type-enforced as possible" has no mechanism; ~517 `.query(` sites vs ~128 builder calls |
| S-22 | `api:coverage`, contract baselines | E | — |
| S-23 | Public-API baselines, byte-identical regeneration gate | E | — |
| S-24 | `tools/migration-linter` (libpg_query), LINT001–009 | E | Duplicate migration prefixes `0012`×2, `0018`×4 pass the linter |
| S-30 | TS 6 everywhere; `.mjs` for scripts | O | — |
| S-31 | Backend emits **CommonJS** via `tsc`; Angular APF/FESM2022; scripts ESM | **gap** | S-31 says "recent ESM"; backend is CJS today. Decision needed (see Part C) |
| S-32 | `tools/tsconfig/base.json` chain | E | Profile named `angular18` serves Angular 22 (cosmetic) |
| S-33 | **`no-explicit-any: off`, all `no-unsafe-*` off** | **—** | Code is `any`-free in practice but nothing stops regression. v3 turns these on |
| S-34 | Deep-import ban `@stynx-nyx/<pkg>/<anything>`; `boundaries` blocks `internal/**` | E | Layer *direction* declared but `default: 'allow'`: upward imports pass |
| S-35 | `no-unused-vars` with `_` escape | E | — |
| S-40 | commitlint (Conventional Commits, package scope); Changesets fixed group of 44 | E | — |
| S-41 | Prettier (width 100, single quotes, trailing commas); lint-staged `--max-warnings=0` | E (staged) | `pnpm lint` does not use `--max-warnings=0`, so warn-level rules (e.g. idempotent-route) never fail CI |
| S-42 | knip, depcheck, madge | E | — |
| S-43 | actionlint | E | — |
| S-44 | `scripts/verify-stynx-boundary.ts` | E | — |
| S-50 | Pinned by hand in `tools/eslint-config/angular.mjs` | E | Code still uses `@Input/@Output`+`EventEmitter`, class-based interceptors, `APP_INITIALIZER`, zone.js: lint does not require signal `input()/output()` |
| S-51 | Template rules | E | Demo module (`domain/demo-bookmark/web`) does not load the Angular config: `*ngIf` and `bookmark-*` selectors slip through. **The generated exemplar violates the standards.** |
| S-60 | `tools/eslint-config/test.mjs` CW-1 | E | — |

## Part C — orchestrator's notes

- **The standards already have a home.** 22 of 33 items are enforced by STYNX tooling today. v3's
  harness should *invoke* `tools/eslint-config`, `tools/tsconfig`, `tools/migration-linter` and
  the repo scripts, not re-express them. The v3 contribution is (a) the missing checks, (b) making
  warn-level rules fail, (c) a scaffolder whose output passes all of them on first emit.
- **Three standards needed a mechanism; Owner settled them 2026-10-17**: S-12 → narrow agentic
  check (D-009); S-21 → typed queries with validated arguments, mechanism in `02-architecture.md`
  (D-010); S-08 → declared contract in agent-readable guidance (D-011).
- **S-31 settled (D-012)**: ESM only. STYNX's CJS backend output becomes a STYNX migration item.
- **S-33 settled (D-013)**: on from day 0. Expect it to surface whatever "nearly any-free" hides.
- **Every `check`-tagged item is a node in v3's local check DAG; every `rail` item is a
  constraint on the scaffolder.** S-12 is the only item no lint can guard; D-009 rules out runtime
  enforcement and guards it with a narrow agentic check, the `permissions-pattern` sensor (02 §4).
- **S-60's rationale ("survive mutations") is the only place mutation testing appears**, and it
  appears as a design principle for assertions. Consistent with D-004: mutation testing informs
  how tests are written; it does not run in the cycle.
