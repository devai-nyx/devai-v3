---
title: report.json
sidebar_position: 8
description: The report.json schema, node result, finding and details shapes, the two review evidence files, and the text report grammar from 08 C.2–C.6.
---

# `report.json` and the evidence files

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

`devai check` has **one report shape** ([08 C.2](../framework/08-cli-and-nodes.md), [D-056](../../decisions.md)). The text report and the JSON report come from the same `Report` object; there is no second reporter format ([08 Part D](../framework/08-cli-and-nodes.md)). The zod definitions are in 08 C.2; `packages/cli/src/report.ts` holds the same text.

**Counts:** `Report` 16 fields and 9 invariants; `NodeResult` 13 fields and 9 invariants; `Finding` 4 fields; `Details` 8 variants; 28 `NodeId` values; 4 `Status` values; 54 `ReasonCode` values ([Reason codes](./reason-codes.md)); plus 5 evidence and model-output schemas (`SensorOutput`, `SensorEvidence`, `Review`, `ReviewPhase1`, `ReviewModelOutput`).

## Where it is written

| File | When | Source |
|---|---|---|
| stdout | `--format json` | [08 A.3](../framework/08-cli-and-nodes.md) |
| `.devai/cache/reports/<candidateDigest>.json` | every `--full` run and every `--format json` run; gitignored | [08 A.3, C.4](../framework/08-cli-and-nodes.md) |
| `.devai/review/<packet-id>.json` (`Review`) | by `review`, `--packet --full` only; tracked in the PR branch | [08 B.27](../framework/08-cli-and-nodes.md), [02 §11](../framework/02-architecture.md) |
| `.devai/review/<packet-id>.permissions.json` (`SensorEvidence`) | by `permissions-pattern`, `--packet --full` only; tracked | [08 B.24](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md) |

## Shared scalars

| Name | Definition |
|---|---|
| `Sha256` | `^[0-9a-f]{64}$` |
| `Sha1` | `^[0-9a-f]{40}$` |
| `Count` | integer ≥ 0 |
| `Text` | string, length ≥ 1 |
| `Status` | `PASS` \| `FAIL` \| `UNKNOWN` \| `SKIPPED` |
| `NodeId` | the 28 node ids of [02 §2](../framework/02-architecture.md) (see [Check nodes](./nodes.md)) |

## `Report`

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | literal `'3'` | |
| `command` | Text | the argv as run, e.g. `devai check --packet … --full` |
| `packetId` | `^PKT-[A-Z0-9]+-\d{3}$` or `null` | |
| `kind` | `spec` \| `generate` \| `test` \| `code` \| `fix` \| `standards` or `null` | |
| `specId` | Text or `null` | null for `spec`/`standards` kinds and no-packet runs |
| `specSha256` | Sha256 or `null` | as `specId` |
| `base` | Sha1 or `null` | |
| `head` | Sha1 or `null` | null only before acquisition (`config-invalid`, `not-a-repository`) |
| `candidateDigest` | Sha256 or `null` | as `head` |
| `toolchainDigest` | Sha256 or `null` | as `head` |
| `runtime` | `bare` \| `docker` or `null` | |
| `accepted` | boolean | true only on `--packet --full` with exit 0 |
| `exitCode` | `0` \| `1` \| `2` | |
| `reason?` | ReasonCode | command-level could-not-run |
| `nodes` | NodeResult[] | every planned node; prerequisite failures included; deferred nodes absent |
| `durationMs` | Count | |

**Invariants** (refinements):

1. No duplicate node id.
2. If `nodes` is non-empty, an `accept` row exists.
3. `accepted` needs exit 0, `packetId`, `base`, `candidateDigest`, `toolchainDigest`, and `--full` in `command`.
4. Exit 2 needs a `reason` or an `UNKNOWN` row.
5. Exit 1 needs a `FAIL` row.
6. A command-level `reason` means exit 2.
7. `accepted` needs a non-empty `nodes`, an `accept` row that is `PASS`, every node other than `review` `PASS` or `SKIPPED`, and every id in `accept.details.requiredSet` present and not `SKIPPED` (PL-15; [D-077](../../decisions.md)).
8. Exit 0 needs no `FAIL` or `UNKNOWN` row other than `review`.
9. Exit 1 needs a `FAIL` row other than `review`, or a `review` `FAIL` with `accepted` false (a gating review).

`review` is exempt from 7–9 because its gating is derived from `devai.json` and `protected-paths` ([D-028](../../decisions.md), [D-058](../../decisions.md)), which the schema cannot read; the runner enforces it.

## `NodeResult`

| Field | Type | Notes |
|---|---|---|
| `id` | NodeId | |
| `status` | Status | |
| `expected` | Count | |
| `observed` | Count | |
| `evaluated` | Count | |
| `findings` | Finding[] | |
| `reason?` | ReasonCode | `UNKNOWN` only |
| `evidence?` | string | `SKIPPED` only: `inventory`'s population predicate string ([D-044](../../decisions.md)) |
| `durationMs` | Count | |
| `cached` | boolean | |
| `cacheKey?` | Sha256 | |
| `needs` | array of `postgres` \| `model` | |
| `details?` | Details | |

**Invariants:**

1. `evaluated` ≤ `observed`.
2. `PASS` needs `observed > 0` and no findings.
3. `FAIL` needs a finding.
4. `UNKNOWN` needs a `reason`.
5. `SKIPPED` needs `evidence` and `expected` = `observed` = 0.
6. Only `PASS` may be `cached`.
7. `details.node` equals `id`.
8. `PASS` needs `evaluated` = `observed` = `expected` ([08 §0](../framework/08-cli-and-nodes.md), [D-077](../../decisions.md)).
9. `cached` needs `cacheKey`.

## `Finding`

Both `standard` and `hint` are required on every finding ([02 §8](../framework/02-architecture.md)).

| Field | Type | Notes |
|---|---|---|
| `locator` | Text | `<path>:<line>[:<col>]` or `<path>:1` |
| `message` | Text | |
| `standard` | Text | e.g. `S-27`, `04 §2`, `05 PL-07`, `tests`, `tiers` |
| `hint` | Text, ≤ 160 chars | one line |

## `Details` (by node)

A discriminated union on `node`; 8 nodes carry details.

| `node` | Fields |
|---|---|
| `inventory` | `toolchainDigest: Sha256`, `populations: record<NodeId, { predicate: Text, count: Count }>` |
| `sql-typed` | `phase: static \| db`, `queries: [{ name, path, textSha256 }]` |
| `db-apply` | `schemaDigest: Sha256`, `database: ^devai_[0-9a-f]{12}$`, `dropped: boolean` |
| `spec-tests` | `expectRed: R-n[]`, `reached: Text[]`, `uncovered: Text[]` |
| `permissions-pattern` | `sliceDigest`, `model`, `inputTokens`, `outputTokens`, `seconds`, `proxyTokens` |
| `review` | `model`, `verdict: no-blockers \| blockers \| unknown`, `inputTokens`, `outputTokens`, `seconds`, `toolCalls`, `unexamined: Text[]` |
| `protected-paths` | `touched: [{ class, paths: Text[], declared: boolean \| null }]` |
| `accept` | `requiredSet: NodeId[]`, `deferred: NodeId[]`, `editLoopMs: Count \| null` |

**Gating** is not a field. A row gates unless it is `review` while `review.mustRun` is false and `nodes[protected-paths].details.touched` has no `declared: false` entry ([08 C.2](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md)).

## Evidence files and model outputs

### `SensorOutput` — the `permissions-pattern` question's JSON

| Field | Type |
|---|---|
| `verdict` | `compliant` \| `violation` \| `unknown` |
| `inspectedEntrypoints` | Text[] |
| `findings` | `[{ path: Text, line: positive int, statement: Text, evidence: Text }]` |
| `unresolved` | Text[] |
| `confidence` | number 0–1 |

### `SensorEvidence` — `.devai/review/<packet-id>.permissions.json`

| Field | Type |
|---|---|
| `packetId` | `^PKT-[A-Z0-9]+-\d{3}$` |
| `sliceDigest` | Sha256 |
| `promptDigest` | Sha256 |
| `model` | Text |
| `output` | SensorOutput |
| `inputTokens` | Count |
| `outputTokens` | Count |
| `seconds` | number ≥ 0 |
| `minConfidence` | 0–1 — the threshold in force when judged; CI re-applies the PR head's ([D-083](../../decisions.md)) |

### `Review` — `.devai/review/<packet-id>.json`

| Field | Type |
|---|---|
| `packetId` | `^PKT-[A-Z0-9]+-\d{3}$` |
| `head` | Sha1 |
| `candidateDigest` | Sha256 |
| `specSha256` | Sha256 or `null` |
| `requirements` | `[{ id: Text, implemented: yes \| no \| partial, tested: yes \| no \| weak, locators: Text[] }]` |
| `findings` | `[{ fingerprint: Sha256, severity: blocker \| major \| minor, requirement, locator, statement, evidence, counterexample?, basis: observed \| derived, confidence: 0–1 }]` |
| `verdict` | `no-blockers` \| `blockers` \| `unknown` |
| `inputTokens` | Count |
| `outputTokens` | Count |
| `seconds` | number ≥ 0 |
| `model` | Text |
| `workerFamily` | `claude` \| `gpt` \| `unknown` — the worker's declaration the reviewer was selected from ([D-079](../../decisions.md)) |
| `workerTrailers` | `Text[]` — the `Co-Authored-By` lines it was derived from |

Invariant: `verdict: blockers` iff a finding has `severity: blocker` ([D-077](../../decisions.md)).

`fingerprint = sha256(requirement ‖ locator path ‖ normalised statement)` ([08 B.27](../framework/08-cli-and-nodes.md)). Dispositions in the packet bind to it (PL-09).

### Reviewer model outputs

| Schema | Shape | Used by |
|---|---|---|
| `ReviewPhase1` | `{ requirements: [{ id, observable, falsifier }] }`, at least one | phase 1 ([10 §3.1](../framework/10-agent-surface.md)) |
| `ReviewModelOutput` | `Review`'s `requirements` and `verdict`, plus `findings` without `fingerprint` | phase 2 ([10 §3.2](../framework/10-agent-surface.md)); the runner adds fingerprints, digests and usage |

## Text report grammar

`--format text` prints at most 40 lines ([08 C.3](../framework/08-cli-and-nodes.md)):

```text
line 1   devai check <args>   runtime=<mode>   base=<sha1[0:4]>…  head=<sha1[0:4]>…
then     one block per node with status FAIL, then UNKNOWN, in DAG order:
           <STATUS padded 7>  <node padded 18>  <n> finding(s)   (expected <e> <unit>, observed <o>[, evaluated <v>])
           <6 spaces><locator>  <message>   [<standard>]  <hint>
           <6 spaces>UNKNOWN <node> <reason>: <10 §4 hint>
then     PASS  <n> nodes (<c> cached, <s> s)
then     SKIPPED <n> nodes: <node>[<evidence>], …
then     deferred: <node>, …
then     review  not run: <reason>  |  review  <verdict> (<n> findings; mustRun: <bool>[, tallied])
then     devai <stage> <PASS|FAIL|UNKNOWN> — <10 §4 stage text>      ← --hook only
last     exit <code>
```

When findings overflow, each node keeps `min(8, max(1, floor((40 − fixed lines) / failing nodes)))` findings and ends with `+<k> more`; the report then points to `.devai/cache/reports/<digest>.json`. Machine findings are never dropped from `report.json`.

`--summary` prints at most 10 lines and becomes the PR body: packet/spec line, acceptance line, protected paths/packet scope/spec tests line, review line, then up to six failing nodes ([08 C.3](../framework/08-cli-and-nodes.md)).

## Digests the report carries

| Digest | Definition (summary) | Source |
|---|---|---|
| `candidateDigest` | sha256 over `base <sha1 or none>` and one line per tracked or untracked-not-ignored entry (tag `F`/`L`/`G`, mode, sha256, length-framed path), plus `D` lines for paths deleted since `base`; `.devai/review/**` and `.devai/cache/**` excluded. Taken before and after the run; a difference is `candidate-changed` | [08 C.6](../framework/08-cli-and-nodes.md) |
| `toolchainDigest` | `sha256(node version ‖ pnpm version ‖ pnpm-lock.yaml)` | [08 B.1](../framework/08-cli-and-nodes.md) |
| `schemaDigest` | sha256 over sorted, length-framed catalog rows (columns, constraints, indexes, policies, functions, RLS flags, product roles, grants); OIDs, owners, timestamps and the scratch name excluded; equal across modes | [08 C.4](../framework/08-cli-and-nodes.md) |
| cache key | `sha256(nodeId ‖ nodeVersion ‖ toolchainDigest ‖ configDigest ‖ runtimeMode ‖ sortedInputDigests ‖ dependencyResultDigests)`, each length-framed; DB nodes use `schemaDigest` instead of `runtimeMode` | [08 C.4](../framework/08-cli-and-nodes.md) |
| `resultDigest` | sha256 of the `NodeResult` without `durationMs`, `cached`, `cacheKey`, findings sorted | [08 C.4](../framework/08-cli-and-nodes.md) |

## Cache layout

| Path | Holds |
|---|---|
| `.devai/cache/nodes/<nodeId>/<key>.json` | `{ resultDigest }` |
| `.devai/cache/results/<resultDigest>.json` | `NodeResult` (PASS only) |
| `.devai/cache/reports/<candidateDigest>.json` | `Report` |
| `.devai/cache/agentic/<node>/<digest>.json` | the validated model output (verdict cache) |
| `.devai/cache/scratch/` | worktree and index copies, `<digest12>.json` scratch-DB descriptors |

The cache is gitignored; `rm -rf .devai/cache` is always safe. `.devai/review/` is not a cache ([08 C.4](../framework/08-cli-and-nodes.md)).

Source: [08 C.2–C.6, Part D](../framework/08-cli-and-nodes.md), [02 §8, §11](../framework/02-architecture.md), [10 §3, §4](../framework/10-agent-surface.md), [D-044](../../decisions.md), [D-056](../../decisions.md), [D-058](../../decisions.md).
