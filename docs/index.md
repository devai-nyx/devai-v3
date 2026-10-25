---
title: DEVAI 3
sidebar_position: 1
description: What DEVAI 3 is, who each part of this site is for, and where the binding specification lives.
---

# DEVAI 3

DEVAI 3 is a rail and a harness for building NestJS / Angular / PostgreSQL applications in one
monorepo with frontier coding agents, to company standards ([01](framework/01-charter.md),
[D-006](../decisions.md)). The rail is a template, a module generator and a few helpers that make the
standard-conforming change the easiest one to produce; the harness is one local command, `devai check`,
whose report says whether the current change is inside the standards and meets its spec
([01](framework/01-charter.md)). A task packet is accepted when `devai check --packet <p> --full` exits
0, and that is the only acceptance rule ([01](framework/01-charter.md), [02 §8](framework/02-architecture.md)).

## Who each section is for

| Section | For | Start with |
|---|---|---|
| [Start](start/index.md) | Anyone new to DEVAI 3: what it is, a first run, the vocabulary | [What is DEVAI?](start/what-is-devai.md) |
| [Theory](theory/index.md) | Pilots and architects who want to know why it is shaped this way | [Rail and harness](theory/rail-and-harness.md) |
| [Guides](guides/index.md) | Product engineers and their coding agents doing the work: specs, packets, tests, code, review | [Packets and campaigns](guides/packets-and-campaigns.md) |
| [Adopters](adopters/index.md) | Whoever sets up a product repository: install, `devai.json`, CI, protected paths, moving from v2 | [Install](adopters/install.md) |
| [Reference](reference/index.md) | Everyone, when you need the exact command, node, field or reason code | [CLI](reference/cli.md) |
| [Developing DEVAI](dev/index.md) | People who work on DEVAI itself and on its law | [Repository](dev/repository.md) |

The [reading order](start/reading-order.md) page suggests a path through the site for each audience.

## Where the law lives

This site explains and routes. The binding text is the framework specification under
[`docs/framework/`](framework/00-intent.md) (documents 00 to 10) and the decision log
[`decisions.md`](../decisions.md) (D-001 onward). Only entries in `decisions.md` bind later
documents ([decisions.md](../decisions.md)). When a page here and the framework disagree, the framework
is right and the page is a defect.

| Document | Subject |
|---|---|
| [00 Intent](framework/00-intent.md) | The author's own words; the setpoint for everything else |
| [01 Charter](framework/01-charter.md) | What v3 is and is not, the loop, what the pilot does |
| [02 Architecture](framework/02-architecture.md) | Components, the check DAG, acceptance, reviewer, state |
| [03 Standards](framework/03-standards.md) · [03b STYNX extraction](framework/03b-stynx-extraction.md) | The company standards and what STYNX already enforces |
| [04 Layout](framework/04-layout.md) | Repository and module layout |
| [05 Task packet](framework/05-task-packet.md) · [06 Spec format](framework/06-spec-format.md) | The two file formats |
| [07 Dependencies](framework/07-dependencies.md) | Runtime and dependency choices |
| [08 CLI and nodes](framework/08-cli-and-nodes.md) | Every command and the 28 node contracts |
| [09 Rail](framework/09-rail.md) | Template, generator, the shipped `demo` fixture |
| [10 Agent surface](framework/10-agent-surface.md) | `AGENTS.md`, skills, prompts, messages |

Source: [01](framework/01-charter.md), [02](framework/02-architecture.md), [decisions.md](../decisions.md).
