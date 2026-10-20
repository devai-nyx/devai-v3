---
title: Repository layout
sidebar_position: 9
description: The product repository and module layout of 04, with the database bands, test tiers, governance locations and DEVAI's own state paths.
---

# Repository layout

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

This is the layout every DEVAI product repository has. `devai init` emits it and `devai new module` emits the module shape ([04 §8](../framework/04-layout.md)); the `layout` node checks it ([08 B.6](../framework/08-cli-and-nodes.md)). Everything in [04](../framework/04-layout.md) is binding; O-004…O-007 were closed by [D-021](../../decisions.md)…[D-024](../../decisions.md).

**Counts:** 17 root entries in the §1 tree (4 root guides, 13 folders and files), 7 DDL bands, 9 test tiers, 5 governance areas, 7 protected classes, 9 DEVAI state locations.

## Root

From [04 §1](../framework/04-layout.md):

```text
<repo>/
  README.md  AGENTS.md  CLAUDE.md(→AGENTS.md)  decisions.md (D-031, protected)
  specs/<area>-<capability>/SPEC-*.md   # technical specs, protected (D-027)
  packets/<CMP>/PKT-*.md   campaign.md  # task packets, protected (D-027, D-050)
  apps/<role>/                   # product app shells: api, web, portal, mobile, …
  domain/<area>-<capability>/    # business modules (see §2)
  domain/shared/api/src/         # code shared across modules, named explicitly
  database/                      # DDL baseline, migrations, seeds, apply scripts (see §3)
  test/                          # higher-tier tests (see §4)          D-024
  scripts/                       # kebab, verb-first; helpers in scripts/lib/
  infra/<tool>/                  # cdk | cloudformation | …
  product/{blueprints,use-cases,workflows}/   # business specs, Owner-authored (D-008)
  law/{adr,invariants}/          # technical decisions and invariants (see §5)
  docs/{framework,meta,adopters,reference,start,site,_ia}/
  .agents/skills/<name>/SKILL.md # agent skills; thin per-tool pointers elsewhere
  .stynxrc.json                  # STYNX boundary config, checked by STYNX's own verifier
```

| Rule | Source |
|---|---|
| Workspace globs name only folders that contain real packages; no phantom `libs/*`, `tools/*` | [04 §1](../framework/04-layout.md) |
| Root guides are `README.md`, `AGENTS.md`, `CLAUDE.md` (pointer) and `decisions.md`; other guide files fold into `docs/meta/eng/` or ADRs | [04 §1](../framework/04-layout.md), [D-031](../../decisions.md) |
| `law/` and `product/` hold real content, never README facades pointing into `docs/` | [04 §1](../framework/04-layout.md) |
| Agent skills live once, in `.agents/skills/`; `.claude/` and `.codex/` carry pointers only | [04 §1](../framework/04-layout.md) |
| `specs/` and `packets/` are at the root and protected | [D-027](../../decisions.md) |

## Domain module

From [04 §2](../framework/04-layout.md) (generator form, flat, role-suffixed):

```text
domain/<area>-<capability>/           # single word when area == capability (billing, not billing-billing)
  README.md
  generation-manifest.json            # generated modules only
  api/
    package.json  tsconfig.json       # workspace package @<product>/<slug>-api (09)
    src/
      index.ts                        # barrel: apps import by alias (the package name), never deep relative paths
      <slug>.i18n.<locale>.ts         # one per configured locale, tag lowercased (09)
      <slug>.module.ts
      <slug>.controller.ts            # <resource>.controller.ts when several
      <slug>.service.ts
      <slug>.repository.ts            # one per module; data access lives here
      <slug>.guard.ts | .decorator.ts | .mapper.ts      # only when needed
      dto/<verb>-<noun>.dto.ts
      adapter/<x>.adapter.ts  <x>.http.adapter.ts        # integration modules only
    test/
      <slug>.controller.spec.ts       # D-022; <slug>.service.spec.ts is added by the code packet (09)
  web/
    package.json  tsconfig.json
    src/
      index.ts
      <entity>-list.component.ts  <entity>-detail.component.ts  # for a declared collection / parameterised GET only (09)
      <entity>.service.ts
      <slug>.routes.ts
    test/
  db/
    <ns>_<slug>.sql                   # D-023
    <ns>_<slug>_<nn>_<topic>.sql      # hand-written migrations once the baseline is applied (D-033)
```

| Rule | Source |
|---|---|
| No feature folder under `api/src/` | [D-021](../../decisions.md) |
| No layer subfolders (`controllers/ services/ entities/ guards/ repositories/`); only `dto/` and `adapter/` | [04 §2](../framework/04-layout.md) |
| No per-module ADRs; `README.md` at the module root only; decisions go to `law/adr/` | [04 §2](../framework/04-layout.md) |
| No wave or phase names in files | [04 §2](../framework/04-layout.md) |
| `web/src/` is flat and mirrors `api/src/` | [04 §2](../framework/04-layout.md) |
| Unit tests in a separate `test/` folder, not colocated | [D-022](../../decisions.md) |
| `defineQuery(` only in `*.repository.ts` (an AST rule in `lint`) | [08 B.3](../framework/08-cli-and-nodes.md) |
| Scaffolder output must pass the full check DAG before the scaffolder ships | [04 §2](../framework/04-layout.md) |

## Database

From [04 §3](../framework/04-layout.md):

```text
database/
  README.md                           # band table (below) lives here
  ddl/NN-<schema>-<topic>.sql         # tens digit = object kind
  migrations/YYYYMMDD_NN_snake_case.sql   # uniqueness check on prefix
  seed/modules.txt                    # D-023 root manifest: <sha256>  <path> per module SQL file, apply order
  archive/{ddl,seed}-legacy/
  apply.sh  checks.sql
```

| DDL band (tens digit = kind) | Objects |
|---|---|
| `00–08` | tables, by schema |
| `11–14` | functions |
| `21–24` | RLS |
| `80–89` | views and materialized views ([D-040](../../decisions.md)) |
| `90` | assertions |
| `91–94` | comments |
| `98` | seed |

Adopted by [D-017](../../decisions.md). Module SQL is `domain/<m>/db/<ns>_<slug>.sql`, applied through the seed/migration manifest ([D-023](../../decisions.md)). A module's tables and their ENABLE/FORCE RLS policies stay together ([06 §5](../framework/06-spec-format.md)). Migration-prefix uniqueness is LINT010; a SQL file present at base is immutable (LINT013, [D-033](../../decisions.md), [D-043](../../decisions.md)). `database/migrations/**` is in protected class `infra` ([D-046](../../decisions.md)). `apply.sh` applies the platform migrations (its step 2) with `stynx migrate up --role-prefix <productPrefix>`, using `PG*` variables and no URL on argv ([D-070](../../decisions.md), [09 §1](../framework/09-rail.md)).

## Tests

From [04 §4](../framework/04-layout.md):

| Tier | Location | Suffix |
|---|---|---|
| Module unit | `domain/<m>/{api,web}/test/` | `*.spec.ts` |
| Module acceptance (spec-derived, S-63) | `domain/<m>/api/test/acceptance/` | `<lowercase-spec-id>.acceptance.spec.ts`; excluded from the unit glob |
| App unit | `apps/<app>/test/` | `*.spec.ts` |
| Integration | `test/integration/` | `*.integration.spec.ts` |
| DB | `test/db/` | `*.db.spec.ts` |
| E2E / system | `test/e2e/` | `*.e2e.spec.ts`, `*.playwright.ts` |
| Perf | `test/perf/` | — |
| Support | `test/support/{fixtures,utils,suites}/` | — |
| Generated | `test/generated/<tier>/` with a matching tier glob | — |

| Rule | Source |
|---|---|
| Tier is visible in the filename; the unit glob is `*.spec.ts` minus `*.acceptance.spec.ts` | [04 §4](../framework/04-layout.md), [D-054](../../decisions.md) |
| One root `vitest.config.ts`; tier selection by env `TEST_TIER` | [04 §4](../framework/04-layout.md) |
| Kebab names, ≤ 350 lines (layout check) | [04 §4](../framework/04-layout.md) |
| Every tier glob matches something; no orphan test trees | [04 §4](../framework/04-layout.md), S-62 |
| One spelling: `test/` singular at root, module and app level | [D-024](../../decisions.md) |

## Governance and docs

From [04 §5](../framework/04-layout.md):

| Area | Location | Rule |
|---|---|---|
| ADRs | `law/adr/ADR-<THEME>-NNNN-kebab.md` + `README.md` index | One filename pattern; no ADRs under `docs/` or `domain/*/docs/` |
| Invariants | `law/invariants/INV-<AREA>-NNN.json` | — |
| Product specs | `product/{blueprints,use-cases,workflows}/` | Owner-authored ([D-008](../../decisions.md)) |
| Docs | seven sections + `site/` + `_ia/categories.json` | Binaries only in `docs/archive/`; kebab segments; `check:docs-layout` runs in the DAG |
| Workflows | `docs/meta/ops/workflows/<stem>.md` | One page per CI workflow; optional for adopters |

Not carried from v2: `record/`, `.devai/state/`, `work/rounds/R-NNNN/` ([04 §5](../framework/04-layout.md), [D-002](../../decisions.md), [D-003](../../decisions.md)).

## Scripts and CI

From [04 §6](../framework/04-layout.md): kebab-case, verb-first names after what is checked (`verify-*`, `check-*`, `generate-*`, `run-*`, `list-*`), `.mjs` or `.ts`, helpers in `scripts/lib/`; no wave/phase names; every CI concern runnable bare and in Docker ([D-011](../../decisions.md)). The three hook scripts live in `scripts/hooks/` ([08 A.7](../framework/08-cli-and-nodes.md)).

## Protected classes

The seven classes and their template globs are on [devai.json](./devai-json.md) ([02 §5](../framework/02-architecture.md)).

## DEVAI state

From [02 §11](../framework/02-architecture.md) and [08 C.4](../framework/08-cli-and-nodes.md):

| State | Where | Tracked? |
|---|---|---|
| Check cache | `.devai/cache/{nodes,results,reports}/` | no (gitignored) |
| Agentic verdict cache | `.devai/cache/agentic/<node>/<digest>.json` | no |
| Scratch worktrees, index copies, scratch-DB descriptors | `.devai/cache/scratch/` | no |
| Review result | `.devai/review/<packet-id>.json` | yes, in the PR branch |
| Sensor verdict evidence | `.devai/review/<packet-id>.permissions.json` | yes, in the PR branch |
| Packets | `packets/<CMP>/PKT-*.md`, `packets/<CMP>/campaign.md` | yes |
| Technical specs | `specs/<area>-<capability>/SPEC-*.md` | yes |
| Decisions | `decisions.md` | yes |
| Generation record | `domain/<m>/generation-manifest.json` | yes |

Source: [04 §1–§9](../framework/04-layout.md), [02 §5, §11](../framework/02-architecture.md), [08 A.7, B.3, B.6, C.4](../framework/08-cli-and-nodes.md), [09 §1](../framework/09-rail.md), [D-017](../../decisions.md), [D-021](../../decisions.md)–[D-024](../../decisions.md), [D-027](../../decisions.md), [D-031](../../decisions.md), [D-040](../../decisions.md), [D-046](../../decisions.md), [D-070](../../decisions.md).
