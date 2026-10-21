---
title: Implementing
sidebar_position: 5
description: How a coding agent works a code or fix packet to acceptance, and why acceptance is all-green.
---

# Implementing

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

A `code` packet implements behaviour the spec requires; a `fix` packet corrects the implementation
against the **unchanged** spec and has the same shape ([05 §3](../framework/05-task-packet.md)). In
the demo, `PKT-DEMO-004` implements R-1, R-2 and R-4 of `SPEC-DEMO-001` and turns the red acceptance
tests from `PKT-DEMO-003` green.

## What the agent reads

The `devai-task` skill lists everything that is required, and nothing else is
([10 §2.1](../framework/10-agent-surface.md)):

1. The packet.
2. The whole pinned spec as it was at `base`: `git show <base>:<spec.path>`.
3. Each `context` range, at `base`.
4. `domain/<m>/README.md`, if present.

Per-task reading beyond spec and packet is budgeted under 3k tokens, so `context` is sized to what
is left ([01 Charter](../framework/01-charter.md), [10 §5](../framework/10-agent-surface.md)). The
demo packet points at two ranges: the rule behind R-2's limits, and the `defineQuery` seeds in
`notes.repository.ts`.

## The loop

```sh
devai check --packet packets/CMP-DEMO-001/PKT-DEMO-004.md          # iterate
devai check --packet packets/CMP-DEMO-001/PKT-DEMO-004.md --full   # accept
```

1. **Iterate** with `--packet`: the edit-loop nodes plus packet scope and the packet's acceptance
   tests. Fix findings top-down and re-run ([10 §2.1](../framework/10-agent-surface.md)).
2. **Stay in scope.** A path you need outside `paths.allowed`: add it there and continue;
   `forbidden` still wins. Nobody is asked; the PR shows the edit as `protected:spec`.
3. **Commit** with the trailers `Packet: <id>` and your `Co-Authored-By:` line. The reviewer is
   chosen from that trailer, so commit **before** `--full`; uncommitted work leaves the reviewer
   `UNKNOWN (family)` ([10 §2.1](../framework/10-agent-surface.md),
   [08 B.27](../framework/08-cli-and-nodes.md)).
4. **Accept** with `--full`. Exit 0 accepts. Then commit the files it wrote under `.devai/review/`
   exactly as written. A commit that only adds those files keeps the candidate digest, so the
   evidence survives being committed ([08 C.4](../framework/08-cli-and-nodes.md)).

Acceptance is not merge. Merging is yours or branch protection's
([10 §1](../framework/10-agent-surface.md)).

## Acceptance is all-green

For `code` and `fix`, `observations.unimplemented` is empty and **every** acceptance case must pass.
Partial delivery is a smaller spec or a successor packet, never a red case accepted
([D-051](../../decisions.md)). The demo packet states it plainly:

```yaml
observations:
  unimplemented: []
```

The `code` kind requires `spec-tests`, `unit`, `lint`, `typecheck`, `db-apply` and
`permissions-pattern` to pass, plus `route-contract` when the spec declares routes and `sql-typed`
when it declares queries ([05 §3](../framework/05-task-packet.md)). A required node that comes back
`SKIPPED` fails acceptance: for example, a spec with routes but no routes mounted in
`domain/notes` (PL-15).

## What you write, and what you do not touch

The generator splits the module into two file modes ([D-033](../../decisions.md),
[09 §2](../framework/09-rail.md)):

- **Seed files** are emitted once and then yours: the controller, the service, the repository, unit
  specs. The generated service stubs throw
  `NotImplementedException('SPEC-DEMO-001 R-1: implement in a code packet')` until you replace them.
- **Generated files** carry `// @generated from SPEC-<ID> do not edit`: `index.ts`, the module file,
  `dto/*`, the catalogs, the initial `db/*.sql`. They are byte-verified against regeneration. Never
  edit one; regenerate with `devai new module --regenerate` or move the logic into a seed file
  ([02 §7](../framework/02-architecture.md)).

That is why the demo packet forbids the generated paths even inside the allowed module:

```yaml
  forbidden:
    - domain/notes/api/src/dto/**          # @generated: regenerate, never edit
    - domain/notes/api/src/index.ts
    - domain/notes/api/src/notes.module.ts
    - domain/notes/api/test/acceptance/**
```

Outside a `test` packet, never edit `api/test/acceptance/**`. A red acceptance test you did not
write is a result: if it is wrong, say so under `## Notes` and stop; a `test` packet fixes it
([10 §1–§2.1](../framework/10-agent-surface.md)). The spec, `generation-manifest.json`,
`decisions.md` and other packets are outside `paths.allowed`; PL-07 and PL-04 name any touch
([05 §5](../framework/05-task-packet.md)).

## Route contracts and typed queries

Every write route carries its contract in code, and `route-contract` compares it with the spec's
route table both ways ([D-016](../../decisions.md), [08 B.9](../framework/08-cli-and-nodes.md)).
The five decorators are `@Idempotent(…)` or `@NoIdempotent()`, `@RequireRoles([...], 'all')`,
`@ErrorContract([...])`, `@UseCase('UC-…')` and `@Slo({...})`, with literal arguments. Every
`@Body()`, `@Query()` and `@Param()` goes through `parseDto` or a typed pipe (S-26).

Raw SQL lives in `*.repository.ts` as `defineQuery` with a `sql` template that has no
interpolation; arguments are zod-validated before binding and every returned row is validated
([02 §3](../framework/02-architecture.md)). `sql-typed` checks that the zod limits stay within the
column's limits and, in a generated module, equal the spec's data bound. The demo's Notes add a
pitfall: limits are UTF-16 code units, so do not add a code-point refinement
([05 §7](../framework/05-task-packet.md), [D-054](../../decisions.md)).

## When the agent stops

At exit 0 on `--full`. Or when the spec or an acceptance test is wrong, or a choice needs you: the
agent writes it under `## Notes` and leaves the packet unaccepted
([10 §2.1](../framework/10-agent-surface.md)). Messages that end in "write a successor" are the ones
it cannot act on alone ([05 §5](../framework/05-task-packet.md)).

## What a green result looks like

The summary that becomes the PR body, abridged ([05 §7](../framework/05-task-packet.md)):

```
acceptance: PASS (27 nodes: 25 pass, 2 skipped: sql-lint[no changed *.sql], …)   runtime: bare
protected paths: spec (packets/CMP-DEMO-001/PKT-DEMO-004.md, declared)   packet scope: ok   spec tests: 6/6 requirements covered
review: no blockers (1 disposed: not-a-defect R-4; mustRun: false, tallied)   worker: claude   reviewer: gpt
```

Reviewer findings and dispositions are covered in
[Review and dispositions](review-and-dispositions.md).

Source: [01](../framework/01-charter.md), [02 §3, §7](../framework/02-architecture.md),
[05 §3, §5, §7](../framework/05-task-packet.md), [08 B.9, B.27, C.4](../framework/08-cli-and-nodes.md),
[09 §2](../framework/09-rail.md), [10 §1, §2.1](../framework/10-agent-surface.md),
[D-016, D-033, D-051, D-054](../../decisions.md).
