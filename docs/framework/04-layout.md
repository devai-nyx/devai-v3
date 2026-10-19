# 04 — Repository and module layout

Source: `assessment/stech-repo-layout-conventions-report.md` (2026-10-17; STYNX `bfe12d67`,
TEAT `8880f429`, PEC current; PORM out of scope). The report aligned four STYNX layouts and two
adopters and proposed one target per area. This document turns that target into the v3 layout
contract. Where the report left an Owner decision open, the item is marked **O-nnn** and the
generator form is the provisional default (D-006: the scaffolder is the rail; its output defines
the shape).

O-004…O-007 were closed 2026-10-17 (D-021…D-024). Everything below is binding v3 layout.

## 1. Repository root

```
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

Rules:
- Workspace globs name only folders that contain real packages. No phantom `libs/*`, `tools/*`.
- Root guides are `README.md`, `AGENTS.md`, `CLAUDE.md` (pointer) and `decisions.md` (D-031).
  `CONTEXT`, `MEMORY`, `GOVERNANCE`, `CODESTYLE`, `BUILD-PLAN` and similar fold into
  `docs/meta/eng/` or ADRs. One root guide, routed by relevance (Gloaguen et al.).
- `law/` and `product/` hold real content, never README facades pointing into `docs/`.
- Agent skills live once, in `.agents/skills/`; `.claude/` and `.codex/` carry pointers only.

## 2. Domain module

Target shape (generator form, flat, role-suffixed):

```
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

Rules:
- **No feature folder** under `api/src/` (D-021). Every module in both adopters had exactly
  one, repeating the module name; the generator already dropped it.
- **No layer subfolders** (`controllers/ services/ entities/ guards/ repositories/`). Only
  `dto/` and `adapter/`.
- No per-module ADRs; `README.md` at the module root only. Decisions go to `law/adr/`.
- No wave or phase names in files (`wave1-crud.repository.ts` → `<slug>.repository.ts`).
- `web/src/` is flat and mirrors `api/src/`.
- Scaffolder output must pass the full check DAG before the scaffolder ships (03b §3).

## 3. Database

```
database/
  README.md                           # band table (below) lives here
  ddl/NN-<schema>-<topic>.sql         # tens digit = object kind
  migrations/YYYYMMDD_NN_snake_case.sql   # uniqueness check on prefix
  seed/modules.txt                    # D-023 root manifest: <sha256>  <path> per module SQL file, apply order
  archive/{ddl,seed}-legacy/
  apply.sh  checks.sql
```

DDL band convention (tens digit = kind), adopted D-017:
`00–08` tables by schema · `11–14` functions · `21–24` RLS · `80–89` views and materialized views
(D-040) · `90` assertions · `91–94` comments · `98` seed. The band table is rendered into the
template's `database/README.md`.

Module SQL: `domain/<m>/db/<ns>_<slug>.sql`, applied through the seed/migration manifest
(D-023). Framework-package migrations (STYNX `packages/data/migrations/platform/`) stay where
they are. Migration prefix uniqueness is a check (LINT010 candidate; both STYNX and TEAT have
duplicates today).

## 4. Tests

| Tier | Location | Suffix |
|---|---|---|
| Module unit | `domain/<m>/{api,web}/test/` (D-022) | `*.spec.ts` |
| Module acceptance (spec-derived, S-63) | `domain/<m>/api/test/acceptance/` | `<lowercase-spec-id>.acceptance.spec.ts`; excluded from the unit glob (D-054) |
| App unit | `apps/<app>/test/` | `*.spec.ts` |
| Integration | `test/integration/` | `*.integration.spec.ts` |
| DB | `test/db/` | `*.db.spec.ts` |
| E2E / system | `test/e2e/` | `*.e2e.spec.ts`, `*.playwright.ts` |
| Perf | `test/perf/` | — |
| Support | `test/support/{fixtures,utils,suites}/` | — |
| Generated | `test/generated/<tier>/` with a matching tier glob | — |

Rules:
- Tier is visible in the filename, not only in the folder; the unit glob is `*.spec.ts` minus `*.acceptance.spec.ts` (D-054).
- One root `vitest.config.ts`; tier selection by env `TEST_TIER`.
- A layout check exists (PEC's `check:test-layout`: kebab names, ≤ 350 lines) and runs in the DAG.
- Every tier glob matches something; no orphan test trees (PEC had 497 specs matched by no tier).
- One spelling: `test/` singular at root, module and app level (D-024).

## 5. Governance and docs

| Area | Location | Rule |
|---|---|---|
| ADRs | `law/adr/ADR-<THEME>-NNNN-kebab.md` + `README.md` index | One filename pattern; no ADRs under `docs/` or `domain/*/docs/` |
| Invariants | `law/invariants/INV-<AREA>-NNN.json` | — |
| Product specs | `product/{blueprints,use-cases,workflows}/` | Owner-authored (D-008) |
| Docs | seven sections + `site/` + `_ia/categories.json` | Binaries only in `docs/archive/`; kebab segments; `check:docs-layout` runs in the DAG |
| Workflows | `docs/meta/ops/workflows/<stem>.md` | One page per CI workflow; optional for adopters |

What is **not** carried from the report: `record/`, `.devai/state/`, `work/rounds/R-NNNN/`
(v2 evidence and round machinery; D-002, D-003). v3 defines its own minimal state location in
`02-architecture.md`.

## 6. Scripts and CI

- Kebab-case, verb-first, named after what is checked: `verify-*`, `check-*`, `generate-*`
  (pick one of `generate-`/`gen-`), `run-*`, `list-*`. `.mjs` or `.ts`; helpers in `scripts/lib/`.
- No wave/phase names.
- Every CI concern runnable bare and in Docker (D-011); the switch is declared, not implied.

## 7. Package scope prerequisite

[fact] STYNX publishes `@stynx-nyx/*` 1.6.2; PEC is on `@aarusso-nyx/stynx-*` 0.6.0; TEAT
imports `@stynx-nyx/*` while its `.stynxrc.json` and `CLAUDE.md` still say `@aarusso-nyx/stynx-*`.
Until all adopters are on one scope, a shared boundary config cannot be shared. v3's boundary
check reads `.stynxrc.json` (STYNX's verifier already does) and the template ships one.

## 8. What v3 ships for layout

- A **template** (`devai init`) that emits §1–§6 exactly.
- A **module generator** that emits §2 exactly, with `generation-manifest.json`.
- A **layout checker** (`devai check --only layout`) composed of: module shape, test layout, docs
  layout, migration-prefix uniqueness, workspace-glob sanity, root-guide allowlist, no facades.
  PEC's two checkers are the seed.
- The band table and the layout contract rendered into the template's `database/README.md`
  and `docs/adopters/`.

## 9. Closed 2026-10-17

| # | Question | Decision |
|---|---|---|
| O-004 | Feature folder under `api/src/` | Drop (D-021) |
| O-005 | Unit tests separate or colocated | Separate `test/` (D-022) |
| O-006 | Module SQL location | Per-module `db/` + root manifest (D-023) |
| O-007 | Root test folder | `test/` singular (D-024); orchestrator's provisional `tests/` was reversed on Node-convention and single-spelling grounds |

The report's per-repo change lists (S1–S8, P1–P9, T1–T10) are migration work for the
*existing* repos and are not part of v3's spec; they are what adopting v3 would cost each repo.
Under D-024, PEC and TEAT additionally rename `tests/` → `test/`.
