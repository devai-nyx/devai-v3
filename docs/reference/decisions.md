---
title: Decisions
sidebar_position: 12
description: Index of the 74 numbered decisions D-001 to D-074 in decisions.md, with date and title.
---

# Decisions

[`decisions.md`](../../decisions.md) at the repository root is the record of binding choices. It is part of the law: these pages explain and route to it, never amend it. This index lists all **74 decisions** (D-001…D-074), with the date and title exactly as each heading gives them. The text of a decision, its options and its source are in the file.

Dates: 24 decisions on 2026-10-17 (D-001…D-024), 41 on 2026-10-18 (D-025…D-065), 6 on 2026-10-19 (D-066…D-071), 3 on 2026-10-21 (D-072…D-074). Between D-035 and D-036 the file also holds a section "Corrections accepted from cross-review (no new decision needed)", which has no number.

| Id | Date | Title |
|---|---|---|
| D-001 | 2026-10-17 | v3 is a ground-up build, v2 is reference only |
| D-002 | 2026-10-17 | No external evidence consumer; evidence exists for CI and the pilot only |
| D-003 | 2026-10-17 | Human ratification of diffs is not a control |
| D-004 | 2026-10-17 | Mutation testing is outside the development cycle |
| D-005 | 2026-10-17 | Error state must be local, per task, and actionable by the agent |
| D-006 | 2026-10-17 | The product is a rail and a harness, not an auditor |
| D-007 | 2026-10-17 | STYNX is a DEVAI consumer, not the rail · preliminary |
| D-008 | 2026-10-17 | Business specs live in the product repo; technical specs come from DEVAI · preliminary |
| D-009 | 2026-10-17 | S-12 (permissions from token, no SQL per request) is a pattern guideline |
| D-010 | 2026-10-17 | S-21 (raw SQL) means type-safe queries with validated arguments |
| D-011 | 2026-10-17 | S-08 (Docker-or-bare) becomes a declared contract that agents read |
| D-012 | 2026-10-17 | S-31: v3 enforces ESM only · Owner determination |
| D-013 | 2026-10-17 | S-33: `no-explicit-any` and all `no-unsafe-*` on from day 0 · Owner decision |
| D-014 | 2026-10-17 | Adopted additional standards (from STYNX extraction §5) |
| D-015 | 2026-10-17 | Held for later decision |
| D-016 | 2026-10-17 | Two design patterns adopted for v3 |
| D-017 | 2026-10-17 | DDL band convention adopted |
| D-018 | 2026-10-17 | Execution model: harnesses execute; v3 defines packets and acceptance (closes O-001) |
| D-019 | 2026-10-17 | One agent git identity; protected paths are a labelling hook (closes O-002) |
| D-020 | 2026-10-17 | Standards list stays open until `02-architecture.md` is drafted (O-003 remains open) |
| D-021 | 2026-10-17 | No feature folder inside `domain/<m>/api/src/` (closes O-004) |
| D-022 | 2026-10-17 | Unit tests in separate `test/` folders, not colocated (closes O-005) |
| D-023 | 2026-10-17 | Module SQL per-module `db/` applied via a root manifest (closes O-006) |
| D-024 | 2026-10-17 | Root higher-tier test folder is `test/`, singular (closes O-007) |
| D-025 | 2026-10-18 | S-12 stands as written; STYNX auth is a migration item |
| D-026 | 2026-10-18 | Packet granularity: `kind:` packets; packet = unit of acceptance, PR = unit of merge · **PROVISIONAL** |
| D-027 | 2026-10-18 | Specs and packets live at root: `specs/`, `packets/`; both protected (closes V2; L-01) |
| D-028 | 2026-10-18 | Independent review: node from day 0, `must-run` after one campaign in shadow (closes V7) |
| D-029 | 2026-10-18 | STYNX publishes `@stynx-nyx/{eslint-config,tsconfig,migration-linter}` before v3.0 |
| D-030 | 2026-10-18 | Typed-query helper lives inside `@stynx-nyx/data` |
| D-031 | 2026-10-18 | Root `decisions.md`, protected; amends `04-layout.md` §1 |
| D-032 | 2026-10-18 | Product prefix is per app: `boat-`, `pec-`, `teat-`, `rait-`; shared code `detran-` |
| D-033 | 2026-10-18 | Converged in cross-review, adopted: generated vs seed (V3) |
| D-034 | 2026-10-18 | Converged, adopted: `devai.json` with `$schema`; `DEVAI_RUNTIME=bare\|docker` override (V4) |
| D-035 | 2026-10-18 | Converged, adopted: review dispositions and test-agent isolation (V5, V6) |
| D-036 | 2026-10-18 | No universal coverage percentage; coverage = acceptance requirements covered (closes O-009) |
| D-037 | 2026-10-18 | Independent reviewer executes on the pilot's machine, pre-push (closes O-011) |
| D-038 | 2026-10-18 | SLO measurement is a release gate only (closes O-012) |
| D-039 | 2026-10-18 | CI runtime modes: both modes on wiring changes and generator releases; declared mode otherwise (closes O-010) |
| D-040 | 2026-10-18 | DDL band 80–89 = views and materialized views (closes O-008) |
| D-041 | 2026-10-18 | 02-architecture accepted at its consolidated length |
| D-042 | 2026-10-18 | Reviewer is read-only on the repository and may execute bounded counterexamples |
| D-043 | 2026-10-18 | Applied-migration immutability is migration-linter rule LINT013 (S-24) |
| D-044 | 2026-10-18 | Status name `SKIPPED`, decided by `inventory` with evidence |
| D-045 | 2026-10-18 | S-31 and S-70 are enforced inside existing nodes |
| D-046 | 2026-10-18 | `database/migrations/**` belongs to the `infra` protected class |
| D-047 | 2026-10-18 | Edit-loop service level: measure first, provisional 90 s warm ceiling |
| D-048 | 2026-10-18 | Example fixture uses fictional ids under a fictional product |
| D-049 | 2026-10-18 | O-003 closed — final standards table copied to 03-standards Part A |
| D-050 | 2026-10-18 | Packet ids are `PKT-<PRODUCT>-nnn` (closes cross-check 2 item 1) |
| D-051 | 2026-10-18 | `code`/`fix` acceptance is all-green; `--expect-red` is for `test` packets only |
| D-052 | 2026-10-18 | `paths.forbidden` overrides inside `paths.allowed` |
| D-053 | 2026-10-18 | Spec lifecycle: written statuses `draft` · `approved` · `superseded-by`; `frozen` derived; links both ways |
| D-054 | 2026-10-18 | Consolidation rulings from cross-check 2 (no Owner choice needed) |
| D-055 | 2026-10-18 | Remaining specification set and the second-system brake |
| D-056 | 2026-10-18 | Schema validation is zod only; JSON Schemas are emitted from zod |
| D-057 | 2026-10-18 | Consolidation rulings from cross-check 3 (07) |
| D-058 | 2026-10-18 | Rulings from cross-check 4 (08 CLI and node contracts) |
| D-059 | 2026-10-18 | Owner rulings on the campaign items (09, 11) |
| D-060 | 2026-10-18 | Consolidation rulings from cross-check 5 (09 rail) adopted; 09 ratified |
| D-061 | 2026-10-18 | Consolidation rulings from cross-check 6 (10 agent surface) adopted; 10 ratified |
| D-062 | 2026-10-18 | Consolidation rulings from cross-check 7 (11) adopted; 11 promoted PROVISIONAL |
| D-063 | 2026-10-18 | v3 package identity and founding version (12) |
| D-064 | 2026-10-18 | Owner rulings on round 8 (12 succession) |
| D-065 | 2026-10-18 | Round-8 consolidation rulings adopted; 12 promoted PROVISIONAL |
| D-066 | 2026-10-19 | v2 law ledger review closed; 11 final, 12 ratified |
| D-067 | 2026-10-19 | NYXK relicenses the STYNX generator code to Apache-2.0 (closes D-064 P-8-08 R0 act) |
| D-068 | 2026-10-19 | R2 passed; `sql-typed` describes through a pg Submittable (08 B.10 amended) |
| D-069 | 2026-10-19 | R3 STYNX wave 1: LINT010 scope, tool publication and release wiring |
| D-070 | 2026-10-19 | Product role prefix is applied by STYNX's migration runner; apply.sh calls it |
| D-071 | 2026-10-19 | R4 STYNX wave 2: design rulings (SM-07/08/10/13/14/15/16/17/18/19/20) |
| D-072 | 2026-10-21 | Liveness and readiness probes may omit the request id (revisits D-071) |
| D-073 | 2026-10-21 | Stale-text corrections found by the docs set (devai-v3#14–#30) |
| D-074 | 2026-10-21 | Rulings on the docs-set gaps that need a choice (devai-v3#7–#13) |

## Still open

The file's closing "Open" section lists five items ([decisions.md](../../decisions.md)):

- [D-026](../../decisions.md) (`kind:` packets) is provisional until the first DETRAN module is built with `kind:` packets.
- [D-047](../../decisions.md) (edit-loop ceiling) is provisional until the edit-loop p95 is measured on STYNX and DETRAN in both runtimes.
- Mutation testing's home ([D-004](../../decisions.md)): outside the cycle or not at all; not blocking v3.0.
- The 02 §3 step 3 `EXPLAIN` cardinality heuristic: finding or struck ([D-058](../../decisions.md)); not blocking v3.0.
- STYNX's local RC runs PostgreSQL 18 while STYNX CI and v3 pin 16 ([D-069](../../decisions.md)); a STYNX item, not blocking 3.0.0.

## How decisions are made

The pilot writes `decisions.md`; agents may draft entries, and the pilot's commit is the approval. Entries are never deleted; a replaced entry carries `superseded by` ([02 §11](../framework/02-architecture.md)). The file is in protected class `decisions` ([D-031](../../decisions.md), [02 §5](../framework/02-architecture.md)). How the law is changed is on the [changing the law](../dev/changing-the-law.md) page.

Source: [decisions.md](../../decisions.md), [02 §5, §11](../framework/02-architecture.md).
