---
title: Building and testing
sidebar_position: 3
description: The build command today, what R6 adds, the generator release matrix CI runs, and the R2 database prototype.
---

# Building and testing

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

The `pnpm` build below runs today. The `devai` commands on this page are the ones the release matrix
will run once the CLI exists at R6.

## Toolchain

- Node `>=24 <25`. CI uses 24.20.0, the 3.0.0 pin (12 §3, bootstrap history).
- pnpm 9.15.0 through Corepack, selected by `packageManager`. If your global `pnpm` is another
  version, run it as `corepack pnpm@9.15.0` (12 §3). There is no pin file
  ([D-057](../../decisions.md)).
- `NODE_AUTH_TOKEN` set to a GitHub Packages token, because `.npmrc` resolves both `@devai-nyx` and
  `@stynx-nyx` from `npm.pkg.github.com`.

## Build today

The build is the CI `build` job's command, also given in `AGENTS.md` (12 §2):

```sh
pnpm install --frozen-lockfile && pnpm -r --if-present build && pnpm -r --if-present test
```

At the seed, neither package defines a `build` or `test` script, so `--if-present` skips both and
the job verifies a clean install from the committed lock. There is no `src/main.ts` yet
(12 §2; [D-065](../../decisions.md)).

## Build from R6

R6 adds `tsc -b` to the `build` job (12 §5). Development runs emitted JavaScript, never TypeScript
directly: `tsc -b`, then `node dist/main.js`. There is no `tsx`, because Node's type stripping cannot
resolve the `.js` relative specifiers that ESM output requires to `.ts` sources
([D-057](../../decisions.md), [07 §1](../framework/07-dependencies.md)).

R6 also adds the schema projection test. Every artifact schema is a zod definition. `devai.schema.json`
and the use-case JSON Schema are emitted from those definitions with `z.toJSONSchema()` and committed,
and the DEVAI build checks that every artifact schema projects and that the committed projections
match ([D-056](../../decisions.md), [07 §3](../framework/07-dependencies.md)).

## The generator release matrix

The generator's test is the product's own checker. The suite generates the fixture spec into
temporary workspaces and runs `devai check --full` there; any `FAIL` or `UNKNOWN` fails the PR.
This is standard S-46, and it runs in this repository's `ci.yml`, not as a second Action
([02 §7](../framework/02-architecture.md), [D-064](../../decisions.md)).

In `ci.yml` this is the `matrix` job. It runs in both runtimes (`bare`, `docker`) whenever
`packages/cli/**` changed, and on every `v*` tag. The change test is a job condition, never a
workflow-level `paths` filter, because an absent required check blocks merges silently (12 §5).
**Today the job is a placeholder:** the cells need `src/main.ts` (R6) and the published STYNX `<v>`
(R5), and are written into the job at R8. Until then the job passes on branches and fails on tags,
so `publish` cannot run on an unfilled matrix.

Each cell runs in a temporary workspace with a clean registry install, no STYNX checkout, product
`demo` and browsers provisioned. It replays the fixture campaign as commits
([09 §4](../framework/09-rail.md)):

1. `devai init`.
2. `devai check --packet PKT-DEMO-002 --full`: the PL-15 line, exit 1.
3. `devai new module [--web]`, then mount, `pnpm install` and the write pairs; commit with
   `Packet: PKT-DEMO-002`.
4. `--packet PKT-DEMO-002 --full`: exit 0.
5. `devai packet rebase PKT-DEMO-003 --to HEAD`, add the reference acceptance file, commit.
6. `--packet PKT-DEMO-003 --full --expect-red`: exit 0, `expect-red 3 (R-1, R-2, R-4)`.
7. Rebase PKT-DEMO-004, add the reference service and repository bodies, commit.
8. `--packet PKT-DEMO-004 --full`: exit 0.

| Cells | What they cover | Expected |
|---|---|---|
| O1–O8 | `{--web} × {--lgpd} × {pt-BR}`, bare | The campaign above in each configuration |
| O9–O16 | The same eight, docker | Identical verdicts; `schemaDigest` equal to the bare cell's |
| N1–N12 | Negative cells on the default configuration: a contract decorator removed, `parseDto` removed, a query limit widened, RLS lines removed, the `@pii` line removed, an i18n key removed, an acceptance case or file removed, a generated file hand-edited, a seed edited then regenerated, a draft spec, a successor spec, `@stynx-nyx/cli` uninstalled | Each produces the expected `FAIL` or `UNKNOWN` from the expected node (N9 and N11 exit 0 with the printed outcome) |

The full table, with the node and message each negative cell must produce, is
[09 §4](../framework/09-rail.md). The negative cells test checker and generator together against
shared omissions ([02 §7](../framework/02-architecture.md)).

**Model evidence in the matrix.** No model runs in CI, and no `UNKNOWN` is exempt. `review` does not
gate because the template has `mustRun: false`; it is tallied. The `permissions-pattern` evidence
(`.devai/review/PKT-DEMO-00n.permissions.json`) is produced per cell and packet on the release
author's machine before the push and committed, and CI verifies its slice digest. Missing or stale
evidence is `UNKNOWN` and fails the PR ([09 §4](../framework/09-rail.md),
[D-060](../../decisions.md)).

A green matrix on CI, with that evidence committed, is release prerequisite R8; making `matrix` a
required check is R9 ([Release](release.md)).

## The R2 prototype

Before any STYNX work, release prerequisite R2 prototyped the `sql-typed` database adapter from
[08 B.10](../framework/08-cli-and-nodes.md), because it needs no STYNX and a failure would have
reopened 02 §3 (12 §4). It ran on PostgreSQL 16.15, bare and in Docker, with `pg` 8.23.1, sending
only Parse, Describe, Close and Sync. All cases met their expected results in both runtimes, and
three rulings followed ([D-068](../../decisions.md)):

1. One pg Submittable per query (`parse`, `describe`, `close`, one `sync`) replaces the literal
   `client.connection` sequence, which left the client unqueryable.
2. A Client `'error'` listener is mandatory.
3. Prepare findings carry the SQLSTATE, and cross-runtime comparisons key on it, because the server
   message follows `lc_messages`.

The prototype and its results live in the bootstrap workspace (`agents/r2-pg-prototype/`), not in
this repository ([D-068](../../decisions.md)). 08 B.10 was amended to match.

Source: 02 §7, 07 §1, §3, 08 B.10, 09 §4, decisions D-056, D-057, D-060, D-064, D-065, D-068; 12 §2–§5 (bootstrap history); `.github/workflows/ci.yml` at HEAD.
