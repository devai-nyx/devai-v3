---
title: DEVAI and STYNX
sidebar_position: 7
description: How DEVAI 3 relates to STYNX — STYNX is governed by DEVAI like any product, while DEVAI invokes STYNX's published tooling and builds on its mechanisms.
---

# DEVAI and STYNX

STYNX is the company's framework library of common components, actions and behaviours; DETRAN is the
main product line. Both are DEVAI consumers ([00](../framework/00-intent.md)). The relationship runs in two
directions, and keeping them apart is most of what this page is about.

## Direction 1: STYNX is governed, not governing

STYNX must follow every rule and guideline DEVAI enforces, exactly as DETRAN does. DEVAI's scaffolding
may generate code that uses STYNX, but STYNX conventions are not authority over company standards
([D-007](../../decisions.md), [02 §13](../framework/02-architecture.md)). Where STYNX today departs from a
standard, the standard stands and the gap becomes a STYNX migration item:

| Standard | STYNX today | Ruling |
|---|---|---|
| ESM only (S-31) | Backend output is CommonJS | STYNX migrates; no tolerance in the standard ([D-012](../../decisions.md), [D-057](../../decisions.md)) |
| No `any`, all `no-unsafe-*` at `error` (S-33) | `no-explicit-any` is off | On from day 0 ([D-013](../../decisions.md)) |
| Permissions from the token, no SQL per request (S-12) | The auth guard resolves permissions per request via memory → Redis → SQL | S-12 stands; the token carries permissions; the sensor reads `FAIL` until STYNX migrates ([D-025](../../decisions.md), [02 §4](../framework/02-architecture.md)) |
| Typed raw SQL (S-21) | `Transaction.query` forwards a caller-supplied result type unvalidated | STYNX implements the typed-query contract; `Transaction.query` becomes `@internal`; no package-wide lint exemption ([D-030](../../decisions.md), [02 §3](../framework/02-architecture.md)) |
| Product DB roles (S-18) | Platform migrations hard-code `stynx_*` roles | STYNX's migration runner applies the product role prefix at apply time; applied bytes stay immutable ([D-070](../../decisions.md)) |
| Duplicate migration prefixes (LINT010) | `0012` and `0018` are duplicated | Applied history is immutable; a collision counts only for files absent from the merge base ([D-059](../../decisions.md), [D-069](../../decisions.md)) |

A rule that the current STYNX code fails is reported as `FAIL`, which is the correct reading
([02 §4](../framework/02-architecture.md)).

## Direction 2: DEVAI stands on STYNX's mechanisms

STYNX already contains much of what v3 needs, and the brake says to prefer what STYNX already uses
([D-055](../../decisions.md)). [03b](../framework/03b-stynx-extraction.md) records what is carried as-is:

- the shared ESLint factory with its profiles and the tsconfig chain — a generated package picks a profile
  and inherits every standard;
- the migration linter on libpg_query, with intent expressed as annotations in the SQL file
  (`-- @destructive: approved-by=`) — the model for every pilot approval in v3 ([D-016](../../decisions.md));
- route decorators as declared decisions, which v3 completes into the write-route contract (S-25, S-28);
- `Database.tx()`, which sets the transaction GUCs and re-reads them to verify;
- test helpers such as `expectRLSIsolated`, `withTenant`, `withActor`;
- committed, byte-verified generated artefacts with `:write` / `--check` pairs;
- the module generator `generate-module.ts`, which v3 grows rather than replaces
  ([03b §2](../framework/03b-stynx-extraction.md), [02 §1](../framework/02-architecture.md)).

The generator's STYNX code was relicensed by NYXK from BUSL-1.1 to Apache-2.0 so that the Apache-2.0 CLI
can carry it; the rest of STYNX stays BUSL-1.1 ([D-067](../../decisions.md)).

03b also lists what v3 does **not** inherit from STYNX's v2-era governance: role-based path authority,
per-commit Owner receipts, trace-file rebinding on test edits and hash-chained evidence
([03b §4](../framework/03b-stynx-extraction.md)).

## Invoke, never vendor

Where a STYNX lint, tsconfig or linter enforces a standard, DEVAI invokes the published package
([01](../framework/01-charter.md)):

- STYNX publishes `@stynx-nyx/eslint-config`, `@stynx-nyx/tsconfig` and `@stynx-nyx/migration-linter` as
  versioned ESM packages before v3.0. DEVAI never vendors copies ([D-029](../../decisions.md), S-19 in
  [03](../framework/03-standards.md)).
- STYNX also ships `verify-api-coverage`, `list-routes`, `verify-openapi-contract`,
  `verify-public-api-baselines`, `verify-rls-negative` and `verify-stynx-boundary` as callable entry points of
  `@stynx-nyx/cli`, and an SDK check binary in `@stynx-nyx/sdk` ([D-057](../../decisions.md), [D-059](../../decisions.md)).
- Until a package exists, the dependent nodes report `UNKNOWN: tooling-missing` with the install command,
  never a substitute ([D-029](../../decisions.md), [08 §0](../framework/08-cli-and-nodes.md)).
- The `boundary` node runs STYNX's verifier over `.stynxrc.json`, which the template ships; a missing file
  is `FAIL` ([04 §7](../framework/04-layout.md), [D-058](../../decisions.md)).

## Who owns what

| Piece | Home | Source |
|---|---|---|
| Typed-query contract (`defineQuery`, `run`, `ResultOf`, `sql`) | Specified by DEVAI, implemented in `@stynx-nyx/data` | [D-030](../../decisions.md), [02 §3](../framework/02-architecture.md) |
| `@ErrorContract`, `@UseCase`, `@Slo` | `@devai-nyx/decorators`, which depends on neither STYNX nor the CLI | [D-059](../../decisions.md), [D-063](../../decisions.md), [02 §1](../framework/02-architecture.md) |
| `@Idempotent`/`@NoIdempotent`, `@Permission`, `@RequireRoles` | STYNX, kept exported | [D-059](../../decisions.md) |
| Lint profiles, tsconfig chain, migration linter rules | STYNX packages; v3 adds an overlay and rules LINT010–013 | [02 §2](../framework/02-architecture.md), [D-043](../../decisions.md) |
| Technical spec format, packet format, check graph, template, generator | DEVAI | [01](../framework/01-charter.md), [02 §1](../framework/02-architecture.md) |

## Release dependency

Because the template depends on published STYNX packages and on STYNX's migrations, DEVAI 3.0.0 cannot
ship before those STYNX deliverables exist ([D-029](../../decisions.md), [02 §1](../framework/02-architecture.md)).
The Owner ruled which STYNX items gate the 3.0.0 template and which gate only STYNX's own adoption
([D-064](../../decisions.md)). STYNX itself keeps DEVAI 2.6.2 until its own move ([D-065](../../decisions.md)).

Source: [00](../framework/00-intent.md), [01](../framework/01-charter.md), [02](../framework/02-architecture.md),
[03](../framework/03-standards.md), [03b](../framework/03b-stynx-extraction.md), [04](../framework/04-layout.md),
[D-007](../../decisions.md), [D-025](../../decisions.md), [D-029](../../decisions.md), [D-030](../../decisions.md),
[D-057](../../decisions.md), [D-059](../../decisions.md), [D-067](../../decisions.md), [D-070](../../decisions.md).
