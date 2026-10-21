---
title: Reference
sidebar_position: 1
description: Exact, complete reference tables for DEVAI 3's commands, nodes, reason codes, configuration, packet and spec formats, report schema, layout, standards and decisions.
---

# Reference

These pages are lookup tables. Each one restates a part of the law in [`docs/framework/`](../framework/00-intent.md) and [`decisions.md`](../../decisions.md) completely and without adding to it, and states the count of what it lists so you can check it against the source. When a page and the law differ, the law wins.

DEVAI 3.0.0 is unreleased; the CLI, decorators and template land at release prerequisite R6 (12 §4, part of the bootstrap history outside this repository). The pages describe the specified behaviour.

| Page | What it lists | Count | Law |
|---|---|---|---|
| [CLI](./cli.md) | Every command, flag, mode, exit code and hook script | 7 invocations, 20 flags, 3 hooks | [08 Part A](../framework/08-cli-and-nodes.md) |
| [Check nodes](./nodes.md) | Every node contract: standards, placement, population, invocation, statuses, reason codes | 28 nodes | [08 Part B](../framework/08-cli-and-nodes.md), [02 §2](../framework/02-architecture.md) |
| [Reason codes](./reason-codes.md) | Every reason code, where it is raised, its exit and its hint | 54 codes | [08 C.2](../framework/08-cli-and-nodes.md), [10 §4](../framework/10-agent-surface.md) |
| [devai.json](./devai-json.md) | Every configuration key, constraint and template value | 9 top-level keys, 20 key paths | [08 A.8](../framework/08-cli-and-nodes.md) |
| [Packet format](./packet-format.md) | Packet fields, sections, kinds, lifecycle, PL rules | 14 fields, 17 PL rules | [05](../framework/05-task-packet.md) |
| [Spec format](./spec-format.md) | Machine-block fields, use-case artifact, SL rules, statuses | 72 field paths, 12 SL rules | [06](../framework/06-spec-format.md) |
| [report.json](./report-json.md) | Report, node result, finding, details, evidence files, text grammar, digests | 16 + 13 + 4 fields, 8 details variants | [08 C.2–C.6](../framework/08-cli-and-nodes.md) |
| [Repository layout](./layout.md) | Root, module, database, tests, governance, state paths | 7 DDL bands, 9 test tiers | [04](../framework/04-layout.md), [02 §11](../framework/02-architecture.md) |
| [Standards](./standards.md) | Every company standard, one line each, with the nodes that check it | 56 standards | [03 Part A](../framework/03-standards.md) |
| [Glossary](./glossary.md) | The terms the law uses | 53 terms | all |
| [Decisions](./decisions.md) | Every numbered decision with date and title | 71 decisions | [decisions.md](../../decisions.md) |

Source: [docs/framework/00…10](../framework/00-intent.md), [decisions.md](../../decisions.md).
