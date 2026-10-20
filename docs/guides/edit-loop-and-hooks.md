---
title: Edit loop and hooks
sidebar_position: 7
description: The three levels of devai check, how to read the report and exit codes, and what the three git hooks run.
---

# Edit loop and hooks

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

The error state is whatever one local command reports for the current change, fast enough to run
after every edit ([D-005](../../decisions.md)). That command is `devai check`. In the template,
`devai` means `pnpm exec devai` ([10 §1](../framework/10-agent-surface.md)).

## Three levels, one acceptance

| Command | Runs | Accepts? |
|---|---|---|
| `devai check` | The edit-loop subset over the current change | No |
| `devai check --packet <p>` | The subset plus `packet-scope` and the packet's acceptance tests, with their database prerequisites | No; lists the deferred nodes |
| `devai check --packet <p> --full` | Every applicable node, including `permissions-pattern`, `review` and `accept`, over `base..candidate` | **The only acceptance**: exit 0 accepts |

([02 §8](../framework/02-architecture.md), [08 A.3](../framework/08-cli-and-nodes.md)) The
edit-loop subset is `format lint lint-tests typecheck layout sql-lint spec-lint route-contract`,
`sql-typed` static, `unit test-integrity i18n`; `sql-typed` against the database joins when
PostgreSQL is already reachable in the declared mode, without starting anything.

Two more forms are feedback only and can never accept ([10 §1](../framework/10-agent-surface.md)):

- `devai check --only <node>`: one node and its prerequisites; also the way to see one node's
  tooling preflight ([08 A.6](../framework/08-cli-and-nodes.md)).
- `pnpm test`: the template's root script, `devai check --only unit`
  ([09 §1.1](../framework/09-rail.md)).

`devai check --full` without a packet runs every applicable node except the three packet-bound ones,
with `accepted: false` ([08 A.3](../framework/08-cli-and-nodes.md)).

## Reading the report

The text report is at most 40 lines, failing nodes first, then `UNKNOWN` nodes, then a `PASS` count,
the `SKIPPED` nodes with their evidence, the deferred nodes, the review line and `exit <code>`
([08 C.3](../framework/08-cli-and-nodes.md)). Every finding is a locator, a message, a standard id
and a one-line hint:

```
      domain/crash-record/api/src/crash-record.repository.ts:61  param $5 z.string().max(1024) exceeds … varchar(512)   [S-27]
```

([02 §8](../framework/02-architecture.md)) The hint carries the rule; you do not need the standards
document open ([02 §10](../framework/02-architecture.md)). The full machine report is `report.json`
under `.devai/cache/reports/`.

## Exit codes

| Exit | Meaning | What to do |
|---|---|---|
| `0` | No gating node `FAIL` or `UNKNOWN` | Continue; on `--packet --full`, the packet is accepted |
| `1` | At least one `FAIL` | Fix each FAIL line |
| `2` | At least one `UNKNOWN` and no `FAIL`, or the command could not run | Do the remedy the line prints |

`FAIL` and `UNKNOWN` together exit 1 with both kept. CI treats 1 and 2 as red
([02 §8](../framework/02-architecture.md)). No flag, packet field or waiver disables a node
([10 §1](../framework/10-agent-surface.md)). For individual reason codes see
[Troubleshooting](troubleshooting.md).

The four statuses ([02 §8](../framework/02-architecture.md), [D-044](../../decisions.md)):

- `PASS`: observed, no findings. A success with zero observations is rewritten to
  `UNKNOWN: no-observations` by the runner.
- `FAIL`: observed, with findings. A shortfall against a known count is a `FAIL`, not an `UNKNOWN`.
- `UNKNOWN`: could not observe (tool missing, service unreachable, model unavailable, prerequisite
  not green).
- `SKIPPED`: not applicable, decided only by `inventory` from a population predicate, printed as
  evidence such as `no changed *.sql`.

## The git hooks

`devai init` writes three one-line scripts under `scripts/hooks/` and sets `core.hooksPath` to that
folder; there is no husky ([08 A.7](../framework/08-cli-and-nodes.md), [D-057](../../decisions.md)).
Each runs `pnpm exec devai check --hook <stage>`.

| Hook | Nodes |
|---|---|
| `pre-commit` | `format lint lint-tests sql-lint` over the **staged** snapshot (index bytes, modes and deletions) |
| `pre-push` | The pre-commit set plus `generated boundary deadcode openapi actionlint`; `db-apply`, `sql-typed` DB and `integration` when `database/**`, `domain/*/db/**` or `*.repository.ts` changed; the `protected-paths` notice |
| `commit-msg` | `commitlint`: `type(scope): subject`, scope = package or module slug |

([08 A.7](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md)) A partially staged file is
checked as staged, not as it is on disk. The pre-push hook does not run `review`; the review runs
inside your `--packet --full` run before you push.

Each hook prints one stage line just before `exit <code>`
([10 §4](../framework/10-agent-surface.md)):

```
devai pre-commit FAIL — fix the lines above, git add, commit again; CI runs the same nodes
```

CI runs the same nodes, so `--no-verify` saves nothing ([10 §1](../framework/10-agent-surface.md)).

**Protected paths are a notice, never a refusal.** Pre-push prints one line per protected class the
change touches, for example
`protected:infra — database/ddl/21-est-rls.sql (packet declares: yes)`, and never exits non-zero
for it. On the PR, the Action applies the labels and adds `protected:unplanned` when the packet did
not declare the class ([02 §5](../framework/02-architecture.md), [D-019](../../decisions.md)).

## Speed and the cache

The edit loop's service level is **provisional**: a 90 s warm ceiling, stored in `devai.json` as
`check.editLoopCeilingMs: 90000`, until the p95 is measured on the first STYNX and DETRAN modules in
both runtimes ([D-047](../../decisions.md), [08 A.8](../framework/08-cli-and-nodes.md)). `accept`
reports the measured time; it does not fail on it.

Only `PASS` results are cached, keyed by the node's inputs, toolchain, configuration and runtime
mode ([02 §2](../framework/02-architecture.md)). `rm -rf .devai/cache` is always safe and loses only
speed; `devai check --prune` keeps the newest 200 entries per node
([02 §11](../framework/02-architecture.md)). `devai check` writes `.devai/`; never hand-edit
anything under it ([10 §1](../framework/10-agent-surface.md)).

If files change while a check runs (a watcher, an editor, a second agent), the result is discarded
as `candidate-changed`, exit 2 ([08 A.3](../framework/08-cli-and-nodes.md)). Run one writer at a
time.

Source: [02 §2, §5, §8, §10, §11](../framework/02-architecture.md),
[08 A.3, A.6–A.8, C.3](../framework/08-cli-and-nodes.md), [09 §1.1](../framework/09-rail.md),
[10 §1, §4](../framework/10-agent-surface.md), [D-005, D-019, D-044, D-047, D-057, D-058](../../decisions.md).
