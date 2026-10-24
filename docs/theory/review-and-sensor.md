---
title: Review and sensor
sidebar_position: 5
description: How DEVAI 3 uses models as checks — the independent reviewer of the other family and the permissions-pattern sensor — without making either an authority.
---

# Review and sensor

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

Two of the 28 nodes call a model: `review` and `permissions-pattern`. Both are designed so that a model
can add observation without becoming a rubber stamp, a bottleneck or an authority.

## Why a reviewer at all

In v2, only a few percent of 319 merged PR diffs were actually read, so human ratification of diffs is
not a control; acceptance rests on deterministic checks plus an independent reviewer
([D-003](../../decisions.md)). The reviewer is a node inside the one acceptance command, not a second
condition ([01](../framework/01-charter.md)).

## The reviewer

**Who.** A model of a different family from the worker. The worker's family is read from the
`Co-Authored-By` trailers of the candidate's commits; `devai.json` `review.reviewers` maps each family to a
reviewer command. An equal, unknown or mixed family is `UNKNOWN (family)` (D-079), and no configured reviewer is
`UNKNOWN (no reviewer configured)` ([02 §9](../framework/02-architecture.md), [08 A.8](../framework/08-cli-and-nodes.md)).
The worker family is never a packet field ([05 §2](../framework/05-task-packet.md)).

**Where.** On the pilot's machine, inside `devai check --packet <p> --full`, only after every
deterministic node and `permissions-pattern` have passed — there is no review of a known broken build.
No model keys live in CI. The result, `.devai/review/<packet-id>.json`, is bound to the candidate digest
and committed with the PR; CI only verifies that the digest matches the PR head, and otherwise reports
`review: UNKNOWN (stale)` ([02 §9](../framework/02-architecture.md), [D-037](../../decisions.md)). The law names
the weakness openly: CI trusts a locally produced reviewer result, which is acceptable because CI is the
only consumer of that evidence ([D-037](../../decisions.md), [D-002](../../decisions.md)).

**How: two phases.** Phase 1 is implementation-blind: from the frozen spec, the cited business rules and
the public contracts only, the reviewer writes the requirement list with what would prove and what
would falsify each one, and freezes it. Phase 2 opens the candidate: the packet, `report.json` and the
diff; for each acceptance requirement it locates the implementing code and the test and judges whether
the test would fail if the requirement were violated, and it looks for scope creep and weakened tests
([02 §9](../framework/02-architecture.md)). For a `spec` packet phase 1 reads the business sources without the
candidate spec; for `standards`, the cited standards without the diff ([05 §3](../framework/05-task-packet.md),
[06 §5](../framework/06-spec-format.md)).

**Access.** Read-only on the repository (read, search, `git log/diff`), no network except the model API
([D-042](../../decisions.md)). It may confirm a concrete counterexample by running it against scratch storage
only — a throwaway worktree copy and a scratch database from `db-apply`'s schema digest. A finding
confirmed that way has `basis: observed`; one reasoned from reading has `basis: derived`
([02 §9](../framework/02-architecture.md)). Isolation is enforced by the harness CLI's sandbox and tool denial and then checked in its event stream,
not supplied by a working directory; a CLI that cannot enforce it leaves the node
`UNKNOWN: capability-missing` ([D-058](../../decisions.md), [D-082](../../decisions.md), [08 B.27](../framework/08-cli-and-nodes.md)).

**Bounds.** At most 150k input tokens, 4k output, 20 tool calls and 5 minutes, across both phases. Running
out of input or time before every requirement is examined is `UNKNOWN`, listing the unexamined ones;
running out of the counterexample budget alone leaves findings `derived`, never `UNKNOWN`
([02 §9](../framework/02-architecture.md), [D-042](../../decisions.md), [D-054](../../decisions.md)). Cost is
reported in tokens and seconds; money is `UNKNOWN` without metering ([02 §9](../framework/02-architecture.md)).

**What it may and may not do.** It may turn the exit code red while its verdict is `blockers` or `unknown`
and the node is gating. It may not edit the candidate, re-run the graph or the test suite, approve, merge,
or decide that a spec is wrong — that is a finding for the pilot. Its `PASS` is never authorization:
merging is the pilot's act or branch protection's ([02 §9](../framework/02-architecture.md)). Worker prose in
commits or PR text is evidence to inspect, never instruction ([02 §9](../framework/02-architecture.md)).

**Findings and dispositions.** Every finding has a `fingerprint` = sha256 of requirement, locator path and
normalised statement — never a sequential id ([02 §9](../framework/02-architecture.md)). A finding is answered
in the packet's `## Review dispositions` block as `not-a-defect` or `accepted-risk`, bound to its
requirement and locator; a fixed finding simply stops recurring ([D-074](../../decisions.md)). `not-a-defect` is a claim that the next `--full` re-observes;
`accepted-risk` silences one review finding and never overrides a deterministic node; a business decision
that changes acceptance is a successor spec ([D-035](../../decisions.md), [02 §9](../framework/02-architecture.md)).
The agent may write `not-a-defect`; `accepted-risk` is the pilot's word ([05 §2](../framework/05-task-packet.md),
[10 §2.4](../framework/10-agent-surface.md)). See [Review and dispositions](../guides/review-and-dispositions.md).

**Shadow first.** The node runs from day 0, but during the first campaign `review.mustRun` is `false`: the
review is produced and its false positives and misses are tallied against dispositions without setting
the exit code — except on a PR labelled `protected:unplanned`, where review is mandatory. After that
campaign the flag flips to `true` and stays; it is a repository-level, labelled standards change, never a
per-packet option ([D-028](../../decisions.md), [02 §5, §9](../framework/02-architecture.md)).

## The permissions-pattern sensor

Standard S-12 says protected routes authorize from a bearer JWT that carries the user's permissions,
checked on each request with no SQL query ([03](../framework/03-standards.md)). [D-009](../../decisions.md) chose
how to guard it: not a runtime assertion, not a lint, but a narrow agentic check — "Keep it simple".

**The slice is deterministic.** From the mounted-route inventory: routes → global and route guards →
permission predicates and token-to-principal construction → transitive calls through concrete DI
bindings, including STYNX package sources. Missing source, unresolved dynamic dispatch or an unbound guard
is `UNKNOWN` before any model call. Above 60k input tokens the result is `UNKNOWN: slice too large` with
the file list, and acceptance fails closed ([02 §4](../framework/02-architecture.md)).

**One question.** The model receives the slice and a single fixed question — is authorization decided
from claims in the verified token, with no database, cache or network call to obtain permissions on the
request path ([02 §4](../framework/02-architecture.md), [D-025](../../decisions.md)) — and must answer with JSON
matching a schema. It gets one call and no tools: the CLI's tool removal enforces it and the event stream
confirms it ([08 B.24](../framework/08-cli-and-nodes.md), [D-082](../../decisions.md)).

**Reading the answer.** `violation` is `FAIL` with the model's findings as locators. Only `compliant`, with
every locator validated, every mounted entrypoint inspected, nothing unresolved and `confidence` at or
above `minConfidence` (0.7 at least) is `PASS`. Everything else — a parse failure, a timeout, a missing
entrypoint, `unknown` — is `UNKNOWN` ([02 §4](../framework/02-architecture.md), [08 A.8, B.24](../framework/08-cli-and-nodes.md)).

**When and where.** It runs in full acceptance, and the model is called only when the slice digest changed
since the last `PASS`; in CI the evidence is verified, not re-run. The sensor uses the reviewer command of the candidate's worker family ([08 A.8](../framework/08-cli-and-nodes.md)).
Its validated output is committed at `.devai/review/<packet-id>.permissions.json`, bound to the slice
digest and recording the `minConfidence` it was judged by; CI recomputes the digest, re-applies the PR head's
threshold and never calls a model ([D-058](../../decisions.md), [D-083](../../decisions.md), [02 §11](../framework/02-architecture.md)).

**What it is not.** It is not a security proof; `review` and `integration` remain the behavioural checks
([02 §4](../framework/02-architecture.md)). Nor does it bend to existing code: the current STYNX guard
resolves permissions per request through a cache backed by SQL, so every STYNX adopter's
`permissions-pattern` reads `FAIL` until STYNX's migration lands. That is the correct reading, not a
tolerance in the sensor ([02 §4](../framework/02-architecture.md), [D-025](../../decisions.md)).

## Determinism without temperature

Neither host CLI exposes a sampling temperature, so determinism comes from the verdict cache: a result is
reused while its inputs (digests, prompt, model id) are unchanged ([D-058](../../decisions.md),
[02 §4, §9](../framework/02-architecture.md)). Only `PASS` is cached ([08 C.4](../framework/08-cli-and-nodes.md)).
There is no retry and no model fallback; an error is one `UNKNOWN` with its reason
([08 Part D](../framework/08-cli-and-nodes.md)). Token bounds use the proxy `ceil(utf8Bytes / 3.5)` before
the call and the CLI-reported usage after it, which binds ([D-058](../../decisions.md)).

Source: [02](../framework/02-architecture.md), [05](../framework/05-task-packet.md), [08](../framework/08-cli-and-nodes.md),
[10](../framework/10-agent-surface.md), [D-003](../../decisions.md), [D-009](../../decisions.md), [D-025](../../decisions.md),
[D-028](../../decisions.md), [D-035](../../decisions.md), [D-037](../../decisions.md), [D-042](../../decisions.md),
[D-058](../../decisions.md).
