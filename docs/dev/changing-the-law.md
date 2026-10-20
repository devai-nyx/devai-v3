---
title: Changing the law
sidebar_position: 5
description: How decisions are recorded in decisions.md, how framework documents change, and the second-system brake every change must pass.
---

# Changing the law

The law of DEVAI 3 is `decisions.md` and `docs/framework/`. Everything else in this repository,
including these docs pages, explains or implements it and never overrides it. This page covers how
the law changes.

## The authority order

1. **`00-intent.md`** is the author's own words and the setpoint for every other document. Drafts
   that contradict it are wrong, and only the Owner (Antonio) changes it
   ([00](../framework/00-intent.md)).
2. **`decisions.md`** binds later drafts. A draft document is not a decision; only entries there bind
   ([decisions.md](../../decisions.md), header).
3. **`docs/framework/01…10`** are the law and the specification, written under the decisions they
   cite.

## A decision entry

From the header of [decisions.md](../../decisions.md):

- One entry per decision, **numbered** (`D-nnn`, next free number) and **dated**.
- The heading is `## D-nnn · YYYY-MM-DD · <title>`.
- The body states the **options considered** and **what was chosen**, then the **source**: the Owner,
  an Owner panel, or an orchestrator ruling the Owner adopted. "Owner" means Antonio.
- Entries are never deleted. A replaced entry stays, marked `superseded by D-nnn`; a partial
  replacement says so in the new entry (D-064 "Supersedes D-059's digest").
- Provisional decisions are labelled and listed under `## Open` at the end of the file, with what
  will close them (D-026, D-047).

Look at [D-068](../../decisions.md) for a recent example: what was run, the options for the one
ruling that needed a choice, the option chosen and why, the evidence location, and the source line.

Who decides: binding choices are the Owner's. Many entries record orchestrator or consolidation
rulings that the Owner adopted ("adopt all and apply", [D-065](../../decisions.md)), and D-070 records
one taken "under the Owner's standing authorisation". Agents draft entries; what each entry names as
its source is what makes it binding. (In an adopter's own `decisions.md` the rule is simpler: agents
may draft, and the pilot's commit is the approval, [02 §11](../framework/02-architecture.md),
[D-031](../../decisions.md).)

## Changing a framework document

The law writes down no separate amendment procedure for `docs/framework/`. What it does say is that
only `decisions.md` entries bind later drafts, so a change of meaning in a framework document needs
a decision behind it ([decisions.md](../../decisions.md), header). The history since the seed shows
the practice: one commit adds the decision and amends the documents it touches, for example
`docs(framework): R2 passed; sql-typed describes through a pg Submittable (D-068)`, which amended
08 B.10.

Keep cross-references intact. Documents cite each other by document and section (`08 B.10`, `02 §5`)
and by decision number. That is why all twelve documents crossed into the repository unchanged
rather than reworded (12 §2, bootstrap history).

Merge goes through the ordinary PR flow ([Contributing](contributing.md)): a green `build`, and no
required human review of the diff ([D-003](../../decisions.md)). The pilot's attention goes to the
decision itself, its options and its choice, not to the diff.

## The second-system brake

v2 was the second system; v3 is built under restraint ([D-055](../../decisions.md)). Every proposed
change must pass these rules:

- An element exists only if a named v3 mechanism depends on it.
- No new node, state, command, file or field unless 02, 05 or 06 already requires it.
- Prefer what STYNX already uses.
- Every document carries a "what we are not building" section.

Each framework document applies the brake in its own section 0 or closing list: for example 08's
Part D ("No plugin or node registry", "No per-packet node allowlist, no `review: off`, no waiver")
and 09 §8 ([08 Part D](../framework/08-cli-and-nodes.md), [09 §8](../framework/09-rail.md)). The node
set is a closed enum of 28: a new node is a new line in 02 §2 and a decision, not a drop-in file
([08 Part D](../framework/08-cli-and-nodes.md), [D-045](../../decisions.md)).

Some decisions are hard limits that a later decision would have to supersede explicitly:

| Never | Decision |
|---|---|
| Signing, attestation or evidence custody beyond what CI needs | [D-002](../../decisions.md) |
| Human diff ratification as a control | [D-003](../../decisions.md) |
| Mutation testing as a delivery gate | [D-004](../../decisions.md) |
| A scheduler, journal, lock or round controller | [D-018](../../decisions.md) |
| Role identities or refusal by signature | [D-019](../../decisions.md) |
| Executable configuration | [D-034](../../decisions.md) |

## The docs are not the law

These pages route to the law and must never add, relax or contradict it. If a page and a framework
document disagree, the framework document wins and the page is the defect. If you find the law silent
or ambiguous while writing code or docs, raise it for a decision entry rather than settling it in
prose: only entries bind ([decisions.md](../../decisions.md), header).

## Bootstrap history

Documents 11 (STYNX migration items and the v2 law ledger) and 12 (the succession plan) are bootstrap
history. They stay outside this repository and are never edited again
([D-066](../../decisions.md)).

Source: 00, 02 §11, 08 Part D, 09 §8, decisions header, D-002–D-004, D-018, D-019, D-031, D-034, D-045, D-055, D-064–D-066, D-068, D-070; 12 §2 (bootstrap history); git history at HEAD.
