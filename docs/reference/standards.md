---
title: Standards
sidebar_position: 10
description: The 56 company standards of 03 Part A, one line each, with their tag and the check nodes whose contracts cite them.
---

# Standards

The company standards are the table in [03 Part A](../framework/03-standards.md), which [D-049](../../decisions.md) made final. There are **56 standards**, numbered from S-01 to S-71 with gaps (numbers are allocated from free ranges and never reused). The wording below is shortened to one line; 03 Part A is the text.

**Tags** ([03](../framework/03-standards.md)): **rail** = satisfied by construction (the template, generator or helper emits it right); **check** = verified by a deterministic tool; **both** = the rail emits it and a check guards it. S-12 is "rail + agentic check", S-18 "rail + check", S-65 "harness".

**Checked by** lists the nodes whose [08 Part B](../framework/08-cli-and-nodes.md) Standards row cites the id. "—" means no node row cites it; the standard is met by the rail, the template, preflight or the release lane, as the Notes column says.

| # | Standard (shortened) | Tag | Checked by (08 Part B) | Notes |
|---|---|---|---|---|
| S-01 | Backend database is PostgreSQL | rail | `lint`, `db-apply` | |
| S-02 | Multi-tenancy and RLS are mandatory | both | `sql-lint`, `db-apply`, `integration` | |
| S-03 | Backend REST API is NestJS | rail | — | template |
| S-04 | Angular on web frontends | rail | — | template |
| S-05 | AWS as sole cloud provider | rail | `lint` | |
| S-06 | Monorepo: db, api, services, web and mobile frontends, infra, CI/CD in one git repo | rail | `inventory` | |
| S-07 | PNPM, Corepack | both | `inventory` | |
| S-08 | Docker-aware, not mandatory: every check runnable in Docker or bare, as a declared contract | both | — | [D-011](../../decisions.md); `devai.json` `runtime` |
| S-10 | Authentication is OAuth2 | rail | `route-contract` | |
| S-11 | Authorization is RBAC | both | `route-contract` | |
| S-12 | Protected routes use bearer JWT carrying permissions, checked per request with no SQL query | rail + agentic check | `permissions-pattern` | [D-009](../../decisions.md), [D-025](../../decisions.md) |
| S-13 | Sessions backed by PostgreSQL tables | rail | `db-apply` | |
| S-14 | Postgres is the only async infrastructure (`FOR UPDATE SKIP LOCKED`); no SQS, no BullMQ | rail | — | [D-014](../../decisions.md) |
| S-15 | LGPD: every PII column declares legal basis and retention; opt-in at bootstrap | both | `sql-lint` | [D-014](../../decisions.md); `lgpd`, LINT012 |
| S-16 | i18n is mandatory; default `en-US`; `pt-BR` opted in at bootstrap | both | `i18n` | [D-014](../../decisions.md) |
| S-17 | One GUC namespace for request context (`app.*`); RLS policies reference only it | both | `sql-lint`, `db-apply` | LINT011 |
| S-18 | Three DB roles per product (`_owner`, `_app`, `_reader`); app code and isolation tests never run as owner | rail + check | `db-apply`, `integration` | |
| S-19 | STYNX tooling is consumed as published versioned ESM packages; missing tooling is `UNKNOWN` | rail | — | preflight; [D-029](../../decisions.md) |
| S-20 | Fully OpenAPI / Swagger | both | `route-contract`, `openapi` | |
| S-21 | Raw SQL shares one location and is type-enforced; arguments validated against known limits | both | `sql-typed` | [D-010](../../decisions.md) |
| S-22 | OpenAPI coverage and contract checks | check | `route-contract`, `openapi` | |
| S-23 | Public-API baselines | check | `openapi` | |
| S-24 | Migration linter (LINT001–013) | check | `sql-lint` | LINT010–013 added by [D-043](../../decisions.md) |
| S-25 | Every write route declares idempotency, role binding, error contract, use-case claim and SLO | both | `lint`, `spec-lint`, `route-contract` | [D-014](../../decisions.md) |
| S-26 | Every external input is validated at the boundary with zod `parseDto` or a typed pipe | check | `route-contract` | |
| S-27 | Every `defineQuery` declares argument limits ≤ the bound column's constraints; rows validated at runtime | both | `sql-typed` | also `run` |
| S-28 | S-25 contract fields are decorators in code; sidecar JSON is not a declaration | both | `route-contract` | [D-016](../../decisions.md) |
| S-29 | SLO measurement runs in the release lane only; acceptance verifies the `@Slo` declaration | check | — | `route-contract` per 03; release lane ([D-038](../../decisions.md)) |
| S-30 | TypeScript is strongly preferred | rail | `typecheck` | |
| S-31 | ESM only | both | `inventory`, `lint`, `typecheck` | [D-012](../../decisions.md), [D-045](../../decisions.md) |
| S-32 | Compiler strictness: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `forceConsistentCasingInFileNames`, ES2022 | both | `typecheck` | also `inventory` status |
| S-33 | No `any`, avoid `unknown`; `no-explicit-any` and all `no-unsafe-*` at `error` | check | `lint`, `typecheck` | [D-013](../../decisions.md) |
| S-34 | No deep imports | check | `lint`, `boundary` | |
| S-35 | `no-unused-vars` | check | `lint` | |
| S-36 | Naming: no `enum`; named exports only; `<product>` prefix; kebab-case files with role suffix | check | `lint` | [D-014](../../decisions.md), [D-032](../../decisions.md) |
| S-37 | Package layer direction is deny-by-default with an explicit allow list | check | `lint` | overlay |
| S-38 | Named exports only in `src/**` and `test/**`; tool-mandated config entry points follow the tool | check | `lint` | |
| S-40 | Semantic versions (semver) and semantic commits | both | `commitlint`, `openapi` | changeset-vs-baseline in `openapi` |
| S-41 | Accepted code passes Prettier and lint | check | `format`, `lint` | |
| S-42 | knip, depcheck, `madge --circular` | check | `deadcode` | |
| S-43 | actionlint | check | `actionlint` | |
| S-44 | `verify-stynx-boundary.ts` | check | `boundary` | |
| S-45 | `@generated` files are committed and byte-verified against the pinned generator; seeds excluded | check | `generated` | |
| S-46 | A generator release passes the full option matrix in both runtimes and the negative-fixture matrix | both | — | generator suite |
| S-50 | Angular: `prefer-standalone`, `prefer-inject`, OnPush, `consistent-type-imports`, class suffix, no input/output renames or `on` prefixes | both | `lint` | |
| S-51 | Templates: `@if/@for` control flow, `eqeqeq`, no banana-in-box | check | `lint` | |
| S-60 | Test lint CW-1: no bare `.toHaveBeenCalled()` or existence-only assertions; no cross-package `../../*/src` imports | check | `lint-tests` | |
| S-61 | Coverage = acceptance requirements covered; no universal percentage | check | `spec-tests` | [D-036](../../decisions.md) |
| S-62 | Test tiers are the 04 §4 suffixes; no wiring tier; every enabled tier glob matches ≥ 1 file | check | `inventory`, `layout`, `unit` | |
| S-63 | Acceptance tests live in `domain/<m>/api/test/acceptance/`, derived from the frozen spec, protected; changes need `@acceptance-change` | both | `test-integrity`, `spec-tests` | also `protected-paths` per 03 |
| S-64 | No literal verdicts; no `.skip/.only/.todo` without issue reference; required tests cannot disappear or be weakened | check | `test-integrity`, `review` | |
| S-65 | Every check reports `expected`/`observed`/`evaluated`; zero observations is `UNKNOWN`; never `PASS` on empty | harness | `spec-tests`, `accept` | runner |
| S-66 | Independent review by a model of a different family, run pre-push and digest-verified in CI | check | `review` | [D-028](../../decisions.md), [D-037](../../decisions.md) |
| S-67 | Expected red only for named unimplemented observations, reaching their behavioural assertion; rail behaviour stays green | check | `spec-tests` | [D-004](../../decisions.md), [D-051](../../decisions.md) |
| S-70 | Request ID is UUIDv7 and required on every request, except an id-less `/healthz` or `/readyz` probe | both | `route-contract`, `integration` | [D-045](../../decisions.md), [D-072](../../decisions.md) |
| S-71 | Logging is pino with redaction; metrics are `prom-client`; no standard against OpenTelemetry | rail | — | template |

Count: 56 rows. By group in 03 Part A: Platform 8, Security and access 4, API and data access 5, Language and compiler 6, Code hygiene 5, Angular 2, Tests 1, adopted by [D-014](../../decisions.md) 6, added by [D-049](../../decisions.md) 19.

## Amendments without a new number

From [03 Part A](../framework/03-standards.md) ([D-043](../../decisions.md), [D-045](../../decisions.md)): S-24 gains LINT010 (unique prefix), LINT011 (`app.*` GUC only), LINT012 (`@pii` annotation), LINT013 (applied migrations immutable). S-31 is enforced by `inventory`, `lint` and `typecheck`. S-70 by `route-contract` and `integration`. S-40 gains the changeset-vs-baseline check in `openapi`. L-01 is not a standard.

## Rule ids used in findings

Findings carry a `standard` value that may be an S-id, a layout section (`04 §2`), a packet rule (`05 PL-07`), or the words `tests` / `tiers` ([08 C.2](../framework/08-cli-and-nodes.md)).

Source: [03 Part A](../framework/03-standards.md), [08 Part B](../framework/08-cli-and-nodes.md), [D-014](../../decisions.md), [D-049](../../decisions.md).
