---
title: Reading order
sidebar_position: 4
description: Suggested paths through the DEVAI 3 documentation for pilots, product engineers, coding agents, adopters and DEVAI developers.
---

# Reading order

Read only what your role in the work needs. Each path starts small and ends at the binding text.

## Pilot (architect or engineer who owns intent and specs)

You state business rules, approve technical specs and read the error state
([01](../framework/01-charter.md)).

1. [What is DEVAI?](what-is-devai.md) and [Concepts at a glance](concepts-at-a-glance.md)
2. [The loop](../theory/the-loop.md) — what happens between your intent and a merge
3. [Writing a spec](../guides/writing-a-spec.md) — and how approval works
4. [Review and dispositions](../guides/review-and-dispositions.md) — the rare decisions that are yours
5. [Restraint](../theory/restraint.md) — what DEVAI deliberately does not do
6. Law: [01 Charter](../framework/01-charter.md), then [06 Spec format](../framework/06-spec-format.md)

## Product engineer

1. [Quickstart](quickstart.md)
2. [Packets and campaigns](../guides/packets-and-campaigns.md)
3. [Edit loop and hooks](../guides/edit-loop-and-hooks.md)
4. [The check graph](../theory/check-graph.md) — what each status means and why `UNKNOWN` is not `PASS`
5. [Troubleshooting](../guides/troubleshooting.md) and the [reason codes](../reference/reason-codes.md)
6. Law: [05 Task packet](../framework/05-task-packet.md), then [08 CLI and nodes](../framework/08-cli-and-nodes.md)

## Coding agent operator

An agent's mandatory reading is deliberately small: `AGENTS.md`, the packet, the spec, the skill it is
invoked with, the module `README.md` and the check report ([02 §10](../framework/02-architecture.md),
[10](../framework/10-agent-surface.md)). There is no constitution or standards document to load; each
finding carries its standard id and a hint ([02 §10](../framework/02-architecture.md)).

1. [Rail and harness](../theory/rail-and-harness.md) — what the harness owns and what DEVAI owns
2. [Review and sensor](../theory/review-and-sensor.md) — why the reviewer is the other model family
3. Law: [10 Agent surface](../framework/10-agent-surface.md) for the exact shipped texts

## Adopter (sets up a product repository)

1. [Install](../adopters/install.md), then [Configuration](../adopters/configuration.md)
2. [CI](../adopters/ci.md) and [Protected paths](../adopters/protected-paths.md)
3. [Moving from v2](../adopters/moving-from-v2.md) if you run DEVAI 2 today
4. [DEVAI and STYNX](../theory/stynx.md)
5. Law: [04 Layout](../framework/04-layout.md), [09 Rail](../framework/09-rail.md), [07 Dependencies](../framework/07-dependencies.md)

## DEVAI developer

1. [Repository](../dev/repository.md) and [Building and testing](../dev/building-and-testing.md)
2. [Changing the law](../dev/changing-the-law.md) — every change goes through `decisions.md`
3. [Restraint](../theory/restraint.md) — the second-system brake ([D-055](../../decisions.md))
4. Law: all of [docs/framework](../framework/00-intent.md) in number order, with [decisions.md](../../decisions.md)

## Everyone, for exact answers

The [Reference](../reference/index.md) section: [CLI](../reference/cli.md), [nodes](../reference/nodes.md),
[`devai.json`](../reference/devai-json.md), [glossary](../reference/glossary.md),
[decisions](../reference/decisions.md).

Source: [01](../framework/01-charter.md), [02](../framework/02-architecture.md), [10](../framework/10-agent-surface.md).
