---
title: Decisions
sidebar_position: 12
description: Index of the 141 numbered decisions D-001 to D-141 in decisions.md, with date and title.
---

# Decisions

[`decisions.md`](../../decisions.md) at the repository root is the record of binding choices. It is part of the law: these pages explain and route to it, never amend it. This index lists all **141 decisions** (D-001…D-141), with the date and title exactly as each heading gives them. The text of a decision, its options and its source are in the file.

Dates: 24 decisions on 2026-10-17 (D-001…D-024), 41 on 2026-10-18 (D-025…D-065), 6 on 2026-10-19 (D-066…D-071), 3 on 2026-10-21 (D-072…D-074), 28 on 2026-10-24 (D-075…D-102), 39 on 2026-10-25 (D-103…D-141). Between D-035 and D-036 the file also holds a section "Corrections accepted from cross-review (no new decision needed)", which has no number.

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
| D-075 | 2026-10-24 | The DAG runner and the verdict cache are DEVAI's; Turborepo is not the scheduler (devai-v3#48) |
| D-076 | 2026-10-24 | Cache inputs are computable sets; model nodes use the general key; stray files are gitignored, not excluded (devai-v3#46) |
| D-077 | 2026-10-24 | The report schema enforces the candidate-independent acceptance invariants; `review` gating stays plan-aware (devai-v3#34) |
| D-078 | 2026-10-24 | `protected:unplanned` is computed against the packet's `protected` at its introducing commit (devai-v3#42) |
| D-079 | 2026-10-24 | Mixed worker family is `UNKNOWN (family)`; D-037 reworded; the evidence files carry no label (devai-v3#43) |
| D-080 | 2026-10-24 | The required check runs from `main` through a ruleset; CODEOWNERS deferred until agent PRs have their own GitHub identity (devai-v3#44) — ruleset superseded by D-091 |
| D-081 | 2026-10-24 | A skipped or pending test case is collected but not observed: `unit` and `integration` report a shortfall `FAIL` (closes the D-077 open item) |
| D-082 | 2026-10-24 | Reviewer and sensor isolation is enforced by the host CLI and then checked in its stream (devai-v3#47) |
| D-083 | 2026-10-24 | The sensor evidence records the threshold it was judged by, and CI re-applies the PR head's (devai-v3#36) |
| D-084 | 2026-10-24 | R6 W1 readings: fifteen adopted as 08 clarifications, three revised, populations and `nodeVersion` ruled (devai-v3#55) — item 7 refined by D-092 |
| D-085 | 2026-10-24 | `sql-lint` runs one invocation over every root; LINT010's day prefix is a STYNX defect; DEVAI re-roots locators (R6 W2 fact sheet b1–b3) |
| D-086 | 2026-10-24 | Exit codes are never trusted alone: pre-flight what DEVAI controls, read verdicts from parsed output (R6 W2 fact sheet b5, b6, b9) |
| D-087 | 2026-10-24 | Config contracts: template `.stynxrc.json` names the 04 roots and is validated by DEVAI; generated routes keep `@RequireRoles` from `@stynx-nyx/backend` (R6 W2 fact sheet b7, b8, b10) |
| D-088 | 2026-10-24 | STYNX publishes the write pair; until then `openapi` and the STYNX `generated` pairs are `tooling-missing` and the contract files are seed (R6 W2 fact sheet c1) |
| D-089 | 2026-10-24 | Stale citations after STYNX 3.0.0 (R6 W2 fact sheet a1–a9; a10 added in review) |
| D-090 | 2026-10-24 | v2 keeps a bounded stabilization window until the first adopter module is green on v3; H7 moves after it (devai-v3#39; amends D-065 items 13 and 16) |
| D-091 | 2026-10-24 | DEVAI requires nothing beyond GitHub Free; D-080's ruleset is retired |
| D-092 | 2026-10-24 | The two `domain/*` workspace globs are seed globs and never raise the no-match finding (refines D-084 item 7) |
| D-093 | 2026-10-24 | Module tsconfigs carry `rootDir` and `composite`; the mount adds the module to the app's `references` |
| D-094 | 2026-10-24 | Each module package declares what its emitted code imports; the root carries tooling only |
| D-095 | 2026-10-24 | The `generate` packet's globs, protected classes and `base` |
| D-096 | 2026-10-24 | `.prettierignore` names the fixed-byte law texts; the generator formats its own output |
| D-097 | 2026-10-24 | Materialise `init` installs `@devai-nyx/cli` at its own version, then commits with live hooks |
| D-098 | 2026-10-24 | 09 §4 campaign: reference files as fixtures, the default cell is O2, negative cells re-stated to 08's forms |
| D-099 | 2026-10-24 | Under `--hook pre-push` an unreadable base is `UNKNOWN` and exits 2 (C.2 over the A.7 "notice") |
| D-100 | 2026-10-24 | R6 closes modulo the S10 list of STYNX defects (cross-references D-088) |
| D-101 | 2026-10-24 | The sensor runs without `--bare` |
| D-102 | 2026-10-24 | The remaining R6 wave Open items are ratified as recorded |
| D-103 | 2026-10-25 | Module packages declare `@stynx-nyx/tsconfig`, the preset their `tsconfig.json` extends (amends D-094's list) |
| D-104 | 2026-10-25 | The generator tags the seeded exports a code packet will consume `/** @public */` |
| D-105 | 2026-10-25 | The `unit` tier initialises Angular's TestBed for web specs from a template setup file |
| D-106 | 2026-10-25 | Campaign step 3 builds the workspace before the generate commit; `new module` prints the build last |
| D-107 | 2026-10-25 | W10's readings are ratified as recorded (devai-v3#69 Open 3, 4, 6–11) |
| D-108 | 2026-10-25 | The app manifests carry `scripts.build: "tsc -b"`, so D-106's `pnpm -r build` builds the module |
| D-109 | 2026-10-25 | D-106's printed line is exactly `mount: then pnpm -r build` |
| D-110 | 2026-10-25 | The `unit` tier is two Vitest projects in the one root config: `unit-api` and `unit-web` (refines D-105) |
| D-111 | 2026-10-25 | The `/** @public */` tag is permanent in `generated` DTO files, removable only in seed files (refines D-104) |
| D-112 | 2026-10-25 | A re-run of `init` on a repository without a `Packet:` commit is a first run, not attach mode (narrows D-107's Open 8 reading) |
| D-113 | 2026-10-25 | An `init` re-run keeps the files on disk, re-runs the install and makes the two commits; `--product` must match (`config-mismatch`) |
| D-114 | 2026-10-25 | `unit` invokes Vitest on the affected spec files by path; an empty Vitest project is left out at load |
| D-115 | 2026-10-25 | `init` is a re-run until both of its commits exist and makes whichever is missing; attach mode starts after both (amends D-112, D-113) |
| D-116 | 2026-10-25 | On an `init` re-run, `--locales`, `--lgpd` and `--runtime` must equal `devai.json` or be omitted (`config-mismatch`) |
| D-117 | 2026-10-25 | The `config-mismatch` hint names the mismatching argument; a refused `init` commit says "run devai init again" |
| D-118 | 2026-10-25 | W11's readings are ratified as recorded (devai-v3#72 Open 3, 4, 7; devai-v3#74 Open 3) |
| D-119 | 2026-10-25 | R6 clause 2 is met at 09 §4 steps 1–4; steps 5–8 are R8 acceptance; R6 closes at 10/10 modulo the S10 list |
| D-120 | 2026-10-25 | `init`'s packets commit carries `Packet: CMP-DEMO-001`; both `init` commits are recognised by their trailers (amends D-115, D-118) |
| D-121 | 2026-10-25 | W11's `config-mismatch` readings are ratified (devai-v3#76 Open 1, 3, 4) |
| D-122 | 2026-10-25 | The `Packet:` trailer takes the campaign id on `init`'s packets commit only; packet-id readers skip `CMP-` values (amends D-050's form) |
| D-123 | 2026-10-25 | The API shell registers the STYNX guards; `apps/api` depends on `@stynx-nyx/backend` |
| D-124 | 2026-10-25 | `packet rebase` evaluates PL-14 at the `--to` base |
| D-125 | 2026-10-25 | A test-only packet's `typecheck` is SKIPPED by `inventory`, as 08 B.5 says: a DEVAI defect |
| D-126 | 2026-10-25 | CI cells run step 3's install with `--no-frozen-lockfile`; the step and the mount line keep `pnpm install` |
| D-127 | 2026-10-25 | `ci.yml` gains an aggregate `matrix` job; H5's contexts stay `build` and `matrix` |
| D-128 | 2026-10-25 | `permissions-pattern` evidence and 12 §3.1's model rows wait on S10 #4 and D-124; R8's replay evidence is recorded |
| D-129 | 2026-10-25 | The shell maps 401/403 to the route's error contract and adds `requestId`; the S10 list gains the tenant check |
| D-130 | 2026-10-25 | R8's campaign readings are ratified (devai-v3#81 Open 6, 7, 8, 12, 13, 17); 12 §4's R8 row names N1–N20 |
| D-131 | 2026-10-25 | The token helper is a section of the acceptance file; D-098's fixtures gain `notes.service.spec.ts` |
| D-132 | 2026-10-25 | The template's `tsconfig.test.json` is a `typecheck` project |
| D-133 | 2026-10-25 | `unit`'s population is spec files in a package containing a changed file or an affected project |
| D-134 | 2026-10-25 | The tenant check is S10 #7; R8 closes on a green `matrix` in both runtimes with its Open list ruled |
| D-135 | 2026-10-25 | PKT-DEMO-004's repository `context` entry names the whole file |
| D-136 | 2026-10-25 | D-129's mechanism: a recording guard, the filter, and a filter module imported last |
| D-137 | 2026-10-25 | The S10 list gains the public health controller; the probes answer 401 until then |
| D-138 | 2026-10-25 | `tsconfig.test.json` references the two app projects; the modules come transitively (amends D-132) |
| D-139 | 2026-10-25 | `init`'s materialise install adds `-w`: `pnpm add -w -D --save-exact @devai-nyx/cli@<own version>` (amends D-097) |
| D-140 | 2026-10-25 | Materialise runs `pnpm add -w …` then `pnpm install`; every printed `pnpm add` remedy takes that shape (amends D-097, D-139) |
| D-141 | 2026-10-25 | The Docusaurus site is published on GitHub Pages from `main` |

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
