---
title: Moving from v2
sidebar_position: 6
description: How a DEVAI 2 adopter moves to DEVAI 3 through a fresh scaffold, with no conversion and a 2.x pin kept until then.
---

# Moving from v2

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

DEVAI 3 is a ground-up build from a new specification. v2 is reference material, not a codebase
that was pruned ([00](../framework/00-intent.md), [D-001](../../decisions.md)). So there is no
upgrade path from a v2 repository. You move by creating a fresh v3 scaffold and bringing modules
across one approved spec at a time (12 §6, bootstrap history).

## Until you move

Keep `@aarusso-nyx/devai` pinned within `2.x` until you move: `^2.6.2`, or an exact pin of your
own choosing. Publishing 3.0.0 does not end v2: v2 and v3 cohabit. The v2 repository
`aarusso-nyx/devai` stays unarchived, and 2.x receives defect fixes only: no features and no new law
([D-090](../../decisions.md)). There is no closing date and no archive step
([D-142](../../decisions.md)), so your 2.x pin, v2's packages and its docs site keep resolving
(12 §6).

## Why there is no converter

- `devai init` writes only into an empty directory, and attaches only where a `devai.json` already
  exists ([08 A.1](../framework/08-cli-and-nodes.md)). A v2 repository has neither.
- A v2 layout fails `layout`. For example, v3 spells the root test folder `test/` singular
  ([D-024](../../decisions.md), [04 §1](../framework/04-layout.md)), and root guides are limited to
  `README.md`, `AGENTS.md`, `CLAUDE.md` and `decisions.md` ([04 §1](../framework/04-layout.md)).
- Both CLIs claim the `devai` bin.

The succession plan therefore lists no migration command, converter, shim, dual bin or 2.x branch
(12 §8).

## The move, step by step

From 12 §6:

1. Scaffold into an empty directory, choosing locales and LGPD for the product
   ([D-014](../../decisions.md)):
   ```sh
   pnpm dlx @devai-nyx/cli@3.0.0 init --product <prefix> --dir <empty-dir>
   ```
2. Make the scaffold a new repository or a migration branch. From then on only attach mode runs
   (`pnpm exec devai init` in each clone).
3. Set branch protection to require the `devai.yml` job (see [CI](ci.md)).
4. Bring modules across one approved spec at a time. Keep the applied SQL history: applied
   migrations are immutable inputs, and a schema change is a new migration
   ([D-033](../../decisions.md), [D-043](../../decisions.md)).
5. Keep your v2 repository building on its 2.x pin until its last module is ported; archiving it then is your choice.

[Install](install.md) covers the prerequisites and the flags.

## What does not carry over

Law transfers. Evidence standing does not (12 §0). Concretely:

| v2 mechanism | In v3 | Basis |
|---|---|---|
| Role identities, path admission by signature | One agent git identity; protected paths only label | [D-019](../../decisions.md) |
| Signed evidence, attestations, receipts | None; CI verifies two files by digest | [D-002](../../decisions.md), [D-037](../../decisions.md) |
| Scorecard grid | The local `devai check` report for the current change | [D-005](../../decisions.md) |
| Scheduler, rounds, journal, locks | None; harnesses execute packets | [D-018](../../decisions.md) |
| Human diff ratification | Not a control | [D-003](../../decisions.md) |
| Mutation testing as a gate | Never in the cycle | [D-004](../../decisions.md) |
| Universal coverage percentage | Coverage = acceptance requirements covered | [D-036](../../decisions.md) |
| Interactive configuration, waivers | Inert `devai.json`; no waiver of any node | [D-034](../../decisions.md), [02 §8](../framework/02-architecture.md) |
| v2 code, law text, ADRs | Not carried; the v2 law was classified once in the bootstrap ledger, which nothing in v3 reads | [D-066](../../decisions.md); 11 |

## Choosing the first module

For DETRAN the plan names the first module: `domain/inf-rait-worklist`, narrowly the analyst's
"claim next", with the existing case integration as a declared boundary. Its `kind:` packets measure
what D-026, D-028 and D-047 are waiting for: packets, PRs and pilot touches, shadow-review counts,
and the edit-loop p95 ([D-026](../../decisions.md), [D-064](../../decisions.md); 12 §6). The plan
chose it by three criteria: one capability in one app, rules in the product's own `product/` folder
([D-008](../../decisions.md)), and at least one write route.

STYNX keeps its 2.x pin until its own release prerequisites land (12 §6; [D-090](../../decisions.md)).

Source: 00, 02 §8, 04 §1, 08 A.1, decisions D-001–D-005, D-014, D-018, D-019, D-024, D-026, D-033, D-034, D-036, D-037, D-043, D-064–D-066, D-090; 11, 12 §0, §6, §8 (bootstrap history).
