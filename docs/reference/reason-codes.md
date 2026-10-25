---
title: Reason codes
sidebar_position: 4
description: All 55 reason codes of the closed ReasonCode enum, where each is raised, its exit code and its one-line hint from 10 §4.
---

# Reason codes

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

A reason code says why something could not run or could not be observed. The set is a closed zod enum, `ReasonCode`, in [08 C.2](../framework/08-cli-and-nodes.md) (the same text is in `packages/cli/src/report.ts`). It has **55 codes**: 15 command-level and 40 node-level. No other code exists.

The hints are the one-line remedies of [10 §4](../framework/10-agent-surface.md), copied verbatim; only code-span backticks were added around `<placeholders>` and commands so they render. 10 §4 marks each as *kept* (08's own remedy, 9 codes), *rewritten* (3 codes) or *new* (43 codes). Each hint is at most 160 characters.

## How codes are printed

From [08 C.3](../framework/08-cli-and-nodes.md) and [10 §4](../framework/10-agent-surface.md):

```text
UNKNOWN <node> <reason>: <hint>        ← an UNKNOWN node row without a finding
devai: <reason> — <hint>               ← a command-level reason
```

`permissions-pattern` prints `permissions-pattern UNKNOWN (<reason>): <hint>` ([08 B.24](../framework/08-cli-and-nodes.md), [10 §4](../framework/10-agent-surface.md)).

Some node blocks attach detail to a code, for example `unsupported-oid <oid>`, `tooling-missing — openapi: install @stynx-nyx/cli ≥ <v> with the write pair` ([D-088](../../decisions.md)), or `postgres-unreachable (bare) — start PostgreSQL for the declared runtime; …`. The code is still the enum value ([08 Part B](../framework/08-cli-and-nodes.md)).

"Raised by" below comes from the Part A command blocks, the Part B node blocks and the C.1 runner steps of [08](../framework/08-cli-and-nodes.md). "Exit" is the exit code the code leads to when it is the only problem.

## Command level (15)

"Could not run": the command stops before or around the node graph. In `report.json` the code is the top-level `reason`.

| # | Code | Raised by | Exit | 10 §4 | Hint |
|---|---|---|---|---|---|
| 1 | `config-invalid` | every command (attach-mode `init`, `new module`, `check`, `packets status`); invalid `DEVAI_RUNTIME` | 2 | new | fix devai.json at the printed path; the schema is devai.schema.json |
| 2 | `not-a-repository` | `init` (attach), `check`, `packet new` (HEAD has no commit), `packets status` | 2 | new | run inside a git work tree that has at least one commit |
| 3 | `packet-invalid` | `check --packet`, `packet lint` — PL-01, 02, 03, 06, 14 and the "does not exist at base" branch of PL-04 | 2 | kept | 05 PL-01/02/03/06/14 messages (locator + remedy) |
| 4 | `base-not-ancestor` | `check --packet`, `packet lint` — PL-05 | 2 | kept | PL-05: "rebase onto it or run devai packet rebase" |
| 5 | `expect-red-nothing-named` | `check --expect-red` — PL-11 | 2 | new | drop --expect-red; it only restates a test packet's observations.unimplemented |
| 6 | `no-report` | `check --summary` without a matching report | 2 | kept | "run --full" |
| 7 | `candidate-changed` | `check` — candidate digest differs before/after the run (C.1 step 10) | 2 | new | files changed during the run; stop the other writer (watcher, editor, second agent) and re-run |
| 8 | `usage` | `init` (`--product` missing), `packet new` (999 ids exhausted, `--campaign` ambiguous, `--spec` with `standards`) | 2 | new | see `devai <command> --help`; the line above names the bad argument |
| 9 | `dir-not-empty` | `init` materialise mode | 2 | new | use an empty --dir; attach mode needs an existing devai.json |
| 10 | `spec-not-approved` | `new module`, `packet new` (pinning kinds) | 2 | new | the pilot approves the spec (status: approved, approved-by); note it under ## Notes and stop |
| 11 | `spec-invalid` | `new module`, `packet new` | 2 | new | fix the SL line above in a spec packet |
| 12 | `spec-superseded` | `packet new` (pinning kinds, spec carries `superseded-by`) | 2 | new | pin the successor named in the status line |
| 13 | `output-exists` | `new module` (`--out` exists without `--regenerate`) | 2 | new | the module exists: use --regenerate |
| 14 | `spec-mismatch` | `new module --regenerate` (manifest `specId` ≠ spec id and ≠ `supersedes.id`) | 2 | new | regenerate only from the spec the manifest names; a successor spec's module is not supported: note it under ## Notes |
| 15 | `config-mismatch` | `init` re-run (`HEAD` unborn or lacking an `init` commit, [D-115](../../decisions.md)) with `--product`, `--locales`, `--lgpd` or `--runtime` ≠ its `devai.json` value ([D-113](../../decisions.md), [D-116](../../decisions.md)) | 2 | new | `<flag>` differs from devai.json `<field>`; omit it or pass the recorded value |

## Node level (40)

"Could not observe": a node row is `UNKNOWN` with this `reason`. The exit is 2 only when no gating node is `FAIL`; `FAIL` + `UNKNOWN` exits 1 with both preserved.

| # | Code | Raised by | Exit | 10 §4 | Hint |
|---|---|---|---|---|---|
| 16 | `no-observations` | runner, any node (PASS with `observed = 0`, C.1 step 9) | 2 | new | the tool saw nothing to check: put the files where the tier glob expects them (04 §4) |
| 17 | `prerequisite-failed` | runner, any node whose prerequisite is FAIL/UNKNOWN (C.1 step 8); named in `inventory` dependents, `route-contract`, `sql-typed`, `openapi`, `integration` | 2 | new | fix `<prerequisite>` first; this node did not run |
| 18 | `tooling-missing` | `init` preflight; `check` (when `inventory` cannot run); `inventory`, `format`, `lint`, `lint-tests`, `typecheck`, `sql-lint`, `route-contract`, `i18n`, `actionlint`, `commitlint`, `generated`, `boundary`, `deadcode`, `openapi`, `db-apply`, `e2e` | 2 | kept | "install with `<command>`" |
| 19 | `engines-mismatch` | `inventory` | 2 | kept | "`corepack use <packageManager>`"; Node must satisfy engines (`>=24 <25`) |
| 20 | `lint-config-failed` | `lint`, `lint-tests`, `commitlint` | 2 | new | the config at the locator did not load; fix it in a standards packet |
| 21 | `runner-crashed` | `format`, `typecheck`, `sql-lint`, `unit`, `integration`, `actionlint`, `boundary`, `deadcode`, `e2e`, `accept`; the C.5 Vitest adapter | 2 | new | the tool exited abnormally; re-run once, then put the output under ## Notes |
| 22 | `timeout` | `unit`, `integration`, `permissions-pattern` | 2 | new | re-run once; a repeat goes under ## Notes |
| 23 | `base-unreadable` | `test-integrity`, `openapi`, `protected-paths` (incl. pre-push hook notice), `packet-scope` | 2 | new | git fetch origin, then re-run |
| 24 | `io` | `check` (C.6 candidate digest), `layout`, `spec-lint`, `i18n`, `commitlint` | 2 | new | make the path readable (permissions, broken or escaping symlink), then re-run |
| 25 | `parser-unavailable` | `sql-lint`, `sql-typed` | 2 | new | the SQL parser did not load: pnpm install --force |
| 26 | `adapter-unbound` | `sql-typed` | 2 | new | restore pg 8.23.1 and pg-protocol ^1.16.1 from the lockfile (pnpm install --frozen-lockfile), then re-run |
| 27 | `unsupported-oid` | `sql-typed` | 2 | new | the column type has no zod mapping (02 §3); note it under ## Notes |
| 28 | `unsupported-binding` | `sql-typed` | 2 | new | bind $n directly to a column, with no cast or function around it |
| 29 | `mount-unresolved` | `inventory`, `route-contract`, `permissions-pattern` | 2 | new | make the module's imports/controllers arrays static at the locator |
| 30 | `missing-source` | `permissions-pattern` | 2 | new | restore the file or pnpm install; the slice needs it |
| 31 | `postgres-unreachable` | `sql-typed` (DB), `db-apply`, `integration` | 2 | rewritten | was "start it with `<command from devai.json>`" → start PostgreSQL for the declared runtime; check DATABASE_URL and CREATE DATABASE privilege, then re-run |
| 32 | `docker-unreachable` | `db-apply` | 2 | kept | "start Docker" |
| 33 | `psql-missing` | `db-apply` | 2 | new | install the PostgreSQL 16 client (psql) |
| 34 | `shell-missing` | `db-apply` | 2 | new | install a POSIX sh at /bin/sh |
| 35 | `scratch-collision` | `db-apply` | 2 | new | re-run for a fresh scratch name; if it repeats, note it under ## Notes; never drop a database devai did not create |
| 36 | `browsers-missing` | `e2e` | 2 | kept | "pnpm exec playwright install" |
| 37 | `setup-failed` | `spec-tests`, `e2e`; the C.5 Vitest adapter | 2 | new | the suite failed before any case: fix the import, app start or DB setup at the locator |
| 38 | `expect-red-not-reached` | `spec-tests` | 2 | rewritten | was "fix the arrange step" → make the case fail at an expect; seed with SQL, not unbuilt routes |
| 39 | `assertion-unresolved` | `spec-tests` | 2 | new | fail through expect(); a throw without a source-mapped AssertionError cannot be classified |
| 40 | `generator-version-mismatch` | `generated` | 2 | kept | "`pnpm add -D @devai-nyx/cli@<version>`" |
| 41 | `generator-unavailable` | `generated` | 2 | kept | "regenerate in a generate packet" |
| 42 | `catalog-unresolved` | `i18n` | 2 | new | regenerate the module in a generate packet |
| 43 | `slice-too-large` | `permissions-pattern` | 2 | rewritten | was "narrow the slice" → move code out of the listed guard-reachable files, or note it for the pilot |
| 44 | `input-bound-exceeded` | `permissions-pattern`, `review` | 2 | new | the change is too large to review: split the packet (smaller spec or successor packet) |
| 45 | `output-bound-exceeded` | `permissions-pattern`, `review` | 2 | new | re-run once; a repeat goes under ## Notes |
| 46 | `budget-exhausted` | `review` | 2 | new | re-run once; if it repeats, split the packet |
| 47 | `review-incomplete` | `review` | 2 | new | re-run once; the unexamined R-n are listed; if it repeats, split the packet |
| 48 | `tool-use-observed` | `permissions-pattern` | 2 | new | the sensor CLI used a tool; install the CLI version 12 pins, then re-run |
| 49 | `capability-missing` | `permissions-pattern`, `review` | 2 | new | the reviewer CLI cannot enforce read-only, no-network isolation (sandbox or flag missing); install the version 12 pins |
| 50 | `schema-invalid` | `permissions-pattern`, `review` | 2 | new | re-run once; a repeat goes under ## Notes |
| 51 | `verdict-unknown` | `permissions-pattern`, `review` | 2 | new | re-run once; a repeat goes to the pilot under ## Notes |
| 52 | `model-error` | `permissions-pattern`, `review` | 2 | new | check that `<reviewer command>` is logged in, then re-run |
| 53 | `no-reviewer-configured` | `permissions-pattern`, `review` | 2 | new | the pilot adds the other family under devai.json review.reviewers |
| 54 | `family` | `permissions-pattern`, `review` | 2 | new | commit with a Co-Authored-By trailer naming your model; the reviewer is the other family |
| 55 | `stale` | `permissions-pattern`, `review` (CI: evidence digest ≠ PR head) | 2 | new | re-run `devai check --packet <p> --full` and commit `.devai/review/` |

## Notes

- `prerequisite-failed` and `no-observations` are applied by the runner, not by the node ([08 C.1](../framework/08-cli-and-nodes.md) steps 8–9).
- A hint that says "note it under ## Notes" means the agent records it in the packet and stops; the pilot decides ([05 §5](../framework/05-task-packet.md)).

Source: [08 Part A, Part B, C.1–C.3](../framework/08-cli-and-nodes.md), [10 §4](../framework/10-agent-surface.md), [02 §8](../framework/02-architecture.md).
