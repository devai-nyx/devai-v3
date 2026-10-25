---
title: What is DEVAI?
sidebar_position: 2
description: DEVAI 3 in one page — a rail and a harness for agent-built NestJS / Angular / PostgreSQL products, with one acceptance rule.
---

# What is DEVAI?

DEVAI exists so that frontier coding agents (Claude Code, Codex) can build company products — NestJS
backends over PostgreSQL behind Angular web apps — while the company standards hold, and so that the
person steering the work spends attention on intent, rules and specs rather than on administration
([00](../framework/00-intent.md)). The author describes it as "something between a rail and a harness.
More a helpful hand than a strict auditor" ([00](../framework/00-intent.md)).

## The rail

The rail is what makes the standard-conforming change the easiest change to produce
([01](../framework/01-charter.md), [D-006](../../decisions.md)):

- a **template**, `devai init`, that writes a repository already in the standard layout, with
  configuration, hooks, a CI Action, an agent guide and a worked example ([02 §1](../framework/02-architecture.md),
  [09 §1](../framework/09-rail.md));
- a **module generator**, `devai new module --spec`, that turns one approved technical spec into one
  module with its routes, validation, typed queries, row-level security and contract decorators already
  in place ([02 §7](../framework/02-architecture.md), [09 §2](../framework/09-rail.md));
- **helpers**: three route decorators (`@ErrorContract`, `@UseCase`, `@Slo`) and a typed-query contract
  (`defineQuery`, `run`) that STYNX implements ([02 §1](../framework/02-architecture.md), [D-030](../../decisions.md)).

## The harness

The harness is one local command, `devai check`. Its report says whether the current change is inside
the standards and meets its spec, and it is meant to be fast enough to run after every edit
([01](../framework/01-charter.md), [D-005](../../decisions.md)). Underneath, it runs a fixed graph of 28
check nodes — format, lint, typecheck, layout, SQL checks, route contracts, tests, an agentic
permissions check and an independent reviewer — and every finding carries a locator, a standard id and
a one-line hint ([02 §2](../framework/02-architecture.md), [08](../framework/08-cli-and-nodes.md)).

## Two file formats, one rule

DEVAI defines exactly two file formats ([01](../framework/01-charter.md)):

- the **technical spec** (`specs/…/SPEC-*.md`): the setpoint, derived from business rules in
  `product/`, approved by the pilot and then frozen by digest ([06](../framework/06-spec-format.md));
- the **task packet** (`packets/<CMP>/PKT-*.md`): one task's intent, scope and acceptance
  ([05](../framework/05-task-packet.md)).

And one acceptance rule: a packet is accepted when `devai check --packet <p> --full` exits 0. The
independent review is a node inside that command, not a second condition
([01](../framework/01-charter.md), [02 §8](../framework/02-architecture.md)).

## What the pilot does, and is never asked

You state intent and business rules in `product/`, approve technical specs by annotation in the spec
file, and read the error state: PR summary, labels, reviewer findings ([01](../framework/01-charter.md)).
You are never asked for permission to run a check, commit, push, widen a boundary, bypass a hook, re-pin
a digest or ratify a diff; if DEVAI ever asks, that is a defect in DEVAI ([01](../framework/01-charter.md)).
Approval records intent; it never turns a failing check green ([01](../framework/01-charter.md)).

## What DEVAI is not

It is not a scheduler, dispatcher, journal or round controller: the harnesses execute tasks, and DEVAI
only knows whether a result passes ([D-018](../../decisions.md)). It keeps no evidence chain or
attestations ([D-002](../../decisions.md)), has no roles that refuse writes by identity
([D-003](../../decisions.md), [D-019](../../decisions.md)), and does not replace STYNX tooling — it
invokes the published STYNX packages where they enforce a standard ([D-029](../../decisions.md)).
Subagents, worktrees, sandboxes, memory, skills and MCP belong to the harnesses
([01](../framework/01-charter.md)).

## Relation to v2

v3 is a ground-up build from a new specification; v2 is reference material, not a codebase to prune
([D-001](../../decisions.md), [00](../framework/00-intent.md)). The v2 roles, scorecard, evidence signing
and round machinery are absent by decision ([D-002](../../decisions.md), [D-005](../../decisions.md),
[D-018](../../decisions.md), [D-019](../../decisions.md)).

Next: the [quickstart](quickstart.md), or the [theory](../theory/index.md) behind these choices.

Source: [00](../framework/00-intent.md), [01](../framework/01-charter.md), [02](../framework/02-architecture.md),
[05](../framework/05-task-packet.md), [06](../framework/06-spec-format.md), [decisions.md](../../decisions.md).
