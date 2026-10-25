---
title: The loop
sidebar_position: 3
description: How a business rule becomes an accepted change in DEVAI 3 — spec, generate, test, code, review, accept — and why the packets come in that order.
---

# The loop

The loop runs at task level. One feature is a short campaign of packets, each a unit of acceptance,
landing through one or more PRs, each a unit of merge ([D-026](../../decisions.md),
[02 §8](../framework/02-architecture.md)). D-026's packet granularity is **provisional**: the first DETRAN
module is built this way, packets, PRs and pilot touches are counted, and then the Owner decides
([D-026](../../decisions.md)).

```text
product/ (business rules, use cases)          pilot: intent, rules
        │ spec packet
        ▼
specs/…/SPEC-*.md  ── pilot approves ──►  setpoint, frozen by digest
        │ generate packet                │ test packet
        ▼                                ▼
domain/<m>/ (rail-built skeleton)   acceptance tests (red where unimplemented)
        │ code packet
        ▼
code ──► devai check --packet <p> --full  (deterministic nodes, spec tests, review)
        │ exit 0
        ▼
PR: labels, summary, review.json ──► pilot reads the dashboard; merge
```

(Adapted from [01](../framework/01-charter.md).)

## 1. Intent: `product/`

The pilot writes business rules and use cases in `product/`; that folder is the pilot's, and DEVAI never
authors or migrates it ([D-008](../../decisions.md), [02 §13](../framework/02-architecture.md)). Use cases
are JSON files, `product/use-cases/*.json` ([06 §3](../framework/06-spec-format.md)).

## 2. `spec` packet: derive the setpoint

A spec agent writes the technical spec at the packet's `spec.path`, as `status: draft`
([10 §2.2](../framework/10-agent-surface.md)). Every `sources[].quote` must be an exact substring of the
cited file, and every requirement with `acceptance: "yes"` needs an `observable` and a `falsifier`
([06 §2, §4](../framework/06-spec-format.md)). Behaviour no source states is an open question, not a
requirement ([10 §2.2](../framework/10-agent-surface.md)). The required node is `spec-lint`
([05 §3](../framework/05-task-packet.md)).

The pilot approves by annotation in the file — `status: approved`, `approved-by:` — in the same PR or
after the merge ([05 §3](../framework/05-task-packet.md), [D-016](../../decisions.md)). Approval needs no
open questions ([06 §1](../framework/06-spec-format.md)). From then on the spec's bytes are fixed: a
packet pins `base` plus the file's sha256, and that pin is what "frozen" means
([D-053](../../decisions.md)).

## 3. `generate` packet: build the skeleton

`devai new module --spec` reads the approved machine block and writes the module: DTOs with zod
validation, contract decorators on every route, typed query definitions, DDL with row-level security,
i18n catalogs and a `generation-manifest.json` ([02 §7](../framework/02-architecture.md),
[09 §2](../framework/09-rail.md)). It does not invent business behaviour; service methods throw
`NotImplementedException` until a `code` packet replaces them ([09 §0](../framework/09-rail.md)). Only a
`generate` packet may change the manifest ([02 §7](../framework/02-architecture.md)).

## 4. `test` packet: derive the sensor before the plant exists

A test agent writes one acceptance file per spec,
`domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`, with exactly one top-level
`it('R-n: …')` per acceptance requirement ([04 §4](../framework/04-layout.md), [06 §5](../framework/06-spec-format.md)).
It derives from the spec only, before the implementation exists — or, later, in a sparse worktree from
which the implementation is physically absent ([D-035](../../decisions.md), [10 §2.3](../framework/10-agent-surface.md)).

This packet is the one place where red is accepted. The cases the packet lists under
`observations.unimplemented` must fail *at their behavioural assertion*, after imports, start-up and
database setup succeed; every other case, including rail behaviour such as guards and tenant
isolation, must pass ([02 §8](../framework/02-architecture.md), [05 §3](../framework/05-task-packet.md)).
That records, mechanically, that the tests can see the missing behaviour; it is not mutation testing
([D-004](../../decisions.md), S-67 in [03](../framework/03-standards.md)).

Independence here comes from **derivation source and sequencing**, not from who the agent is
([01](../framework/01-charter.md), [D-026](../../decisions.md)).

## 5. `code` packet: close the error

The code agent fills the seed files until every acceptance case is green. `code` and `fix` acceptance is
all-green; partial delivery is a smaller spec or a successor packet, never a red case accepted
([D-051](../../decisions.md)). The agent does not edit acceptance tests, `@generated` files, the spec or
the manifest; "a red acceptance test you did not write is a result, not an obstacle"
([05 §6](../framework/05-task-packet.md), [10 §1](../framework/10-agent-surface.md)). A wrong test is
reported under `## Notes`, and a `test` packet corrects it ([05 §4](../framework/05-task-packet.md)).

`fix` is a correction against the unchanged spec, with the same required set as `code`; `standards`
changes tooling and configuration (`tools/**`, `devai.json`, lint and tsconfig files, `.github/**`,
`scripts/**`) and needs no spec ([05 §3](../framework/05-task-packet.md)).

## 6. Review and accept

`devai check --packet <p> --full` runs every applicable node over the diff from the packet's `base`
([02 §8](../framework/02-architecture.md)). Five nodes run for every kind — `inventory`, `packet-scope`,
`protected-paths`, `review`, `accept` — and `accept` derives the rest of the required set from the
`kind`, the spec's machine block and the diff; a required node that comes back `SKIPPED` is a `FAIL`,
because for that kind an empty population means the deliverable is missing
([05 §3](../framework/05-task-packet.md)). The independent reviewer runs only after every deterministic
node and the permissions sensor have passed ([02 §9](../framework/02-architecture.md)); see [Review and sensor](review-and-sensor.md).

Exit 0 is acceptance. The review result is committed at `.devai/review/<packet-id>.json`; nothing is
written to the packet ([05 §4](../framework/05-task-packet.md)). A later commit (other than one that only
adds review evidence) changes the candidate digest and makes the review stale in CI; the agent re-runs
`--full` ([05 §4](../framework/05-task-packet.md)).

## 7. Merge

The PR body is the `--summary` output (at most ten lines), and the Action labels the PR with the
protected classes it touched ([02 §5, §8](../framework/02-architecture.md)). The pilot reads that
dashboard. Acceptance is not merge: merging is the pilot's act or branch protection's
([02 §9](../framework/02-architecture.md), [10 §1](../framework/10-agent-surface.md)). The pilot is not asked
to read the diff ([D-003](../../decisions.md)).

## When the setpoint must change

A business rule that changes is edited in `product/`, then a new `spec` packet writes a successor spec,
and a new packet pins it ([05 §4](../framework/05-task-packet.md)). The successor carries
`supersedes: {id, path, sha256}`; the predecessor's one permitted edit is its status line becoming
`superseded-by: <SpecId>` ([D-053](../../decisions.md)). Old packets keep accepting against what they
pinned; no new packet may pin the superseded spec ([05 §4](../framework/05-task-packet.md)). DEVAI never
executes a mid-task setpoint change ([02 §13](../framework/02-architecture.md)).

Source: [01](../framework/01-charter.md), [02](../framework/02-architecture.md), [05](../framework/05-task-packet.md),
[06](../framework/06-spec-format.md), [09](../framework/09-rail.md), [10](../framework/10-agent-surface.md),
[decisions.md](../../decisions.md).
