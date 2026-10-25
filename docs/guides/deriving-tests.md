---
title: Deriving tests
sidebar_position: 4
description: How a test agent derives acceptance tests from an approved spec before the implementation exists, and how expected red is accepted.
---

# Deriving tests

Acceptance tests are the loop's sensor. They are written by an agent that did not write the code,
from the spec alone, before the implementation exists ([01 Charter](../framework/01-charter.md),
[D-035](../../decisions.md)). Independence comes from derivation source and sequencing, not from
who the agent is. The `test` packet is where this happens; in the demo it is `PKT-DEMO-003`.

## The file

One file per spec, at a path derived from the spec id
([04 §4](../framework/04-layout.md), [D-054](../../decisions.md)):

```
domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts
```

It holds exactly one top-level `it('R-n: <name>', …)` per `acceptance: "yes"` requirement, with as
many assertions inside as the case needs ([06 §5](../framework/06-spec-format.md)). For the fixture
that is six cases, named in its Acceptance notes: `R-1: create-and-read`, `R-2: strict-inputs`,
`R-3: role-boundary`, `R-4: tenant-isolation`, `R-5: input-rejection`, `R-6: rls-visibility`.

`spec-tests` counts them: `expected` is the spec's acceptance requirements, `observed` the tagged
cases it collected. A missing case is `FAIL: uncovered R-n`; a duplicate tag, a tag the spec does not
know, or an untagged top-level `it` is also a finding ([08 B.21](../framework/08-cli-and-nodes.md)).
Acceptance files are excluded from the unit glob ([D-054](../../decisions.md)).

## How the test agent works

The `devai-test` skill sets the rules ([10 §2.3](../framework/10-agent-surface.md)):

- **Derive from the spec only.** Never open the module's `src/` or seed files, unit specs included.
  Generated code never supplies an expected value.
- **Build each case from the requirement.** Inputs and assertions come from the `observable`; the
  `falsifier` must fail the case.
- **Get the database from the `@stynx-nyx/testing` helpers.** Never start Docker or testcontainers;
  the runtime resolver supplies PostgreSQL in either mode ([02 §6](../framework/02-architecture.md)).
- **Observe isolation as `<product>_app`** (`demo_app` here), never as the owner role, which
  bypasses RLS ([S-18](../framework/03-standards.md)).

The packet keeps the agent out of the implementation: `PKT-DEMO-003` allows only
`domain/notes/api/test/acceptance/**` and its own path, and forbids `domain/notes/api/src/**`
([05 §3](../framework/05-task-packet.md)). It declares `protected: [acceptance, spec]`.

## Expected red

When the tests are written, the business behaviour does not exist yet, so some cases must fail.
That is the `test` packet's job to record, and only the `test` packet's
([D-051](../../decisions.md), [02 §8](../framework/02-architecture.md)).

The packet names the cases:

```yaml
observations:
  unimplemented: [R-1, R-2, R-4]
```

Each id must be an acceptance requirement listed in the spec's `unimplemented[]` (PL-11). The
runner then applies expected red to exactly those cases ([05 §3](../framework/05-task-packet.md)):

1. Collection, imports, app start-up and database setup must succeed.
2. Each named case must reach its behavioural assertion and fail **there**.
3. Every other case, including rail behaviour (R-3, R-5, R-6), must pass.

A green line reads `PASS spec-tests expected 6, observed 6, expect-red 3 (R-1, R-2, R-4)`. The
`--expect-red` flag is optional: it restates what the packet already selects and must agree with it
([08 A.3](../framework/08-cli-and-nodes.md)).

### Rules that make expected red work

- **A named case carries no rail assertion.** The adapter only knows that a case failed at an
  `expect` inside its `it` body; it relies on the spec keeping 401/403, isolation and DTO validation
  in their own requirements ([D-058](../../decisions.md), [08 C.5](../framework/08-cli-and-nodes.md)).
- **Fail at an `expect`, not before it.** Seed the case's data with SQL, not through routes that are
  not built yet. A named case that fails in its arrange step is `UNKNOWN: expect-red-not-reached`
  ([10 §4](../framework/10-agent-surface.md)).
- **Fail through `expect()`.** A throw without a source-mapped `AssertionError` cannot be classified:
  `UNKNOWN: assertion-unresolved`.
- **A named case that passes is a `FAIL`.** Either the behaviour already exists or the case is
  vacuous ([08 B.21](../framework/08-cli-and-nodes.md)).
- **A frozen `R-n` that mixes rail and business assertions is a spec defect.** Note it under
  `## Notes` and stop; never drop an assertion to make it fit
  ([10 §2.3](../framework/10-agent-surface.md)).

Outside a `test` packet the list is empty and is never edited
([10 §2.1](../framework/10-agent-surface.md), PL-03).

## Running it

```sh
devai check --packet packets/CMP-DEMO-001/PKT-DEMO-003.md
devai check --packet packets/CMP-DEMO-001/PKT-DEMO-003.md --full
```

The `test` kind requires `spec-tests`, `test-integrity`, `lint-tests`, `typecheck` and `db-apply`
to pass ([05 §3](../framework/05-task-packet.md)). If `after: [PKT-DEMO-002]` is not yet in `base`'s
history, advance `base` with `devai packet rebase` first
([05 §4](../framework/05-task-packet.md)).

## Re-deriving when the implementation already exists

When tests must be re-derived after the code exists, the test agent works in a **sparse worktree** with the module's `mode: seed` files
and its `api/src/` and `web/src/` physically absent ([D-035](../../decisions.md)). The `devai-test`
skill ships the exact `git worktree` / `git sparse-checkout` commands, including a
`test ! -e domain/<m>/api/src` absence check ([10 §2.3](../framework/10-agent-surface.md)). There is
no self-reported independence.

## Changing an acceptance test

Acceptance files are `protected:acceptance`. A base-present acceptance file may change only in a
`test` packet, and the head file must carry `// @acceptance-change: approved-by=<pilot>`. **You**
write that annotation ([D-016](../../decisions.md), [10 §2.3](../framework/10-agent-surface.md)).
`test-integrity` fails any unannotated change, any change at all from another kind, an assertion
count drop below 80 % without the annotation, and any acceptance case that disappears
([08 B.12](../framework/08-cli-and-nodes.md)).

A red acceptance test you did not write is a result, not an obstacle
([10 §1](../framework/10-agent-surface.md)).

Source: [01](../framework/01-charter.md), [02 §6, §8](../framework/02-architecture.md),
[05 §3](../framework/05-task-packet.md), [06 §5, §7](../framework/06-spec-format.md),
[08 B.12, B.21, C.5](../framework/08-cli-and-nodes.md), [10 §2.3, §4](../framework/10-agent-surface.md),
[D-016, D-035, D-051, D-054, D-058](../../decisions.md).
