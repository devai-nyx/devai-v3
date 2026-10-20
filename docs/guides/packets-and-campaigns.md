---
title: Packets and campaigns
sidebar_position: 3
description: The six packet kinds, what a packet contains, who writes each field, and how a packet's state is derived from git.
---

# Packets and campaigns

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

A **packet** is one task's intent, scope and acceptance, frozen at a `base` commit. It is one
Markdown file under `packets/<CMP>/`, the only input to `devai check --packet <p>`, and it carries
no execution state: no status, assignee, run id or timestamp
([05 §1](../framework/05-task-packet.md), [D-018](../../decisions.md)). A **campaign** is the folder
that holds one feature's packets plus `campaign.md` ([02 §11](../framework/02-architecture.md)).

Packet granularity by `kind:` is **provisional** ([D-026](../../decisions.md)): it is confirmed or
changed after the first DETRAN module is built this way.

## The six kinds

A feature is a few packets in dependency order. The packet is the unit of acceptance; the PR is the
unit of merge ([D-026](../../decisions.md)).

| `kind` | Delivers | Demo packet |
|---|---|---|
| `spec` | `specs/…/SPEC-*.md` at `draft` or `approved` | `PKT-DEMO-001` |
| `generate` | `domain/<m>/**` from the spec, `generation-manifest.json`, the seed-manifest entry | `PKT-DEMO-002` |
| `test` | The acceptance file, one `it('R-n: …')` per acceptance requirement | `PKT-DEMO-003` |
| `code` | Seed files under `domain/<m>/{api,web}/src/**`, new migrations under `domain/<m>/db/` | `PKT-DEMO-004` |
| `fix` | A correction against the **unchanged** spec; same shape as `code` | — |
| `standards` | Tooling and configuration: `tools/**`, `devai.json`, `.github/**`, `AGENTS.md`, … | — |

The kind selects the **required set** of nodes that must `PASS`. A required node that comes back
`SKIPPED` fails acceptance, because for that kind an empty population means the deliverable is
missing ([05 §3](../framework/05-task-packet.md), PL-15). The packet never lists nodes; it cannot
shrink its own acceptance.

## What goes in a packet

One closed YAML front-matter block (unknown keys are rejected) and named sections. The main fields
([05 §2](../framework/05-task-packet.md)):

| Field | Meaning |
|---|---|
| `id` | `PKT-<PRODUCT>-<nnn>`, equal to the file stem ([D-050](../../decisions.md)) |
| `kind`, `title` | The kind; an imperative one-line title |
| `spec.{id,path,sha256}` | The pinned setpoint; `sha256` is the spec's bytes at `base` |
| `base` | The commit the candidate diff starts from; it may advance, never move back |
| `after` | Packets whose `Packet:` trailer must already be in `base`'s history |
| `paths.allowed` / `paths.forbidden` | What may change; `forbidden` wins inside `allowed` ([D-052](../../decisions.md)) |
| `protected` | Protected classes the packet plans to touch; may be `[]` |
| `context[]` | ≤ 8 pointers of ≤ 40 lines, ≤ 200 lines in all; never the spec itself |
| `observations.unimplemented` | Expected-red `R-n` ids; non-empty only for `kind: test` ([D-051](../../decisions.md)) |

Sections, in order: `## Intent` (≤ 5 lines), `## Deliverables`, optional `## Notes` and
`## Review dispositions`. The whole packet is at most 200 lines (PL-14).

From the demo `code` packet:

```yaml
paths:
  allowed:
    - domain/notes/api/src/**
    - domain/notes/api/test/*.spec.ts
    - packets/CMP-DEMO-001/PKT-DEMO-004.md
```

`paths.allowed` always lists the packet's own path, because amendments and dispositions edit it
(PL-06).

## Who writes what

- **You:** `title`, `## Intent`, `protected`, and dispositions; `accepted-risk` is yours alone.
- **The spec agent, drafting a campaign:** proposes `paths.*`, `context`, `## Deliverables` and, for
  a `test` packet, `observations.unimplemented` from the spec's `unimplemented[]`.
- **`devai packet new`:** renders `id`, `spec.sha256`, `base`, the packet's own path and the default
  globs for the kind.
- **The coding agent:** may amend `paths.allowed`, `context`, `base` (forward only) and `## Notes`,
  and may write a `not-a-defect` disposition.

([05 §2](../framework/05-task-packet.md), [02 §10](../framework/02-architecture.md))

Render a new packet with:

```sh
devai packet new --kind code --spec specs/notes/SPEC-DEMO-001.md
devai packet lint packets/CMP-DEMO-001/PKT-DEMO-004.md
```

`new` refuses an unapproved or superseded spec for the pinning kinds. `lint` evaluates every packet
rule that needs no DAG run and prints the others as `deferred`
([08 A.4](../framework/08-cli-and-nodes.md)). Neither commits; you do.

## Sequencing with `after` and `base`

`after` is a precondition checked at acceptance, not a schedule: nothing dispatches on it (PL-12).
A campaign may land as one branch, with `--full` exiting 0 at each packet head. For that, the next
packet's `base` must start where the previous one was accepted, so its diff does not contain the
previous packet's files ([05 §4](../framework/05-task-packet.md)). Advance it with:

```sh
devai packet rebase packets/CMP-DEMO-001/PKT-DEMO-004.md --to <commit>
```

`rebase` succeeds only if the new commit descends from the old `base` and the spec there still
hashes to `spec.sha256` (PL-05).

## Lifecycle, derived from git

| State | Evidence |
|---|---|
| drafted | The file exists only in a working tree |
| frozen | The file is committed and complete; `id`, `kind`, `spec.*`, `supersedes` are now immutable (PL-13) |
| candidate | A commit descending from `base` carries `Packet: <id>` |
| accepted | `--full` exited 0 at head and `.devai/review/<id>.json` bound to that candidate is committed |
| merged | A commit on `main` carries `Packet: <id>` |
| superseded | Another packet carries `supersedes: <id>` (PL-16) |

([05 §4](../framework/05-task-packet.md)) Nothing is ever written back into the packet.
`devai packets status` prints each packet's highest state with its evidence
([08 A.5](../framework/08-cli-and-nodes.md)).

## Changing a packet after it is frozen

| Change | How |
|---|---|
| `paths.*`, `context`, `protected` | Amend the same packet (pilot or agent) |
| A disposition | Amend the same packet; the next `--full` re-checks it |
| `base` | `devai packet rebase` |
| `id`, `kind`, `spec.*`, `supersedes` | A new packet with `supersedes:` the old one |
| The spec | A successor spec and a new packet |
| A wrong acceptance test | A `test` packet with the `@acceptance-change` annotation, never the `code` packet |

Every amendment touches `packets/**` and shows as `protected:spec` on the PR; that label is the
whole audit trail ([05 §4](../framework/05-task-packet.md)).

## What a packet is not

Not a prompt (no model, role, effort or time), not a status record, not a waiver (it cannot disable
a node or accept a red case outside a `test` packet), not a spec (it quotes no business rule), not a
schedule ([05 §8](../framework/05-task-packet.md)).

Source: [02 §10–§11](../framework/02-architecture.md), [05](../framework/05-task-packet.md),
[08 A.4–A.5](../framework/08-cli-and-nodes.md), [D-018, D-026, D-050, D-051, D-052](../../decisions.md).
