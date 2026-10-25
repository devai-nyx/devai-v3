---
title: Concepts at a glance
sidebar_position: 5
description: One paragraph each on the ten ideas DEVAI 3 is built from, with a link to the binding text.
---

# Concepts at a glance

Ten ideas, one paragraph each. The [glossary](../reference/glossary.md) has the short definitions; the
links go to the law.

## Spec

The technical spec is the setpoint: one Markdown file under `specs/<area>-<capability>/` with a few
required prose sections and exactly one YAML machine block under `## Contract`, listing sources,
requirements `R-1…R-n`, routes with their five contract fields, tables, queries, i18n keys and the
requirements whose behaviour the generator does not supply, which a `test` packet may expect red ([06 §1–§2](../framework/06-spec-format.md)). A spec agent
derives it from business rules in `product/`; every `quote` must appear verbatim in the cited source
([06 §2](../framework/06-spec-format.md), [D-048](../../decisions.md)). The pilot approves it by writing
`status: approved` and `approved-by:`; a packet then pins its digest, which is what "frozen" means.
A changed spec is a successor with a new id, never an edit ([D-053](../../decisions.md)).

## Packet

A task packet is one Markdown file under `packets/<CMP>/` stating one task's intent, scope and
acceptance: its `kind`, the pinned spec (path and sha256), the `base` commit, the paths it may change
(`paths.allowed`, with `paths.forbidden` winning inside them), the protected classes it plans to touch
and, for a `test` packet only, the cases expected red ([05 §2](../framework/05-task-packet.md),
[D-052](../../decisions.md)). It carries no status, assignee or timestamp; progress is derived from git
([05 §4](../framework/05-task-packet.md), [D-018](../../decisions.md)). The six kinds are `spec`,
`generate`, `test`, `code`, `fix` and `standards` ([D-026](../../decisions.md), provisional).

## Campaign

A campaign is a folder of packets, `packets/<CMP>/`, with a `campaign.md` naming the goal, the business
sources and the packet ids in order ([05 §7](../framework/05-task-packet.md)). A feature is typically
four or five packets in dependency order ([D-026](../../decisions.md)); a packet's `after:` list is a
precondition checked at acceptance, not a schedule ([05 §2](../framework/05-task-packet.md)). A campaign
may land as one branch whose commits carry `Packet:` trailers, with acceptance at each packet head
([02 §8](../framework/02-architecture.md)). DEVAI keeps no campaign status ([02 §13](../framework/02-architecture.md)).

## Node

A node is one check in the fixed graph that `devai check` runs. There are exactly 28, from `inventory`
(which runs first and decides populations) to `accept` (which aggregates and sets the exit code)
([02 §2](../framework/02-architecture.md), [08 Part B](../framework/08-cli-and-nodes.md)). Each reports
`expected`, `observed` and `evaluated` counts and findings with locator, message, standard id and hint
([08 §0](../framework/08-cli-and-nodes.md)). There is no plugin registry: a new node is a decision
([08 Part D](../framework/08-cli-and-nodes.md)). See [The check graph](../theory/check-graph.md).

## Status

Every node ends in one of four words ([02 §8](../framework/02-architecture.md)): `PASS` (observed, no
findings), `FAIL` (observed, findings), `UNKNOWN` (could not observe) and `SKIPPED` (not applicable,
decided only by `inventory` with evidence, [D-044](../../decisions.md)). A success with zero observations
is rewritten to `UNKNOWN`, and a shortfall against a known expected count is `FAIL`
([08 C.1](../framework/08-cli-and-nodes.md)). The command exits `0`, `1` (a `FAIL`) or `2` (an `UNKNOWN`
and no `FAIL`, or could not run) ([02 §8](../framework/02-architecture.md)).

## Edit loop

`devai check` with no flags is the edit-loop command: a subset of class A and B nodes (format, lint,
typecheck, layout, SQL and spec checks, route contracts, unit tests and a few more) over the current
change, cheap enough to run after every edit ([02 §2](../framework/02-architecture.md),
[D-005](../../decisions.md)). `--packet <p>` adds packet scope and the packet's acceptance tests;
`--packet <p> --full` is the only command that accepts ([02 §8](../framework/02-architecture.md)). The
service level is provisional: a 90-second warm ceiling until the p95 is measured on real modules
([D-047](../../decisions.md)).

## Hooks

`devai init` installs three git hooks under `scripts/hooks/` and points `core.hooksPath` at them; each is
one line calling `devai check --hook pre-commit|pre-push|commit-msg` ([08 A.7](../framework/08-cli-and-nodes.md),
[D-057](../../decisions.md)). Pre-commit checks the staged snapshot, pre-push adds slower deterministic
nodes and prints protected-path notices, and commit-msg runs `commitlint`. The pre-push hook does not run
the reviewer; the protected-path notice never blocks a push ([08 A.7](../framework/08-cli-and-nodes.md),
[02 §5](../framework/02-architecture.md)).

## Review

The `review` node is an independent reviewer: a model of a different family from the one that wrote the
code, run on the pilot's machine inside `--full`, after every deterministic node and the permissions
sensor have passed
([02 §9](../framework/02-architecture.md), [D-037](../../decisions.md)). It first derives the requirement list
from the spec without seeing the candidate, then judges the candidate against it. Its result,
`.devai/review/<packet-id>.json`, travels in the PR and CI only checks its digest. Its `PASS` is never
authorization to merge ([02 §9](../framework/02-architecture.md)). See
[Review and sensor](../theory/review-and-sensor.md).

## Sensor

In DEVAI's control-loop vocabulary the sensors are the spec-derived acceptance tests, the deterministic
standards checks and the independent reviewer; the agent is the controller and the code is the plant
([01](../framework/01-charter.md)). One node is an *agentic* sensor: `permissions-pattern` asks a model a
single fixed question over the permission-checking slice of the code — is authorization decided from the
verified token only, with no database, cache or network call on the request path
([02 §4](../framework/02-architecture.md), [D-009](../../decisions.md), [D-025](../../decisions.md)). A zero
residual means the declared observations succeeded, not that correctness is proved
([01](../framework/01-charter.md)).

## Template and generator

The template is `devai init`: it writes a repository in the standard layout with `devai.json`, the hooks,
the CI Action, `AGENTS.md`, four skills and the `demo` fixture ([09 §1](../framework/09-rail.md)). The
generator is `devai new module --spec <spec>`: from one approved spec it writes one module, where
*generated* files carry a `@generated` header and are byte-verified against the pinned generator, and
*seed* files are written once and then owned by hand ([02 §7](../framework/02-architecture.md),
[D-033](../../decisions.md)). Business behaviour is left as a `NotImplementedException` for a `code`
packet ([09 §0](../framework/09-rail.md)).

Source: [01](../framework/01-charter.md), [02](../framework/02-architecture.md), [05](../framework/05-task-packet.md),
[06](../framework/06-spec-format.md), [08](../framework/08-cli-and-nodes.md), [09](../framework/09-rail.md),
[decisions.md](../../decisions.md).
