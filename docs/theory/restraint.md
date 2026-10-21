---
title: Restraint
sidebar_position: 6
description: The second-system brake that governs DEVAI 3, and every "what we are not building" list from the framework collected in one place.
---

# Restraint

## The brake

v2 was DEVAI's second system, in Brooks's sense: the one where everything left out of the first gets
put in. The author's verdict was that most of the ceremony built up around it was useless — "a donkey
running to a tied carrot on a stick" ([00](../framework/00-intent.md)). v3 is therefore built under an
explicit brake, [D-055](../../decisions.md):

- an element exists only if a named v3 mechanism depends on it;
- no new node, state, command, file or field unless 02, 05 or 06 already requires it;
- prefer what STYNX already uses;
- every document carries a "what we are not building" section.

The brake is why the CLI has five commands where v2 exposed 69 actions
([08 §0](../framework/08-cli-and-nodes.md)), why the node set is a closed list of 28
([D-045](../../decisions.md), [08 Part D](../framework/08-cli-and-nodes.md)), and why the template does not
create folders nothing reads ([09 §1.1](../framework/09-rail.md)). It also governs changes to the law; see
[Changing the law](../dev/changing-the-law.md).

## What DEVAI 3 is not building

Collected from the framework documents and grouped by theme. Each line links to where it is ruled out.

### Execution and state

- No scheduler, dispatcher, journal, lock or round controller; DEVAI never knows a task is running
  ([D-018](../../decisions.md), [01](../framework/01-charter.md), [02 §13](../framework/02-architecture.md)).
- No governance state: no scorecard, campaign status or round lifecycle ([D-005](../../decisions.md),
  [02 §13](../framework/02-architecture.md)).
- No status, assignee, run id or timestamp in a packet; no `depends-on` schedule, only `after` checked at
  acceptance ([05 §2, §8](../framework/05-task-packet.md)).
- No DEVAI database, plugin system, config DSL, task queue or web UI ([07 §7](../framework/07-dependencies.md),
  [08 Part D](../framework/08-cli-and-nodes.md)).
- No state beyond the table in [02 §11](../framework/02-architecture.md); no v2 `record/`, `.devai/state/` or
  `work/rounds/` ([04 §5](../framework/04-layout.md)).
- No memory-file instructions; native memory is the agent's own ([10 §6](../framework/10-agent-surface.md),
  [02 §11](../framework/02-architecture.md)).

### Evidence and authority

- No evidence chain, signed receipts or attestations beyond CI verifying `report.json` and `review.json`
  by digest ([D-002](../../decisions.md), [02 §13](../framework/02-architecture.md)).
- No human diff ratification as observation ([D-003](../../decisions.md)).
- No roles, role identities or path admission by signature; one agent identity, and protected paths label
  rather than refuse ([D-019](../../decisions.md), [02 §13](../framework/02-architecture.md)).
- No constitution, standards digest, decision index or architecture summary for agents to read
  ([01](../framework/01-charter.md), [10 §6](../framework/10-agent-surface.md)).
- No turning reviewer opinion or exit 0 into deployment or publication authority
  ([02 §13](../framework/02-architecture.md)).

### Checks

- No waivers: no `review: off`, no per-packet node allowlist, no stored gating flag, no pilot waiver
  ([02 §8](../framework/02-architecture.md), [08 Part D](../framework/08-cli-and-nodes.md)).
- No acceptance through `--only` ([02 §8](../framework/02-architecture.md)).
- No mutation testing in the development cycle ([D-004](../../decisions.md)).
- No runtime enforcement of S-12 ([D-009](../../decisions.md)).
- No SLO measurement inside packet acceptance ([D-038](../../decisions.md)).
- No universal coverage percentage; coverage is acceptance requirements covered ([D-036](../../decisions.md)).
- No retry, model fallback, temperature or tokenizer ([08 Part D](../framework/08-cli-and-nodes.md),
  [D-058](../../decisions.md)).
- No models in CI, and no `UNKNOWN` exemption ([D-037](../../decisions.md), [09 §8](../framework/09-rail.md)).
- No `EXPLAIN` heuristic in `sql-typed` for now ([D-058](../../decisions.md), [08 Part D](../framework/08-cli-and-nodes.md)).
- No interactive prompt in `devai check`: every missing thing is a line with a remedy
  ([08 Part D](../framework/08-cli-and-nodes.md)).

### Commands and output

- No `devai doctor` (preflight is a phase of `check`), no `devai new app` (the template is `devai init`), no
  `--staged`, `--since-ref` or `--strict` ([08 A.6, Part D](../framework/08-cli-and-nodes.md)).
- No colour, TTY detection or second report format; text and JSON only ([D-057](../../decisions.md),
  [08 Part D](../framework/08-cli-and-nodes.md)).

### Rail

- No CRUD beyond declared routes, queries and tables, and no plausible service bodies
  ([09 §8](../framework/09-rail.md), [02 §7](../framework/02-architecture.md)).
- No acceptance-test skeleton from the generator ([09 §2, §8](../framework/09-rail.md)).
- No three-way merge assistant for seeds, no rewrite of applied migrations, no diff-migration generator
  ([D-033](../../decisions.md), [09 §8](../framework/09-rail.md)).
- No generator edits of app shells; it prints mount lines instead ([09 §2, §8](../framework/09-rail.md)).
- No admin UI, auth implementation, ORM, GraphQL, or i18n extraction tool ([09 §8](../framework/09-rail.md),
  [07 §7](../framework/07-dependencies.md)).
- No example module other than `demo`, and no template variant per product or locale
  ([09 §8](../framework/09-rail.md)).
- No `CONTRIBUTING.md`, `seed.sh` or content-free folders in the template ([09 §1.1](../framework/09-rail.md)).

### Dependencies

- No Ajv (zod is the only validator), no Husky (`core.hooksPath`), no runtime pin file, no tsx or ts-node,
  no isomorphic-git, no provider SDK, no OpenTelemetry requirement (and no ban either)
  ([07 §1, §7](../framework/07-dependencies.md), [D-056](../../decisions.md), [D-057](../../decisions.md)).
- No vendored or re-expressed STYNX lint, tsconfig or migration linter ([D-029](../../decisions.md)).
- No CommonJS output and no `any` ([D-012](../../decisions.md), [D-013](../../decisions.md)).

### Agent surface

- No persona, role or tone lines; no per-model or per-harness variant of any text; no `.codex/` folder and
  no `.claude/settings.json` ([10 §6](../framework/10-agent-surface.md)).
- No workflow prose that a node already enforces ([10 §6](../framework/10-agent-surface.md)).
- No skill for the reviewer or the sensor; they receive stdin prompts with tools restricted
  ([10 §6](../framework/10-agent-surface.md)).
- No subagent, worktree, sandbox, memory or MCP management; those are the harnesses'
  ([01](../framework/01-charter.md), [02 §13](../framework/02-architecture.md)).

## Still open

The law keeps a short list of items it has not closed and that do not block 3.0.0
([decisions.md](../../decisions.md), "Open"): packet granularity ([D-026](../../decisions.md), provisional),
the edit-loop service level ([D-047](../../decisions.md), provisional), mutation testing's home
([D-004](../../decisions.md)), the `EXPLAIN` cardinality heuristic ([D-058](../../decisions.md)), and a STYNX-side
item: STYNX's local release candidate runs PostgreSQL 18 while its CI and DEVAI pin 16 ([D-069](../../decisions.md)).

Source: [D-055](../../decisions.md), [00](../framework/00-intent.md), [01](../framework/01-charter.md),
[02](../framework/02-architecture.md), [04](../framework/04-layout.md), [05](../framework/05-task-packet.md),
[07](../framework/07-dependencies.md), [08](../framework/08-cli-and-nodes.md), [09](../framework/09-rail.md),
[10](../framework/10-agent-surface.md).
