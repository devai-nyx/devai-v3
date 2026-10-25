---
title: Troubleshooting
sidebar_position: 11
description: From an exit code and a reason code to the next action, for the agent and for the pilot.
---

# Troubleshooting

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

Every line `devai check` prints is a locator plus a remedy. Read the line and act; the rule *is* the
line ([05 §5](../framework/05-task-packet.md)). This page groups the common cases. The full list of
54 reason codes is in the [reference](../reference/reason-codes.md).

## First, the exit code

| Exit | Means | Next action |
|---|---|---|
| `1` | A demonstrated violation (`FAIL`) | Fix each FAIL line: locator, standard, hint |
| `2` | Could not observe (`UNKNOWN`) or could not run (`reason`) | Do the remedy the line prints |

([02 §8](../framework/02-architecture.md), [10 §1](../framework/10-agent-surface.md)) An `UNKNOWN`
row prints as `UNKNOWN <node> <reason>: <hint>`; a command-level failure as
`devai: <reason> — <hint>` ([10 §4](../framework/10-agent-surface.md)).

**Never:** disable a node (there is no switch), edit anything under `.devai/`, edit
`observations` outside a `test` packet, or re-run to reroll a reviewer verdict
([10 §1, §2](../framework/10-agent-surface.md)). A missing service is never a reason to skip.

## Packet and spec problems

| Reason or message | Next action |
|---|---|
| `packet-invalid` | Fix the field the PL-01/02/03/06/14 line names |
| `base-not-ancestor` | Rebase onto `base`, or run `devai packet rebase` |
| `out of scope: <path>` (PL-07) | Add the path to `paths.allowed` and re-run; no one is asked |
| `forbidden path touched` (PL-07) | Regenerate, or move the logic to a seed file |
| `after: PKT-… is not merged below base` (PL-12) | Advance `base` with `devai packet rebase` |
| `required node skipped for kind: …` (PL-15) | The deliverable is missing; produce it (for example, mount the routes) |
| `spec-not-approved` | The pilot approves the spec; note it under `## Notes` and stop |
| `spec-superseded` | Pin the successor named in the status line |
| `spec-invalid` | Fix the SL line in a spec packet |
| `… write a successor` | Only the pilot can act; note it under `## Notes` |

([05 §5](../framework/05-task-packet.md), [10 §4](../framework/10-agent-surface.md))

## Environment and tooling

| Reason | Next action |
|---|---|
| `config-invalid` | Fix `devai.json` at the printed path; `DEVAI_RUNTIME` must be `bare` or `docker` |
| `not-a-repository` | Run inside a git work tree with at least one commit |
| `tooling-missing` | Install with the printed command |
| `engines-mismatch` | `corepack use <packageManager>`; Node must satisfy `>=24 <25` |
| `postgres-unreachable` | Start PostgreSQL for the declared runtime; check `DATABASE_URL` and `CREATE DATABASE` privilege |
| `docker-unreachable` | Start Docker |
| `psql-missing` / `shell-missing` | Install the PostgreSQL 16 client / a POSIX `sh` at `/bin/sh` |
| `browsers-missing` | `pnpm exec playwright install` |
| `scratch-collision` | Re-run for a fresh name; never drop a database DEVAI did not create |
| `candidate-changed` | Stop the other writer (watcher, editor, second agent) and re-run |
| `base-unreadable` | `git fetch origin`, then re-run |

([10 §4](../framework/10-agent-surface.md)) See [Runtimes](runtimes.md) for the bare/Docker
contract.

## Tests

| Reason or finding | Next action |
|---|---|
| `uncovered R-n` | Add the missing `it('R-n: …')` in a `test` packet |
| `setup-failed` | Fix the import, app start or DB setup at the locator |
| `expect-red-not-reached` | Make the named case fail at an `expect`; seed with SQL, not unbuilt routes |
| `assertion-unresolved` | Fail through `expect()` |
| `R-n expected red but passed` | The behaviour exists or the case is vacuous |
| `expect-red-nothing-named` | Drop `--expect-red`; it only restates a `test` packet's list |
| `no-observations` | Put the files where the tier glob expects them ([04 §4](../framework/04-layout.md)) |
| `acceptance file edited by a code packet` | Revert; a `test` packet owns it |

([08 B.12, B.21](../framework/08-cli-and-nodes.md), [10 §4](../framework/10-agent-surface.md))
See [Deriving tests](deriving-tests.md).

## Generated code

| Reason or finding | Next action |
|---|---|
| `differs from regeneration` | `devai new module --regenerate`, or move the logic to a seed file |
| `generator-version-mismatch` | `pnpm add -w -D @devai-nyx/cli@<version> && pnpm install` |
| `generator-unavailable`, `catalog-unresolved` | Regenerate in a `generate` packet |
| `output-exists` | The module exists: use `--regenerate` |
| `spec-mismatch` | Regenerate only from the spec the manifest names |

([08 A.2, B.16](../framework/08-cli-and-nodes.md), [10 §4](../framework/10-agent-surface.md))

## Review and sensor

| Reason | Next action |
|---|---|
| `family` | Commit with a `Co-Authored-By` trailer naming your model |
| `no-reviewer-configured` | The pilot adds the other family under `devai.json` `review.reviewers` |
| `model-error` | Check the reviewer command is logged in, then re-run |
| `stale` | Re-run `devai check --packet <p> --full` and commit `.devai/review/` |
| `timeout`, `schema-invalid`, `output-bound-exceeded` | Re-run once; a repeat goes under `## Notes` |
| `verdict-unknown` | Re-run once; a repeat goes to the pilot under `## Notes` |
| `review-incomplete`, `budget-exhausted` | Re-run once; if it repeats, split the packet |
| `input-bound-exceeded` | The change is too large to review: split the packet |
| `slice-too-large` | Move code out of the listed guard-reachable files, or note it for the pilot |
| `capability-missing`, `tool-use-observed` | Install the reviewer CLI version the release pins |

([10 §4](../framework/10-agent-surface.md)) See
[Review and dispositions](review-and-dispositions.md).

## When to hand it to the pilot

The agent stops and writes under `## Notes` when the spec or an acceptance test is wrong, a choice
needs the pilot, or a remedy says to note it ([10 §2.1](../framework/10-agent-surface.md)). For you,
the pilot, the summary and labels are the dashboard: packet, spec digest, protected classes touched,
review status ([02 §5](../framework/02-architecture.md)). A `protected:unplanned` label is the one
case where your attention is explicitly requested; it is still never a refusal.

Approval records intent; it never turns a failing check green ([01 Charter](../framework/01-charter.md)).

Source: [01](../framework/01-charter.md), [02 §5, §8](../framework/02-architecture.md),
[05 §5](../framework/05-task-packet.md), [08 A.2, B.12, B.16, B.21](../framework/08-cli-and-nodes.md),
[10 §1, §2, §4](../framework/10-agent-surface.md).
