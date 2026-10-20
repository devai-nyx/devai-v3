---
title: Review and dispositions
sidebar_position: 6
description: How the independent reviewer runs inside full acceptance, when it gates, and how agent and pilot answer its findings.
---

# Review and dispositions

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

Every `--packet --full` run ends with an independent review by a model of a **different family**
than the one that did the work. It is the `review` node inside the one acceptance command, not a
second condition ([01 Charter](../framework/01-charter.md), [D-028](../../decisions.md)).

## Who reviews, where and when

- **Who.** The worker family is read from the `Co-Authored-By` trailers of `base..HEAD`: `claude`
  or `gpt`. `devai.json` `review.reviewers` maps each worker family to the other family's CLI. An
  equal or unknown family is `UNKNOWN (family)`; none configured is
  `UNKNOWN (no-reviewer-configured)` ([02 §9](../framework/02-architecture.md),
  [08 B.27](../framework/08-cli-and-nodes.md)).
- **Where.** On your machine, inside `--full`, before push. CI holds no model keys; it only checks
  that the committed review is bound to the PR head, and otherwise reports `review: UNKNOWN (stale)`
  ([D-037](../../decisions.md)).
- **When.** After every deterministic node and `permissions-pattern` have passed: a broken build is
  not reviewed ([02 §9](../framework/02-architecture.md)).

## What it does

**Phase 1, implementation-blind.** From the pinned spec, its quoted sources and the public
contracts only, with no tools, the reviewer writes for each acceptance requirement what would prove
it and what would falsify it. For `kind: spec` it works from the business sources without the
candidate spec; for `kind: standards`, from the cited standards without the diff
([06 §5](../framework/06-spec-format.md), [10 §3.1](../framework/10-agent-surface.md)).

**Phase 2, candidate.** In a throwaway copy of the candidate, it judges each requirement
`implemented yes|no|partial` and `tested yes|no|weak`, then reads the diff for scope creep, weakened
tests and protected paths. It may confirm a counterexample by running it in scratch storage, within
20 tool calls and 5 minutes in all. It never edits, never re-runs the checks and never decides that
a spec is wrong; that is a finding for you ([D-042](../../decisions.md),
[10 §3.2](../framework/10-agent-surface.md)).

The result goes to `.devai/review/<packet-id>.json`. Each finding has a `fingerprint`, a
`severity` (`blocker`, `major`, `minor`), a requirement, one locator, a statement, `evidence`, often
a `counterexample`, and a `basis`: `observed` only if the reviewer ran it, else `derived`
([02 §9](../framework/02-architecture.md)).

**Its PASS is never authorization.** Merging is your act or branch protection's
([02 §9](../framework/02-architecture.md)).

## When the review gates the exit code

| Situation | Effect |
|---|---|
| `review.mustRun: false` (the template value) | The verdict is reported and tallied against dispositions; it does not change the exit code |
| `review.mustRun: true` | A `blockers` verdict is a `FAIL` (exit 1); an `unknown` verdict is `UNKNOWN` (exit 2) |
| The PR touches a protected class the packet did not declare (`protected:unplanned`) | The review gates for that PR, even during shadow |

([D-028](../../decisions.md), [02 §5](../framework/02-architecture.md),
[08 C.2](../framework/08-cli-and-nodes.md)) The first campaign runs in shadow; then `mustRun` flips
to `true` in `devai.json` and stays. It is a repository-level standards change, never a per-packet
option. There is no `review: off` ([02 §8–§9](../framework/02-architecture.md)).

## Answering a finding (the agent)

The `devai-review` skill ([10 §2.4](../framework/10-agent-surface.md)): a finding is a **claim**.
Check it first, running its counterexample when it has one.

- **Real:** fix it and re-run `--full`.
- **Wrong:** add one line under `## Review dispositions` in the packet:

  ```
  RV <first 12+ hex of fingerprint> · <R-n> · <locator> · not-a-defect · <reason>
  ```

  Extend the fingerprint prefix until it is unique, copy the `R-n` and locator from the finding,
  and cite the spec's observable or source in the reason. The next `--full` re-checks it.
- **Needs a business decision:** write it under `## Notes` for the pilot. That means a successor
  spec, not a disposition.

The demo packet's disposition, after a review round:

```
RV ac9f878d7da8 · R-4 · domain/notes/api/src/notes.service.ts:41 · not-a-defect · the reviewer expected 403 for another tenant's id; R-4's observable requires 404 …
```

([05 §7](../framework/05-task-packet.md); the fingerprint is illustrative.)

Re-run `--full` after a change, or once after `model-error` or `timeout`; never to reroll a verdict.
Never run the reviewer CLI yourself ([10 §2.4](../framework/10-agent-surface.md)).

## Answering a finding (you)

`accepted-risk` is your word, not the agent's ([05 §2](../framework/05-task-packet.md)). It
silences one `review` finding for that requirement and locator only, and **never overrides a
deterministic node** ([D-035](../../decisions.md)). A business decision that changes what
acceptance means is a successor spec and a new packet, not a disposition.

## How dispositions are checked

| Rule | What it checks |
|---|---|
| PL-09 | The line parses; the fingerprint prefix resolves to exactly one finding in the committed review history since `base`; `R-n` and locator match it |
| PL-10 | `fixed` and `not-a-defect` hold against the **current** review: the finding is absent, or contradicted by `basis: observed` evidence |

([05 §5](../framework/05-task-packet.md)) A claimed `fixed` whose finding recurs with observed
evidence keeps the verdict at `blockers`. Fingerprints are hashes of requirement, locator path and
statement, never sequential ids, so a replaced review cannot erase the binding
([06 §8](../framework/06-spec-format.md)). A disposition edits the packet and labels the PR
`protected:spec` ([02 §9](../framework/02-architecture.md)).

## Keeping the review fresh

Commit the review files `--full` writes, as written. Any later commit except one that only touches
`.devai/review/` changes the candidate digest and makes the review stale; re-run `--full` and commit
again ([05 §4](../framework/05-task-packet.md), [10 §4](../framework/10-agent-surface.md)). Never
hand-edit anything under `.devai/` ([10 §1](../framework/10-agent-surface.md)).

The same applies to the `permissions-pattern` sensor's evidence,
`.devai/review/<packet-id>.permissions.json`, bound to the permission slice digest
([D-058](../../decisions.md)).

Source: [01](../framework/01-charter.md), [02 §5, §8, §9](../framework/02-architecture.md),
[05 §2, §5, §7](../framework/05-task-packet.md), [06 §5, §8](../framework/06-spec-format.md),
[08 B.27, C.2](../framework/08-cli-and-nodes.md), [10 §2.4, §3](../framework/10-agent-surface.md),
[D-028, D-035, D-037, D-042, D-058](../../decisions.md).
