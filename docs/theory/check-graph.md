---
title: The check graph
sidebar_position: 4
description: The 28 nodes devai check runs, where each one runs (edit loop, hooks, PR, full acceptance), the four statuses and why the graph fails closed.
---

# The check graph

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

`devai check` is a runner over a fixed directed acyclic graph of 28 nodes. Each node either wraps an
existing tool (ESLint, `tsc`, Prettier, the STYNX migration linter, Vitest, knip, actionlint…) or is one
of the few checks DEVAI adds ([02 §2](../framework/02-architecture.md)). The node set is a closed list: a
new node is a new line in 02 §2 and a decision, not a plugin ([08 Part D](../framework/08-cli-and-nodes.md)).
The exact contract of every node is in [08 Part B](../framework/08-cli-and-nodes.md); the
[nodes reference](../reference/nodes.md) tabulates them.

## Where nodes run

Each node has a latency class — **A** sub-second, **B** up to 30 s, **C** minutes — and a set of
placements ([02 §2](../framework/02-architecture.md)):

| Placement | Trigger | What runs |
|---|---|---|
| **E** edit loop | `devai check`, no flags | `format lint lint-tests typecheck layout sql-lint spec-lint route-contract sql-typed`(static) `unit test-integrity i18n`; `sql-typed`(DB) joins when PostgreSQL is already reachable |
| **C1** pre-commit | `devai check --hook pre-commit` | `format lint lint-tests sql-lint` on the **staged** snapshot, not the working tree |
| commit-msg | `devai check --hook commit-msg` | `commitlint` |
| **P** pre-push | `devai check --hook pre-push` | the pre-commit set plus `generated boundary deadcode openapi actionlint`; `db-apply`, `sql-typed`(DB) and `integration` when SQL or data-layer files changed; the `protected-paths` notice |
| **R** PR (CI) | the template's GitHub Action | every deterministic node, as a job matrix per latency class; `review` and `permissions-pattern` evidence verified by digest, never executed |
| **F** full acceptance | `devai check --packet <p> --full` | every applicable node, including `spec-tests`, `permissions-pattern`, `review` and `accept` |

Sources: [02 §2](../framework/02-architecture.md), [08 A.3, A.7, C.1](../framework/08-cli-and-nodes.md),
[D-058](../../decisions.md). `--packet <p>` without `--full` adds `packet-scope` and the packet's
acceptance tests to the edit-loop subset and reports `accepted: false` ([02 §8](../framework/02-architecture.md)).
`--only <node>` runs one node and its prerequisites and can never accept ([02 §8](../framework/02-architecture.md)).

Some measurement happens outside the graph, in release lanes: SLO measurement is a release gate only,
never part of packet acceptance, which verifies the `@Slo` declaration ([D-038](../../decisions.md), S-29 in
[03](../framework/03-standards.md)); a generator release runs the full option matrix in both runtimes
([02 §7](../framework/02-architecture.md), [09 §4](../framework/09-rail.md)). In CI, a PR touching
`devai.json`, `compose.yaml`, `scripts/ci-local/**`, `tools/**` or the generator runs the
`needs: postgres` nodes in both bare and Docker modes; other PRs use the declared mode, with a weekly
both-mode run as backstop ([D-039](../../decisions.md)).

The edit-loop service level is provisional: a 90-second warm ceiling shapes which nodes are class A/B,
until the p95 is measured on the first STYNX and DETRAN modules in both runtimes and written to
`check.editLoopCeilingMs` ([D-047](../../decisions.md), [08 A.8](../framework/08-cli-and-nodes.md)).

## Order

`inventory` runs first and alone; it is global and decides every other node's population. Then
`db-apply → sql-typed(DB) → spec-tests, integration`; `typecheck → route-contract, openapi`;
`route-contract → permissions-pattern`; every deterministic node and `permissions-pattern` precede
`review`; everything precedes `accept` ([02 §2](../framework/02-architecture.md), [08 C.1](../framework/08-cli-and-nodes.md)).

Nodes choose *what to evaluate* from the change but never *what exists*. A duplicate migration prefix
is visible only against unchanged files, and an app-binding change can alter mounted routes without
touching a controller; a change-scoped population would miss both ([02 §2](../framework/02-architecture.md)
rule f).

## Four statuses

| Status | Meaning |
|---|---|
| `PASS` | Observed, no findings |
| `FAIL` | Observed, with findings |
| `UNKNOWN` | Could not observe: zero observations, tool crash, service unreachable, model unavailable, prerequisite not passed |
| `SKIPPED` | Not applicable to this candidate, decided by `inventory` with evidence |

([02 §8](../framework/02-architecture.md))

`N/A` is not a status ([D-044](../../decisions.md)). A node that is not planned for an invocation — say
`review` without a packet — is *deferred*: `accept` lists it without a status ([D-058](../../decisions.md),
[08 §0](../framework/08-cli-and-nodes.md)).

## Failing closed

The graph is built so that silence can never read as success:

- **No `PASS` on empty.** Every node reports `expected`, `observed` and `evaluated`. The runner, not the
  node author, rewrites a success with `observed = 0` to `UNKNOWN: no-observations` and does not cache it
  ([02 §8](../framework/02-architecture.md), S-65 in [03](../framework/03-standards.md)). This rule exists
  because a v2 sensor returned `PASS` on zero files ([02 §8](../framework/02-architecture.md)).
- **A shortfall is a violation.** Against a complete inventory and a known expected count,
  `observed < expected` is `FAIL`, naming what is missing — for example
  `spec-tests expected 4, observed 2: uncovered R-3, R-5` ([02 §8](../framework/02-architecture.md)).
- **`SKIPPED` needs evidence, and only `inventory` may say it.** The evidence is a repository population
  predicate such as `no mounted routes in domain/<m>`, never the spec's empty collection alone and never
  the node runtime's own judgement ([D-044](../../decisions.md), [D-054](../../decisions.md)). A node whose
  population was non-empty but found nothing to do is `UNKNOWN` ([08 §0](../framework/08-cli-and-nodes.md)).
- **A required node cannot be skipped.** For each packet kind, `accept` derives a required set; a
  required node that comes back `SKIPPED` is a `FAIL` ([05 §3](../framework/05-task-packet.md)).
- **A failed prerequisite is visible.** Its dependents report `UNKNOWN` with the dependency's locator,
  never an omitted row ([02 §2](../framework/02-architecture.md)).
- **Missing tools and services are `UNKNOWN`, with a remedy.** A missing binary is
  `UNKNOWN: tooling-missing` with the install command ([08 §0](../framework/08-cli-and-nodes.md),
  [D-029](../../decisions.md)). An unreachable database is `UNKNOWN` with the start command, never an
  implicit fallback to the other runtime mode ([02 §6](../framework/02-architecture.md)).
- **No waivers.** There is no `review: off`, no per-packet node list and no pilot waiver of any node
  ([02 §8](../framework/02-architecture.md)).
- **The candidate must hold still.** The candidate digest is taken before and after the run; if it
  changed, the result is discarded with `candidate-changed` ([08 C.1](../framework/08-cli-and-nodes.md)).

## Exit codes

One contract for every command: `0` when no gating node is `FAIL` or `UNKNOWN`; `1` when at least one is
`FAIL`; `2` when at least one is `UNKNOWN` and none is `FAIL`, or the command could not run, with a
`reason` code. `FAIL` and `UNKNOWN` together exit 1 with both preserved. CI treats 1 and 2 as red
([02 §8](../framework/02-architecture.md)). `accepted: true` appears only on `--packet … --full` exit 0
([D-058](../../decisions.md)).

Every planned node gates, except `review` while `review.mustRun` is `false` and the candidate touches no
undeclared protected class ([08 A.3](../framework/08-cli-and-nodes.md), [D-028](../../decisions.md)).

## Cache

Only `PASS` is cached, keyed by node, node version, toolchain, config, runtime mode, input digests and the
results of prerequisites; database-backed results are keyed by the schema digest `db-apply` emits, so
they are the same in both modes ([02 §2](../framework/02-architecture.md), [08 C.4](../framework/08-cli-and-nodes.md)).
The cache lives in `.devai/cache/` (gitignored); deleting it is always safe and loses only speed
([02 §11](../framework/02-architecture.md)).

Source: [02](../framework/02-architecture.md), [05](../framework/05-task-packet.md), [08](../framework/08-cli-and-nodes.md),
[D-028](../../decisions.md), [D-039](../../decisions.md), [D-044](../../decisions.md), [D-047](../../decisions.md),
[D-058](../../decisions.md).
