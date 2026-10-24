<!-- Final — D-066: 186 low-confidence rows ruled as recorded; 11-ledger.json sha256 e06736842b1fba2b373c06bf93e73713bb7df590ed6bb8993da0b8a6916e37e3. One-time history; never edited again. -->
<!-- Consolidation 7 · Claude Opus 5.5 · 2026-10-18. Base: agents/draft-round-7/claude-opus (reviews split; reason in NOTES). Binding: foundation/decisions.md D-001–D-058, 01–08; 09–10 PROVISIONAL. Reference trees read-only: stynx: = /Volumes/Development/projects/stech/stynx @ 63e5f788; devai: = /Volumes/Development/projects/stech/devai @ 4289ff51 (law/ clean). Full ledger: 11-ledger.json (316 rows). Rows or rulings marked PROVISIONAL (P-7-nn) await the Owner (agents/campaign/OWNER-PENDING.md). Not promoted to foundation/. -->
# 11 — STYNX migration items and the v2 law ledger

Tags: `[fact]` cited source or command output, `[inference]` consequence, `[opinion]` choice.

## 0. The brake, applied

[opinion] This document has two outputs and no mechanism. Part A lists only STYNX changes without which a named v3 node stays `UNKNOWN` or `FAIL` on the generated template or on STYNX itself (D-007). Part B classifies each v2 law record once. `11-ledger.json` is a dated classification, not a register: nothing in v3 reads it, and no node, command or file depends on it (D-055). A row lands only where 02–10 bind a STYNX artifact by name. Candidates dropped under the brake are listed in "What we are not building".

## Part A — STYNX migration items

### A.1 What the tree says today

[fact] Re-verified at `stynx:63e5f788`:

1. **Module format.** None of the 31 backend `packages/*/package.json` declares `"type": "module"`; the chain sets `module: NodeNext` (`tools/tsconfig/base.json:5-6`), so output is CommonJS. `dist/` is git-ignored (`.gitignore:73,81`), so emitted files must be inspected after a build, not through `git grep`.
2. **Tooling packages.** All three tools are `@stynx-internal/*`, `private: true`, 0.2.0, outside the `.changeset/config.json:5-51` fixed group. `tools/eslint-config/package.json:8-11` has no `./test` export. `tools/tsconfig/base.json:17-58` carries checkout-relative `paths` aliases.
3. **Migration linter.** Rules LINT001–009 only (`src/types.ts:2-10`); CLI takes `--format`, `--fix-suggestions` and one target (`cli.ts:8-34`); a parser-load failure returns `null` and skips validation (`parser.ts:6-8,13-15`).
4. **Typed queries.** No `defineQuery`, `ResultOf` or `sql` tag; `Transaction.query` is public (`packages/data/src/transaction.ts:108`); 259 `.query(` sites in 48 non-test files.
5. **Request id.** A missing `X-Request-Id` is synthesised (`core.module.ts:42`); an invalid one is already rejected (`:43`).
6. **Authorization.** The guard reads the session (`sessionService.getActive`, `stynx-auth.guard.ts:95,152`) and then `PermissionCache` (`:96,157`), which falls through Redis to SQL. The STYNX token carries `perms_hash`, not permissions (`stynx-jwt.validator.ts:77-85`).
7. **CLI and topology.** `@stynx-nyx/cli` has one bin; none of the six D-057 entry points exists (`packages/cli/src/cli.ts:25-156`). `StynxI18nModule` declares its controller inside `forRoot()` (`packages/i18n/src/i18n.module.ts:19`), which D-058's static walk reports as `UNKNOWN mount-unresolved`.
8. **SDK.** `openapi-typescript-codegen` is a devDependency (`packages-web/sdk/package.json:44`); the package ships only `dist` (`:24`), so its `codegen` script is not published.

### A.2 Items

Waves give implementation dependency order: a row starts once every row it names is built and callable in the STYNX candidate. SM-21 publishes the fixed group once; every row's acceptance is then rerun against that published `<v>` (12 §3) in an empty consumer directory unless the command names the STYNX tree. Candidate-only results are not acceptance.

| Id | What | Source | v3 element that starts observing | Acceptance (command → expected) | Wave · after | Size |
|---|---|---|---|---|---|---|
| SM-01 | Backend packages author and emit ESM: `"type": "module"`, `.js` relative specifiers, no authored `require`/`createRequire`/`module.exports`/`__dirname` | D-012, D-057; S-31 | `inventory` (manifest `type`), `lint` (`no-authored-cjs`), `typecheck`: FAIL → PASS | `for f in packages/*/package.json; do jq -r .type $f; done \| sort \| uniq -c` → `31 module`; after `pnpm -r build`: `grep -rlE '^Object\.defineProperty\(exports\|= require\(' packages/*/dist --include=*.js \| wc -l` → `0`; in the consumer, `node --input-type=module -e "await import('@stynx-nyx/core')"` → exit `0` | 1 | L |
| SM-02 | Publish `@stynx-nyx/tsconfig` (renamed from `@stynx-internal`) in the fixed group: `./base.json`, `./node24.json`, `./lib.json`, Angular profile; no checkout aliases; `typescript` peer `~6.0.3` | D-029, D-057; S-19; 07 §1:14 | `typecheck`, `inventory` (`tsc --showConfig`): UNKNOWN tooling-missing → observing | `{"extends":"@stynx-nyx/tsconfig/node24.json"}` → `npx tsc --showConfig \| jq -r .compilerOptions.module` → `nodenext`; Angular profile → `es2022`; `jq '.compilerOptions.paths // {} \| length' node_modules/@stynx-nyx/tsconfig/base.json` → `0` | 1 | S |
| SM-03 | Publish `@stynx-nyx/eslint-config` ESM with `./test`; named factories for lib, Nest, Angular, scripts and tests (S-38) resolve from the consumer root | D-029, D-057; 08 B.3–B.4 | `lint`, `lint-tests`: UNKNOWN tooling-missing → observing | `npm view @stynx-nyx/eslint-config@<v> exports --json \| jq 'has("./test")'` → `true`; one fixture file per enabled rule family (`no-explicit-any`, each `no-unsafe-*`, boundaries, idempotency, CJS) → `eslint --max-warnings=0` exit `1` naming that rule; the clean fixture → exit `0` | 1 | M |
| SM-04 | Publish `@stynx-nyx/migration-linter` (bin `stynx-migration-lint`) with `--lgpd`, `--base-dir`, `--manifest`; LINT010 (global prefix), LINT011 (`app.*` GUC only), LINT012 (`-- @pii:` under LGPD), LINT013 (applied bytes vs manifest); parser, base or manifest unavailable → `parserIssues`/explicit error, exit `2`, never a clean result | D-029, D-043, D-057; S-24; 08 B.7:267 | `sql-lint`: UNKNOWN tooling-missing → observing | Full-flag run → JSON and exit `0`/`1`, never `Unknown flag`; one fixture per rule (two roots sharing `0012_`; `auth.` GUC in a policy; PII column without `@pii` under `--lgpd`, accepted without it; one byte changed in a manifest-listed file) → exactly that `LINT01n`, exit `1`; `pg-query-emscripten` removed or `--manifest` path missing → exit `2` | 1 | L |
| SM-05 | **(P-7-04 → D-059).** Applied STYNX SQL is not rewritten (D-033). Duplicate prefixes `0012`×2, `0018`×4 stay; legacy `auth.*`/`stynx.*` GUCs in `database/ddl` policies are replaced by a *new* migration that recreates those policies on `app.*` | S-17; 03b gaps §12.3–12.4; D-033 | `sql-lint` LINT011 on the STYNX repository (D-007). No template node: 08 B.7's population excludes package migrations | After reset + migrations: `psql -Atc "select count(*) from pg_policies where coalesce(qual,'')\|\|coalesce(with_check,'') ~ 'current_setting\(''(auth\|stynx)\.'"` → `0`; `git diff --stat <base> -- packages/data/migrations database/ddl` → additions only | 2 · SM-04 | S |
| SM-06 | Product roles: a product bootstraps and connects as `<product>_{owner,app,reader}`; `createTestApp` takes the role names. Done by parameter or new migration, never by editing applied files (D-033; else P-7-04) | S-18; 09 §1:37; P-5-12 → D-060 | `db-apply`, `integration` (isolation as `<product>_app`): FAIL → observing | Bootstrap for prefix `demo` → `psql -Atc "select count(*) from pg_roles where rolname like 'stynx\_%'"` → `0` and `select rolbypassrls from pg_roles where rolname='demo_app'` → `f`; `grep -c stynx_ packages/testing/src/create-test-app.ts` → `0` (today `:126-127`) | 1 | M |
| SM-07 | Six `@stynx-nyx/cli` entry points with 08's grammar: `list-routes --json --roots`, `verify-stynx-boundary --json` (reads `.stynxrc.json`, absent → FAIL, scanned-file census), `verify-api-coverage --strict --json`, `verify-openapi-contract --json`, `verify-public-api-baselines --json`, `verify-rls-negative --json --ddl`; check forms never write | D-057; 08 B.9:295, B.16:393, B.17:407, B.19:435, B.20:449 | `route-contract`, `generated`, `boundary`, `openapi`, `db-apply` (RLS-negative step): UNKNOWN tooling-missing → observing | Each on the clean template → exit `0` and `jq -e 'type=="object"'`; `verify-stynx-boundary --json \| jq '.scanned \| length > 0'` → `true`; one seeded violation per command → non-zero with a locator; `git status --porcelain` after all six → empty | 2 · SM-01 | L |
| SM-08 | Typed-query helper in `@stynx-nyx/data`: `defineQuery`, `sql` (zero holes), `run`, `ResultOf` without `any`, `QueryArgumentError`, cardinality check, row validation on every result; `Transaction.query` `@internal` | D-030, D-010, D-013; 02 §3; S-21, S-27 | `sql-typed` static + DB: UNKNOWN tooling-missing → observing | `typeof m.defineQuery, typeof m.sql` → `function function`; `grep -B3 'async query<' packages/data/src/transaction.ts \| grep -c '@internal'` → `1`; `tsc --noEmit` on ``sql`${x}` `` → error; `run` with an over-limit argument → `QueryArgumentError` and no SQL sent; `one` with 0 rows → `NotFoundError`; a row failing `row` → typed error | 2 · SM-01 | M |
| SM-09 | STYNX's data layer moves to `defineQuery`; only the single checked executor keeps raw calls | 02 §3:165-167; D-007 | `lint` `devai/no-raw-query` on STYNX: FAIL → PASS | `devai check --only lint` on STYNX → no `devai/no-raw-query` finding; `git grep -cE '\.(query\|execute)\(' -- 'packages/*/src/*.ts' ':!*.spec.ts'` → only the executor's file (today 259 `.query(` sites in 48 files) | 3 · SM-08 | L |
| SM-10 | **(P-7-03 → D-059).** `@ErrorContract`, `@UseCase`, `@Slo` ship from v3 (`decisions.md:232`; 02 §1:20); package identity in 12. STYNX's part: `@Idempotent/@NoIdempotent`, `@Permission`, `@RequireRoles` stay exported and typed from the published packages | S-25, S-28; decisions "Corrections accepted" | `route-contract` on template write routes: FAIL → observing once 12 publishes the v3 decorators | In the consumer, `typeof` of `Idempotent`, `NoIdempotent` (`@stynx-nyx/idempotency`), `Permission` (`@stynx-nyx/auth`) and `RequireRoles` (`@stynx-nyx/backend`) → `function` ×4, with `.d.ts` present (`idempotency/src/decorators.ts:5,12`; `auth/src/decorators.ts:25`; `backend/src/authorization/decorators.ts:10`) | 2 · SM-01 | S |
| SM-11 | `no-explicit-any` and every `no-unsafe-*` at `error` in the published profiles and root config; STYNX passes | D-013; S-33 | `lint` on STYNX: FAIL → PASS; v3 overlay becomes a no-op | `eslint --print-config packages/core/src/index.ts \| jq -c '[.rules\|to_entries[]\|select(.key\|test("no-unsafe-\|no-explicit-any"))\|.value[0]]\|unique'` → `[2]`, entry count = the installed plugin's `no-unsafe-*` count + 1 (today `off`, `index.mjs:308-312`); `pnpm lint` → `0` | 2 · SM-03 | L |
| SM-12 | `boundaries` deny-by-default with an explicit allow list | S-37; 03b gap §12.5 | `lint` (S-37) on STYNX: FAIL → PASS | `print-config` → `boundaries/dependencies` `default` = `disallow` (today `allow`, `index.mjs:298`); undeclared-edge fixture → exit `1`; `pnpm lint` → `0` | 2 · SM-03 | M |
| SM-13 | `stynx/require-idempotent-route-decorator` at `error`; lint scripts pass `--max-warnings=0` | 03b gap §12.6; 02 §2 `lint` | `lint` gating on warn-level rules: FAIL → PASS | `print-config` level → `2` (today `warn`, `index.mjs:345`); `jq -r .scripts.lint package.json` contains `--max-warnings=0` (today absent, `:15`) | 2 · SM-03 | S |
| SM-14 | Authorization from verified-token claims only: the token carries permissions; the guard reads no session, `PermissionCache`, Redis or SQL on the request path. Short TTL + session-id revocation stay STYNX design items that must pass the unchanged sensor — **P-7-05 → D-059** | D-025, D-009; S-12; 02 §4:210-228 | `permissions-pattern`: FAIL (`stynx-auth.guard.ts:95-96,152,157`) → observing | `git grep -nE 'permissionCache\|getActive\(\|PermissionQueryService' -- packages/auth/src/stynx-auth.guard.ts` → no output; guard test with session, DB, Redis and network stubs that throw → valid claims allow, missing/expired/invalid claims deny, `RequireRoles` all/any kept; `devai check --only permissions-pattern` on the template → no finding | 2 · SM-01 | L |
| SM-15 | A missing `X-Request-Id` is rejected like an invalid one, before authentication | S-70; D-014; 06:422-424 | `integration` "request without id": FAIL → PASS | `curl -s -X POST localhost:3000/notes` without the header and without a token → status `400`, body `jq -c '{code,requestId}'` → `{"code":"VALIDATION","requestId":null}`, keys exactly `code,messageKey,requestId` (today synthesised, `core.module.ts:42`) | 2 · SM-01 | S |
| SM-16 | Browser request id without the `Math.random` fallback; functional interceptor. Conditional on 09; S-50 does not itself forbid class interceptors | 09 §5 "Items for 11"; S-70 | `lint` (S-50) on the template web app wiring it: FAIL → PASS (09 ratified, D-060) | `grep -c Math.random packages-web/angular/src/request-id.ts` → `0` (today `:8`); `grep -c HttpInterceptorFn packages-web/angular/src/request-id.interceptor.ts` → `≥1` (today a class, `:7`) | 2 | S |
| SM-17 | `@stynx-nyx/testing` without testcontainers: `createTestApp` uses the resolved runtime (`DATABASE_URL`) in both modes | 02 §6:304-307; D-011; 08 B.22:476 | `integration` in bare mode: UNKNOWN/FAIL → observing | `jq '[.dependencies,.devDependencies]\|map(has("testcontainers"))' packages/testing/package.json` → `[false,false]` (today `:46`); `git grep -c testcontainers -- packages/testing/src` → no output; the template integration suite with Docker unreachable and `DEVAI_RUNTIME=bare` → exit `0`, and with `docker` → exit `0` | 2 · SM-06 | M |
| SM-18 | Replace `openapi-typescript-codegen` (deprecated, unmaintained upstream) and publish the generation/check pair as **`stynx-sdk-codegen --check --input <openapi.json> --output <dir>`**, a bin of `@stynx-nyx/sdk` — **P-7-06 → D-059** | S-20 note (D-057); 08 B.16:393 | `generated` SDK pair: UNKNOWN tooling-missing → observing | `stynx-sdk-codegen --check …; echo $?` → `0` on the committed SDK, `1` after editing one generated file, `git status --porcelain` empty either way; `jq '[.dependencies,.devDependencies]\|map(has("openapi-typescript-codegen"))' packages-web/sdk/package.json` → `[false,false]` (today devDependency, `:44`) | 2 · SM-07 | M |
| SM-19 | i18n: module catalogs register without scanning the STYNX checkout; default locale **en-US**, pt-BR when opted in | S-16; D-014; 09 §5 (`catalog.service.ts:94-123,133`) | `integration` localized-error cases on generated modules: FAIL → observing | In the consumer: a generated module's key resolves through `CatalogService` with no `packages/*/i18n` present; no locale configured → `en-US` (today `pt-BR`, `:133`); `pt-BR` configured → pt-BR value | 2 | S |
| SM-20 | Consumed STYNX modules expose `imports`/`controllers` statically (e.g. `StynxI18nModule`'s controller in `@Module`, not in `forRoot()`); runtime options stay in providers | D-058; 08 B.1:176; 09 §1:74 (mounts `StynxI18nModule`) | `inventory` mount census: UNKNOWN mount-unresolved → observing, unblocking `route-contract` and `permissions-pattern` | `devai check --only inventory` on the template → no `mount-unresolved`; route count = routes actually mounted, each once; an unmounted fixture controller is not counted | 2 · SM-01 | M |
| SM-21 | One fixed-group semver release carrying the template-gating rows SM-01–04, 06–08, 10, 13–20; SM-05, 09, 11, 12 may follow and gate STYNX's own adoption; exact versions handed to 12 as template pins | D-029, S-19; 09 §5 pins | `devai init` preflight: every `UNKNOWN: tooling-missing` clears | `npm view @stynx-nyx/{core,flow,angular,data,cli,testing,auth,backend,idempotency,i18n,tsconfig,eslint-config,migration-linter,sdk}@<v> version` → fourteen identical lines | 4 · all | S |

[inference] The critical path is SM-01 → SM-08 → SM-09, with SM-14 alongside: the two L items that change runtime behaviour. [opinion] SM-11 is the least certain size: 03 Part C expects `no-unsafe-*` to surface typing debt, so measure it before setting the template date. Shipping a row lets its node observe; it does not make the node PASS. Counts, findings and prerequisites still decide (08 §0; D-045).

## Part B — v2 law ledger

### B.1 Method

[fact] 316 rows, one per record in the brief's areas: 41 constitution articles (each hashed over its own text), 128 `law/adr/*.md` (127 ADRs and the generated `README.md`), 39 invariants, 104 policy files (35 top-level, 10 `adopter-defaults`, 59 `sensor-notes`), 2 security and 2 targets. `law/glossary/` holds only `.gitkeep`; `law/trace.json` and `law/schemas/` are outside the brief's list and get no rows. Both drafts' hashes agree on all 316 rows, and this consolidation recomputed every one (0 mismatches).

[inference] The two drafts' JSONs were reconciled row by row (P-7-01, P-7-02). Where they agreed (153 rows) the bucket stands. Where they split (163 rows) the row is `confidence: low` and names the other bucket in `alternative`. Two rules decided the split:

- ABSORBED against non-ABSORBED: the non-absorbed bucket wins. Absorption needs a v3 mechanism that uses the obligation, not resemblance.
- REJECTED against JOURNAL: REJECTED only where the decision's text names and rules out the mechanism (D-002, D-005, D-018, D-019, and D-036 for coverage percentages); otherwise JOURNAL. D-004 forbids only the delivery gate, which v2's own ADR-MUT-0012 had already removed, so the remaining mutation records are journal.

186 rows carry `confidence: low` (163 splits, 23 that either draft marked low).

### B.2 Counts per bucket

| Bucket | Rows | Targets (count) |
|---|---|---|
| ABSORBED-DECISION | 7 | D-004, D-008, D-026, D-033, D-035, D-044, D-058 1 each |
| ABSORBED-STANDARD | 9 | S-65 3 · S-63 2 · S-64 2 · S-40 2 |
| ABSORBED-SPEC | 17 | 02 §2 3 · 07 §6 2 · 08 §A.6 2 · 08 §C.2 2 · 01 "What v3 is", 01 "The loop", 02 §8, 02 §10, 04 §1, 04 §5, 06 §2, 08 §C.1 1 each |
| JOURNAL | 90 | archive |
| REJECTED | 193 | D-005 68 · D-002 43 · D-019 27 · D-018 23 · D-006 5 · D-016, D-028, D-036 4 each · D-034, D-044, D-057 3 each · D-056 2 · D-003, D-035, D-037, D-049 1 each |
| **Total** | **316** | |

### B.3 Counts per v2 area

| Area | Rows | A-DEC | A-STD | A-SPEC | JOURNAL | REJECTED |
|---|---|---|---|---|---|---|
| Constitution articles | 41 | 4 | 3 | 6 | 6 | 22 |
| `law/adr/*.md` | 128 | 2 | 2 | 5 | 46 | 73 |
| `law/invariants` | 39 | 1 | 3 | 4 | 10 | 21 |
| `law/policy` (top level) | 35 | 0 | 1 | 1 | 14 | 19 |
| `law/policy/adopter-defaults` | 10 | 0 | 0 | 1 | 4 | 5 |
| `law/policy/sensor-notes` | 59 | 0 | 0 | 0 | 6 | 53 |
| `law/security` | 2 | 0 | 0 | 0 | 2 | 0 |
| `law/targets` | 2 | 0 | 0 | 0 | 2 | 0 |
| **Total** | **316** | **7** | **9** | **17** | **90** | **193** |

### B.4 Reading the ledger

[inference] **What crossed.** 33 records (10 %) were absorbed, where v2 said something true about observation:

- an error is never a verdict, and an empty set is never a pass (S-65);
- tests are sensors, and weakening is detectable (S-63, S-64);
- only PASS is cacheable, and the hard gate is a set of named nodes (02 §2);
- one result shape for every node (08 C.2);
- mutation testing is external hardening (D-004);
- `AGENTS.md` is canonical, with pointers elsewhere (04 §1).

None crossed as v2 text. Each was re-derived and re-numbered, as the succession precedent requires: "Law transfers; evidence standing does not" (`reference/succession-2026-07/D-196.md:60`).

[inference] **Why the rejections cluster.** Four decisions account for 161 of the 193 rejections:

| Decision | Rejections | What it rules out |
|---|---|---|
| D-005 | 68 | Scorecard grid, readings store, sensor cells |
| D-002 | 43 | Evidence chain, signed release and export machinery |
| D-019 | 27 | Path authority, roles, broker admission |
| D-018 | 23 | Backlog, locks, rounds, experimental controller |

[opinion] This is the second-system mass D-055 names: the rejections measure how much of v2 governed itself rather than the plant.

[inference] **JOURNAL rows** are v2 records whose subject no v3 decision addresses: ADR validation machinery, config projection, mutation evidence after ADR-MUT-0012, the framework repository's own data-handling and threat declarations, and operational ADRs (Pages publication, merge queue). The archive keeps them citable. None is a promise to implement.

## What we are not building

- No register, index or status field derived from the ledger, and no tool that reads, validates or syncs it. The JSON exists for the Owner's review and for 12's succession record.
- No forward maintenance: if a v3 decision changes, this ledger is not edited (D-002, D-055).
- No rows for `law/trace.json` or `law/schemas/` (outside the brief's areas).
- No STYNX changes beyond Part A. In particular:
  - no "one `StynxError` per exported name" check: 03b §3 asks for it, but no node of the 28 owns it, and the conflict is sent to the foundation edits (E-7-03), not settled here;
  - no repair of the old `demo-bookmark` exemplar: v3's generator replaces it (09 §5), and generated output still has to pass the full DAG (S-46);
  - no signal `input()/output()` rewrite of STYNX web packages: the template does not import them;
  - no renumbering of applied migrations and no LINT010 exemption list (P-7-04).
- No STYNX-side fixture suites as deliverables: acceptance is the commands above.
- No seventh `@stynx-nyx/cli` entry point: the SDK check form is a bin of the SDK package (P-7-06).
