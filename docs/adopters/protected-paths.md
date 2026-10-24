---
title: Protected paths
sidebar_position: 5
description: The seven protected classes, the labels they produce, and how they differ from a packet's path scope.
---

# Protected paths

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

Some paths carry intent rather than implementation: specs, business rules, decisions, standards,
infrastructure, CI and acceptance tests. DEVAI 3 makes a touch to them **visible**. It never refuses
it. A hook prints a notice, the Action labels the PR, and an unplanned touch makes the independent
review mandatory ([D-019](../../decisions.md), [02 §5](../framework/02-architecture.md)).

## The seven classes

The template default, written into `devai.json` `protected` ([02 §5](../framework/02-architecture.md),
[09 §1.1](../framework/09-rail.md)):

| Class | Globs | Label |
|---|---|---|
| `spec` | `specs/**`, `packets/**` | `protected:spec` |
| `product` | `product/**` | `protected:product` |
| `decisions` | `decisions.md`, `law/**` | `protected:decisions` |
| `standards` | `tools/**`, `eslint.config.*`, `tsconfig*.json`, `devai.json`, `.stynxrc.json`, `AGENTS.md`, `CLAUDE.md`, `.agents/**`, `.claude/skills/**` | `protected:standards` |
| `infra` | `infra/**`, `database/ddl/**`, `database/migrations/**`, `compose.yaml` | `protected:infra` |
| `ci` | `.github/**`, `scripts/**` | `protected:ci` |
| `acceptance` | `domain/*/api/test/acceptance/**`, `test/**` | `protected:acceptance` |

`database/migrations/**` is part of `infra`, not a class of its own; a schema change is made visible
by the migration linter's report, not by a label ([D-046](../../decisions.md)). The label set is these
seven plus `protected:unplanned`.

You may edit the globs per repository. Each class must keep at least one repo-relative gitignore
glob, without braces ([08 A.8](../framework/08-cli-and-nodes.md)). Editing them is itself a
`protected:standards` change.

## How a touch is detected

The comparison covers **old and new paths**: `git diff --name-only --no-renames <base>..HEAD`
intersected with the globs, plus working-tree adds, deletes and untracked files. A rename out of a
class therefore cannot hide the touch ([02 §5](../framework/02-architecture.md),
[08 B.25](../framework/08-cli-and-nodes.md)). Matching uses `ignore` 7.0.5, gitignore semantics
([D-057](../../decisions.md)).

| Where | What happens |
|---|---|
| Pre-push hook | One notice line per class touched, e.g. `protected:infra — database/ddl/21-est-rls.sql (packet declares: yes)`. It never exits non-zero for this reason |
| `devai check` | The `protected-paths` node reports `PASS` once every changed path is classified; touched classes go to `details.touched` with `declared: true/false`. If the base is not fetched it is `UNKNOWN: base-unreadable` (remedy: `git fetch origin`) |
| PR (Action) | Applies the class labels, reconciles only its own labels, and adds `protected:unplanned` when the packet's `protected:` field does not list a touched class. A labelling API failure is its own visible line, never a gate |

([02 §5](../framework/02-architecture.md), [08 B.25](../framework/08-cli-and-nodes.md),
[10 §4](../framework/10-agent-surface.md))

## Declared and unplanned

Each packet lists the classes it *plans* to touch in `protected:` (may be `[]`). The pilot writes
this field ([05 §2](../framework/05-task-packet.md)), and it is read **as of the packet's introducing
commit**: widening it inside the branch does not declare the class for that PR ([D-078](../../decisions.md)). Rule PL-08 compares it with what was touched and
prints, for example,
`protected:acceptance — domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts (packet declares: no)`
([05 §5](../framework/05-task-packet.md)).

An undeclared class has one consequence: `protected:unplanned` makes `review` **gating** for that PR,
even while `review.mustRun` is still `false` in the shadow period. It is the one case where the
pilot's attention is explicitly requested. It is still not a refusal
([02 §5](../framework/02-architecture.md), [D-028](../../decisions.md),
[08 B.27](../framework/08-cli-and-nodes.md)).

Some touches are routine and expected. Committing or amending a packet, adding a review disposition,
and advancing `base` with `devai packet rebase` all touch `packets/**` and carry `protected:spec`.
That label is the packet's whole audit trail ([05 §4](../framework/05-task-packet.md),
[02 §11](../framework/02-architecture.md)).

## Protected classes are not scope

Do not confuse protected classes with a packet's scope. They answer different questions:

| | Protected classes | Packet scope (`paths.allowed` / `paths.forbidden`) |
|---|---|---|
| Defined in | `devai.json`, per repository | each packet, per task |
| Question | Did this change touch intent? | Did this change stay inside its task? |
| Node | `protected-paths` (notice, label) | `packet-scope` |
| Outcome | Label; `review` gates if undeclared | `FAIL` (PL-07) for a path outside `allowed` or inside `forbidden` |

In a packet, `forbidden` wins inside `allowed`: the change set must be a subset of `allowed` and must
not intersect `forbidden` ([D-052](../../decisions.md), [08 B.26](../framework/08-cli-and-nodes.md)).
The agent widens scope by editing the packet's `paths.allowed`, which is itself a visible
`protected:spec` amendment ([05 §4](../framework/05-task-packet.md)). One scope rule is fixed in the
law: `generation-manifest.json` may change only in a `generate` packet
([02 §7](../framework/02-architecture.md), PL-07).

## What DEVAI does not do

It does not refuse commits by identity or role, admit paths by signature, or ask the pilot for
permission to touch a path ([D-019](../../decisions.md), [02 §13](../framework/02-architecture.md),
[01](../framework/01-charter.md)).

Source: 01, 02 §5, §7, §11, §13, 05 §2–§5, 08 A.8, B.25–B.27, 09 §1.1, 10 §4, decisions D-019, D-028, D-046, D-052, D-057.
