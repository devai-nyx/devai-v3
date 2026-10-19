<!-- Ratified 2026-10-18 by the Owner (D-059, D-060); campaign proposals adopted and foundation edits E-5/E-6/E-7 applied. Was PROVISIONAL (agents/campaign). -->
<!-- Consolidated · round 5 · Claude Opus 5.5 · 2026-10-18. Base: agents/draft-round-5/claude-fable/09-rail.md; imports from codex-astra/09-rail.md item by item; reviews agents/cross-review-5/{claude-opus,codex-astra}/review.md. Binding inputs D-001–D-058, foundation 01–08. Reference trees read-only: stynx: = /Volumes/Development/projects/stech/stynx @ 63e5f788, devai: = /Volumes/Development/projects/stech/devai @ 4289ff51. Fixture digest recomputed today: 9,347 bytes, sha256 48219a29d82989391c3268d9d0e1fb1dd6a905409dd332f210fa0573b20f1593 (06 §7 lines 263–454, final LF). Rulings P-5-nn: agents/campaign/DECISIONS-PROPOSED.md; foundation edits E-5-nn: agents/campaign/FOUNDATION-EDITS-PROPOSED.md. -->
# 09 — Rail: template, generator, `demo` fixture as shipped

Tags: `[fact]` cited source, `[inference]` consequence, `[opinion]` contract choice. Names the foundation lacked are given here and sent to their owner as E-5 edits (D-055); the one Owner item (P-5-13) is closed by D-059.

## 0. The brake, applied

[opinion] The rail is two commands. `devai init` writes the repository once; `devai new module --spec` writes one module from one approved spec. Every file either writes is read by a 02 §2 node, required by a 03 standard or consumed by 06's parsers. The generator emits the declared contract and nothing else. Business behaviour is a `NotImplementedException` in a seed until a `code` packet replaces it, and the acceptance tests belong to a `test` packet (02 §7, D-035, S-63). Command surfaces are 08's, unchanged: `--web` on the generator; `--lgpd`, `--locales` (starting with `en-US`) and the runtime mode on `init` (D-014, D-034, A.1). `init` has no `--web`.

## 1. Template: `devai init`

[opinion] **Modes.** *Materialise* (`devai.json` absent): `devai init --product <slug>` validates every input before it writes anything. It then:
1. Writes the §1.1 tree, running `git init` if needed.
2. Commits it as `chore(template): devai init <product>` with the trailer `Packet: PKT-DEMO-001`.
3. Renders the four `CMP-DEMO-001` packets with `base` = that commit and commits them as `chore(packets): seed CMP-DEMO-001` (08 A.1).

*Attach* (`devai.json` present, e.g. a fresh clone): writes only the three hooks and sets `core.hooksPath scripts/hooks`, `user.name` and `user.email` in the worktree config (D-057, D-058).

Both modes end with the preflight (exit 2 `tooling-missing`).

[inference] **Ownership.** Template files are `seed` (D-033); attach mode rewrites only the hooks. Template files carry no `@generated` header, because `generated` fails headed files that no module manifest lists, and a template manifest would be a new state file (D-055). The exception is the two contract JSON files. STYNX's write pairs produce them at template release and those pairs' check forms verify them (08 B.16, B.19). The fixture's bytes are fixed by 06 §7 and pinned by the packets' `spec.sha256`, so a hand edit is a PL-04 mismatch.

[opinion] **Shape.** The workspace holds real packages only (04 §1): `apps/api`, `apps/web`, then `domain/*/{api,web}`. Both shells ship from day one: A.1 has no web flag, and a `--web` module needs an Angular app to mount in (08 B.1). Each package extends its published preset [fact: `stynx:tools/tsconfig/node24.json:3`, `angular18.json:3-7`], and `typecheck` orders the projects from the workspace graph (08 B.5). There is no solution file. A root `tsconfig.test.json` puts every `test/` tree under `typecheck` and `lint-tests` (S-32), since package configs include `src` only (P-5-11). STYNX's Vitest `createRequire` serves a workspace resolver, not SWC [fact: `stynx:tools/repo-config/vitest.base.mjs:3,71` vs `:243-254`], so the template imports `unplugin-swc` natively (D-057). STYNX's commitlint scopes are CJS and hand-kept [fact: `stynx:tools/repo-config/commitlint.config.cjs:15-71,73`]; the ESM config computes them at load.

[opinion] **Database.** `apply.sh` is POSIX `sh` and applies, in order (each step with `$PSQL -f` except step 2):
1. `database/ddl/*.sql`
2. the installed `@stynx-nyx/data` platform migrations, through `stynx migrate up --role-prefix <productPrefix>` (D-023, D-070)
3. each path in `database/seed/modules.txt`
4. `database/migrations/*.sql`
5. `database/seed/*.sql`

Module baselines therefore precede any root migration that alters them. No connection string goes on argv: `psql` and `stynx migrate` read `PG*` variables, so 08 B.20's `sh -x` census never prints credentials (E-5-08, D-070).

`modules.txt` is the D-023 root manifest. It is in `sha256sum` form (`<sha256>  <path>` per module SQL file, in apply order), so `sh` reads it with `while read` and LINT013 reads it for immutability (D-043, P-5-04). The generator appends lines and never edits them.

`00-core-bootstrap.sql` creates only `<product>_{owner,app,reader}` (S-18). STYNX's platform migrations hard-code `stynx_*` roles in their applied bytes [fact: `stynx:packages/data/migrations/platform/0001_roles.sql:3-11`]; STYNX's migration runner substitutes the role prefix at apply time (SM-06, stynx-nyx/stynx#401), so the bytes stay immutable (D-033) and the template carries no compatibility layer (07 §5, P-5-12, D-070).

[opinion] **Fixture and packets.** The five fixture bodies are 06 §7's, byte for byte, in every configuration. The spec is 10,035 bytes, sha256 `12e9041f…f30a` (en-US and pt-BR, D-059; R-5/R-6 split, D-064). Init never translates or re-pins them.

The shipped spec carries en-US and pt-BR `i18n` values (06 §7, D-059), so `--locales en-US,pt-BR` passes SL12 and an en-US-only workspace accepts the extra D-014 locale (06 §2). The packets are 05 §7's, with `base` = the template commit. On a fresh template, `--packet PKT-DEMO-002 --full` prints PL-15's `required node skipped for kind: generate: generated (inventory: no generation-manifest.json under domain/)`.

### 1.1 Template file table

Mode is `seed` unless stated. "init-owned" marks the files attach mode rewrites.

| Path | Purpose | Reader (node · standard · tool) | Mode | Header |
|---|---|---|---|---|
| `README.md` | Product readme, ten lines (text 10's) | `layout` root-guide allowlist · S-08 | seed | — |
| `AGENTS.md` | Agent entry, ≤ 60 lines by `wc -l`; carries the 02 §6 runtime line and 02 §10's five items (text 10's) | harness session start · `layout` · `protected:standards` | seed | — |
| `CLAUDE.md` | One line: `@AGENTS.md` | Claude Code | seed | — |
| `decisions.md` | Pilot's decision log; three-line skeleton | `protected-paths` class `decisions` (D-031) | seed | — |
| `devai.json` | 08 A.8 object: `$schema: "https://devai.nyx/schema/devai.json/3"`; `productPrefix` from `--product`; `locales` from `--locales` (default `["en-US"]`); `lgpd` from `--lgpd` (default `false`); `runtime.mode` from `--runtime` (default `bare`), `services.postgres = { bare: "env:DATABASE_URL", docker: "compose:postgres" }`; `protected` = the seven 02 §5 glob sets; `review = { mustRun: false, reviewers: { claude: "codex exec --model gpt-6-astra", gpt: "claude -p --model claude-opus-5-5" } }`; `agentic.permissionsPattern = { minConfidence: 0.7, maxInputTokens: 60000 }`; `check.editLoopCeilingMs = 90000` (D-047, D-058, provisional) | every command (08 Part A) | seed | — |
| `package.json` | Workspace root: `type: module`, `engines >=24 <25`, `packageManager pnpm@9.15.0`, `scripts.test: "devai check --only unit"` (02 §10), STYNX's `prettier` block [fact: `stynx:package.json:130-135`], 07 §2 dev pins (exact), `@devai-nyx/cli` exact at the release version (B.16), only the STYNX packages emitted code imports, at the versions 12 fixes | `inventory` S-07/S-31 · `format` · `lint` · `deadcode` | seed | — |
| `pnpm-workspace.yaml` | `apps/*`, `domain/*/api`, `domain/*/web` | `inventory` S-06 · `layout` (real packages only) | seed | — |
| `pnpm-lock.yaml` | Lock produced at the DEVAI release from the template manifests (12) | `inventory` `toolchainDigest` | seed | — |
| `.gitignore` | `node_modules/ dist/ coverage/ .angular/ .playwright/ .devai/cache/` (never `.devai/review/`) | `inventory` untracked census · C.6 | seed | — |
| `.npmrc` | `@devai-nyx:registry=https://npm.pkg.github.com` · `@stynx-nyx:registry=https://npm.pkg.github.com` · `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` [fact: `stynx:.npmrc:1-3`] | pnpm install · 09 §4 clean install | seed | — |
| `.stynxrc.json` | `{ "boundary": { "roots": ["apps","domain"], "allowedPackages": ["@stynx-nyx/"], "forbiddenImports": [] } }` [fact: shape `stynx:scripts/verify-stynx-boundary.ts:5-10`] | `boundary` S-44 (absence is FAIL, D-058) | seed | — |
| `tsconfig.test.json` | Extends `@stynx-nyx/tsconfig/node24.json`; includes `test/**`, `apps/*/test/**`, `domain/*/*/test/**`; references the package projects | `typecheck` · `lint-tests` | seed | — |
| `eslint.config.mjs` | Default export (S-38) of blocks by folder: `createNestConfig()` for `apps/api/**`, `domain/*/api/**`; `createAngularConfig()` for `apps/web/**`, `domain/*/web/**`; scripts profile for `scripts/**`, `tools/**` [fact: `stynx:tools/eslint-config/index.mjs:395-405`]; the `./test` profile; the `devai/*` overlay of 08 B.3 | `lint` · `lint-tests` · `i18n` (template rule) | seed | — |
| `vitest.config.ts` | One root config; `TEST_TIER` selects brace-free patterns: `unit` = `domain/*/api/test/*.spec.ts`, `domain/*/web/test/*.spec.ts`, `apps/*/test/*.spec.ts`, excluding `**/*.acceptance.spec.ts`; `acceptance` = `domain/*/api/test/acceptance/*.acceptance.spec.ts`; `integration` = `test/integration/*.integration.spec.ts`; `db` = `test/db/*.db.spec.ts` (04 §4, D-054, D-057). A tier is enabled at load iff its patterns match a file (`node:fs` `globSync`), so S-62 holds on a fresh template. Single plugin `swc.vite({ swcrc: false, configFile: false, jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022', keepClassNames: true }, module: { type: 'es6' } })` [fact: `stynx:tools/repo-config/vitest.base.mjs:243-254`]; no `createRequire` | `unit` · `spec-tests` · `integration` · `layout` S-62 | seed | — |
| `playwright.config.ts` | `test/e2e/*.playwright.ts`; browsers supplied explicitly | `e2e` (08 B.23) | seed | — |
| `tools/commitlint.config.mjs` | `export default { extends: ['@commitlint/config-conventional'], rules: { 'scope-enum': [2, 'always', scopes], 'header-max-length': [2, 'always', 100] } }`; `scopes` = workspace package names ∪ `domain/<slug>` names ∪ `template`, `packets` (A.1's two commits; E-5-09), computed at load with `node:fs` | `commitlint` S-40 | seed | — |
| `.changeset/config.json` | Changesets; fixed group = the apps | `openapi` (major changeset vs baseline, S-40) | seed | — |
| `compose.yaml` | One service `postgres`, image `postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` (PostgreSQL 16.15; 12 §3) [fact: `stynx:packages/testing/src/create-test-app.ts:32`], credentials from environment, loopback port 5432, `pg_isready` healthcheck | `db-apply` docker mode (02 §6) | seed | — |
| `scripts/hooks/pre-commit` · `pre-push` · `commit-msg` | 08 A.7 bytes (`exec pnpm exec devai check --hook …`), executable; `core.hooksPath scripts/hooks` | git · `devai check --hook` | seed, init-owned | `#!/bin/sh` |
| `scripts/ci-local/run.sh` | Docker-mode runner: `compose up`, `DEVAI_RUNTIME=docker devai check --full --format json`, `compose down` [fact: Docker required, `stynx:scripts/ci-local/run.sh:72-75`] | the Action's docker job (D-039) | seed | `#!/bin/sh` |
| `.github/workflows/devai.yml` | The one Action (02 §1): per latency class in the declared mode, both modes on D-039 paths, weekly both-mode run, labels from `protected-paths`, PR body from `--summary`, `review`/sensor digest verification (08 C.1); pinned action shas [fact: `stynx:.github/workflows/ci.yml:33-38`]; one aggregating job `devai` is the branch-protection context; no workflow-level `paths` filter [fact: `detran:AGENTS.md:10`]; runner `ubuntu-24.04` | `actionlint` S-43 · GitHub | seed | — |
| `database/README.md` | Band table `00–08` tables · `11–14` functions · `21–24` RLS · `80–89` views/materialized views · `90` assertions · `91–94` comments · `98` seed; apply order; role contract | 04 §3 · S-08 | seed | — |
| `database/apply.sh` | Ordered application (§1), `PG*` environment, no URL on argv | `db-apply` | seed | `#!/bin/sh` |
| `database/checks.sql` | Band-90 `DO $$ … RAISE EXCEPTION` assertions: every non-system table has `relrowsecurity` and `relforcerowsecurity`; `_app`/`_reader` are `NOBYPASSRLS`; policy predicates read only `app.*` (S-17) | `db-apply` | seed | `-- 90 assertions` |
| `database/ddl/00-core-bootstrap.sql` | Roles `<product>_{owner,app,reader}` (S-18) | `db-apply` · `sql-lint` | seed | — |
| `database/seed/modules.txt` | D-023 root manifest, `<sha256>  <path>` per module SQL file, apply order; empty at init | `db-apply` · `sql-lint` LINT013 | seed (generator appends) | — |
| `apps/api/package.json` · `tsconfig.json` · `src/main.ts` · `src/app.module.ts` · `src/validation.filter.ts` | API shell: `StynxCoreModule` (S-70 middleware [fact: `stynx:packages/core/src/core.module.ts:36-53`]), `StynxDataModule` with product roles, `StynxAuthModule`, `StynxI18nModule`, pino with redaction + prom-client (S-71); static `imports: []` (08 F-16); `validation.filter.ts` maps `FLOW_VALIDATION_ERROR` to the route's declared 400 `VALIDATION` entry and message key, without issues or input values | `inventory` mount census · `route-contract` · `typecheck` · `lint` · `integration` | seed | — |
| `apps/web/package.json` · `tsconfig.json` · `angular.json` · `src/main.ts` · `src/index.html` · `src/app/app.component.ts` · `app.config.ts` · `app.routes.ts` | `create-stynx-app` shape [fact: `stynx:tools/create-stynx-app/template/`, eleven files] reduced: standalone, OnPush, selector `<prefix>-root`, request-id interceptor from `@stynx-nyx/angular`, i18n provider loading the module catalogs, empty static routes | `lint` S-50/S-51 · `i18n` · `typecheck` · `e2e` | seed | — |
| `test/support/utils/runtime.ts` | Reads `DATABASE_URL`, `DEVAI_RUNTIME`; connects as `_app`/`_reader`; no testcontainers (02 §6) | acceptance, integration, db tests | seed | — |
| `test/integration/request-id.integration.spec.ts` | Missing or non-UUIDv7 `X-Request-Id` → 400 (S-70) | `integration` (08 B.22) | seed | — |
| `test/db/rls-isolation.db.spec.ts` | Two tenants; isolation observed as `<product>_app`, never owner (S-18) | `integration` | seed | — |
| `test/e2e/shell.playwright.ts` | Web shell renders | `e2e` · S-62 | seed | — |
| `docs/adopters/layout.md` | The layout and runtime contract (04 §8) | `layout` docs predicate · S-08 | seed | — |
| `docs/_ia/categories.json` | Categories of the shipped docs | `layout` (08 B.2 input) | seed | — |
| `docs/framework/contracts/openapi.json` · `public-api-baselines.json` | Contract baselines from the template sources [fact: STYNX default paths, `stynx:scripts/verify-api-coverage.mjs:12-17`, `verify-public-api-baselines.mjs:9-12`] | `generated` (STYNX pairs) · `openapi` | generated (STYNX pair) | — (JSON) |
| `.agents/skills/{devai-task,devai-spec,devai-test,devai-review}/SKILL.md` | Skill texts (10's) | harness on invocation (02 §10) | seed | front matter |
| `product/demo/README.md` · `rules/RN-DEMO-001.md` · `rules/RN-DEMO-002.md` · `product/use-cases/UC-DEMO-001.json` | 06 §7 bodies, byte-identical | `spec-lint` SL02, SL07 · `route-contract` · `protected:product` | seed (bytes fixed) | — |
| `specs/notes/SPEC-DEMO-001.md` | 06 §7 body, 10,035 bytes, `12e9041f…f30a` | generator · `spec-lint` · `route-contract` · `spec-tests` · `packet-scope` | seed (bytes fixed) | — |
| `packets/CMP-DEMO-001/campaign.md` · `PKT-DEMO-001…004.md` | 05 §7 campaign: `001` spec (complete), `002` generate, `003` test with `unimplemented: [R-1, R-2, R-4]`, `004` code; `base` = template commit; `002`'s globs per E-5-07 | `packet-scope` · `accept` · `packets status` | seed | front matter |

Not created, because nothing reads them (D-055, P-5-09):
- `CONTRIBUTING.md`, which `layout`'s root-guide allowlist excludes (04 §1, E-5-05).
- `database/seed.sh`, because `db-apply` invokes only `apply.sh` (E-5-06).
- Content-free locations: `infra/`, `law/`, `product/{blueprints,workflows}/`, the other `docs/` sections, `database/{migrations,archive}/`, `test/{perf,generated}/` and `domain/shared/`.

## 2. Generator: `devai new module --spec`

[opinion] **Admission and rendering.** The generator parses the spec with `spec-lint`'s zod definition (D-056). It refuses a spec that is unapproved, unsigned, has open questions or is invalid (08 A.2). From `devai.json` it reads only `locales`, `lgpd` and `productPrefix`. Rendering is a pure `render(specBytes, options, version) → Map<path, bytes>`, the shape of STYNX's `renderFiles` [fact: `stynx:packages/cli/src/generate-module.ts:430-444`], and `generated` reuses the same function (§3). Writes are staged and committed with one `rename`, using `wx` and a symlink guard [fact: `:492-508`, `:458-472`].

[opinion] **Lowering.**
- **Decorators and boundaries.** The five decorators come in a fixed order. Every `@Body()`, `@Query()` and `@Param()` passes through `parseDto`; an absent input becomes an empty strict object, so any undeclared parameter is a 400 (fixture R-2).
- **Leaves**, from the bound column (06 §2):
  - `varchar` → `z.string().min().max()`, counted in UTF-16 code units (D-054)
  - `uuid` → `z.string().uuid()`
  - `integer` → `z.number().int().min().max()`
  - `boolean` → `z.boolean()`
  - `timestamptz` → `z.string().datetime()`, refined to its bounds
  - `nullable` adds `.nullable()`; `required: false` adds `.optional()`; nothing is coerced.
- **Responses.** `response.status` becomes `@HttpCode`. `response.columns` becomes a strict response schema whose `z.infer` is the handler's return type. No route is tied to a query, because the spec declares no such binding.
- **DDL** uses STYNX's renderer with the roles parameterised [fact: `renderDdl`, `:277-302`; INV-CLI-004]:
  - Defaults: `tenant-context` → `NULLIF(current_setting('app.tenant_id', true), '')::uuid` with an FK to `tenancy.tenants`; `generated-uuid` → `gen_random_uuid()`; `transaction-time` → `now()`.
  - Bounded types get `CHECK … BETWEEN`.
  - Under `lgpd`, `-- @pii: basis=…, retention=…` goes on the line immediately above the column (LINT012).
- **Queries** follow 06 §2's operation forms: `insert … values ($1…) returning …` and `select … where <pk> = $1`. The tenant is never a parameter.
- **Catalogs** are TypeScript (P-5-01). D-033 requires a header in the language's comment syntax, and JSON has none. 04 §2 keeps `api/src` flat. Each is `api/src/<slug>.i18n.<locale>.ts` (locale lowercased: `en-us`, `pt-br`) and exports an `as const` object with keys sorted. `i18n` reads it statically (08 B.13, E-5-11).

[opinion] **No acceptance skeleton.** 02 §7 emits `api/test/acceptance/.gitkeep`, and 05 §3 accepts `spec-tests` `SKIPPED` for `generate` on exactly that ground. S-63 and D-035 give derivation to the test agent. A skeleton of failing `it('R-n: …')` bodies would make `spec-tests` FAIL in a kind that cannot expect red (S-67, D-051).

[opinion] **Generated versus seed.** A file is `generated` when the block and the options fix every byte and no behaviour will be added. It is `seed` when a packet will write into it.
- **Header** (02 §7, literal; P-5-03): `// @generated from SPEC-<ID> do not edit` in TS and JSONC, `-- …` in SQL, `<!-- … -->` in Markdown. Seeds carry no header.
- **generated:** `README.md`, `api/tsconfig.json`, `index.ts`, the module file, `dto/*`, the catalogs, and `db/<ns>_<slug>.sql` until it is base-present. With `--web`: `web/tsconfig.json`, `web/src/index.ts`, `<slug>.routes.ts`.
- **seed:**
  - `api/package.json`, whose dependencies accrue (checked by `depcheck` and `boundary`), starting with `@devai-nyx/decorators` exact at `generatorVersion`.
  - The controller: bodies get written; `route-contract` keeps verifying the decorators.
  - The service: one stub per route, `throw new NotImplementedException('SPEC-<ID> R-n: implement in a code packet')`.
  - The repository. `sql-typed` already compares every `defineQuery` with `queries[]` (08 B.10).
  - `api/test/<slug>.controller.spec.ts`, which asserts an undeclared field → 400 `VALIDATION`, the stub's one rail behaviour.
  - `acceptance/.gitkeep`, because an empty file cannot carry a header (P-5-10).
  - The `--web` components, service and service spec.
- **No API service spec.** A stub has nothing to test, and a test of the stub would have to be deleted by the correct implementation (P-5-08, E-5-04).

[opinion] **Module packages.** `api/package.json` and `api/tsconfig.json` are the only additions to 04 §2's drawing (P-5-02, E-5-04). The reasoning:
- Apps import the barrel by alias (04 §2).
- D-057 runs emitted JS without `tsx`.
- `tsc` does not rewrite `paths`.

So the alias resolves at runtime only as a workspace package name, `@<product>/<slug>-api`.

[opinion] **Manifest and mount.** `generation-manifest.json` is 02 §7's object:
- `generatorVersion` = the package version; STYNX hard-codes `'1.5.0'` [fact: `:441`].
- `specSha256` over the file and `machineBlockSha256` over the fenced YAML.
- `options`.
- `files[] {path, sha256, mode}`, sorted.

It is written as two-space JSON with no timestamp (INV-CLI-002).

The generator appends to `modules.txt` and prints, without acting on them, the mount lines: the `workspace:*` dependency and the `imports` entry in `apps/api`, plus `app.routes.ts` with `--web`. [inference] Editing seed files it does not own would make the generator a merge assistant (D-033), and `route-contract` already fails unmounted routes (08 B.9). Mounting is therefore the `generate` packet's job. Its default globs must admit the app files, `pnpm-lock.yaml` and the write-pair contract outputs (E-5-07).

### 2.1 Generator mapping table

| Spec key | Emitted artifact | Mode | Verifying node |
|---|---|---|---|
| `id` · `status` · `approved-by` | Admission (refuse unless approved); header text; manifest `specId`, `specSha256`, `machineBlockSha256` | — | `generated`, `packet-scope` PL-04 |
| `product` | Nothing; the prefix comes from `devai.json` `productPrefix` (02 §7) | — | `lint` `devai/product-prefix` |
| `module.{name,slug,namespace}` | `domain/<slug>/`; classes `<Prefix><Name>{Module,Controller,Service,Repository}`; files `<slug>.*.ts`; schema `<namespace>` (STYNX reserved set applies, §5); `db/<namespace>_<slug>.sql`; package `@<product>/<slug>-api` | — | `layout`, `lint` S-36, generator admission |
| `routes[]` (method, path, `idempotency`, `roles`, `errorContract`, `useCase`, `slo`) | `api/src/<slug>.controller.ts`: one handler per route; `@Idempotent({headerName,ttlMs})` or `@NoIdempotent()`, `@RequireRoles(roles,'all')`, `@ErrorContract([...])`, `@UseCase(id)`, `@Slo({...})`; `@HttpCode(response.status)`; `parseDto` on every boundary | seed | `route-contract` S-25/S-26/S-28, `lint` (`require-idempotent-route-decorator`) |
| `routes[].request` + `data` | `api/src/dto/<verb>-<noun>.dto.ts`: strict zod body/query/params objects (types, limits, nullability, requiredness) | generated | `route-contract` S-26, `generated` |
| `routes[].response` | Strict response schema in the same DTO file; handler return type | generated | `typecheck` |
| `routes[].errorContract[].messageKey` | Must be keys of `i18n`; no file | — | `spec-lint` SL12 |
| `data.tables[]` | `db/<ns>_<slug>.sql`: schema, grants to the three product roles, table, defaults, CHECKs, FK `tenancy.tenants`, tenant index, ENABLE + FORCE RLS, `app.tenant_id` USING and WITH CHECK policy in the same file; `-- @pii` when `lgpd` | generated until base-present, then immutable (LINT013) | `sql-lint` LINT001/011/012/013, `db-apply`, `sql-typed` DB |
| `queries[]` | `api/src/<slug>.repository.ts`: `defineQuery` per entry (`name`, `sql` text by operation form, params tuple with limits, row schema, `expects`) | seed | `sql-typed` static + DB, `lint` `define-query-location`/`no-raw-query` |
| `i18n` | `api/src/<slug>.i18n.<locale>.ts` per configured locale, keys sorted | generated | `i18n` S-16, `generated`, `spec-lint` SL12 |
| `requirements[]` | `api/test/acceptance/.gitkeep` only (§2) | seed (empty) | `spec-tests` population, `test-integrity` |
| `unimplemented[]` · `sources[]` · `supersedes` | Nothing (README lists ids) | — | `spec-lint`, `packet-scope` |
| whole block | `README.md` ≤ 30 lines · `generation-manifest.json` · `api/package.json` · `api/tsconfig.json` · `api/src/index.ts` · `api/src/<slug>.module.ts` (static arrays) · `api/src/<slug>.service.ts` (stubs) · `api/test/<slug>.controller.spec.ts` · one `database/seed/modules.txt` line | generated · — · seed · generated · generated · generated · seed · seed · appended | `generated`, `layout`, `inventory`, `typecheck`, `unit`, `db-apply` |
| `--web` | `web/package.json` (seed); `web/tsconfig.json`, `web/src/index.ts`, `web/src/<slug>.routes.ts` (generated); `web/src/<entity>-detail.component.ts` when a parameterised GET is declared and `<entity>-list.component.ts` when a collection GET is declared (seed; standalone, OnPush, `input.required()`, selector `<prefix>-<entity>-…`; P-5-07); `web/src/<entity>.service.ts`, one method per route, and `web/test/<entity>.service.spec.ts` (seed) | as listed | `lint` S-50/S-51, `i18n`, `typecheck`, `unit`, `generated` |


## 3. Replay and `--check`

[opinion] `generated` (08 B.16) never trusts the manifest's hashes and never reads the spec at HEAD. Per manifest it:
1. finds the bytes whose sha256 is `specSha256` at HEAD, at the packet `base`, or via `git log --all -- <spec>` and `git cat-file`;
2. verifies `machineBlockSha256`;
3. requires the installed version to equal `generatorVersion`, else `UNKNOWN: generator-version-mismatch`;
4. renders the recorded bytes and options **to memory**;
5. compares each rendered `generated` file byte for byte, and the generated path set with the disk;
6. fails any `@generated` file that no manifest lists.

Ownership comes from the renderer, so changing a DTO's `mode` to `seed` exempts nothing. This is STYNX's file-set-then-bytes `--check` [fact: `:481-489`]; only the STYNX pairs use a scratch tree.

**Base-present module SQL belongs to LINT013, not `generated`.** D-043 chose LINT013 over a `generated` check on the initial DDL. Such an entry leaves B.16's `expected`, and the `modules.txt` hash guards it (P-5-05, E-5-02). A hand edit prints `domain/notes/api/src/dto/create-note.dto.ts:1 differs from regeneration [S-45] regenerate (devai new module --regenerate) or move the logic to a seed file`.

[opinion] **Regeneration** follows A.2. Same-id `--regenerate` rewrites every `generated` entry except base-present SQL (E-5-03), and reports each seed as `seed unchanged, safe to overwrite` or `seed edited, left alone` without writing it. A spec change means a successor (D-053), which A.2 admits inside a `generate` packet when `supersedes.id` equals the manifest's `specId`; otherwise exit 1 `spec-mismatch`.

A.2 admits that successor inside a `generate` packet. In that case:
- non-SQL generated files and the manifest follow the successor;
- base-present SQL stays untouched;
- a `data` change prints `write domain/<slug>/db/<ns>_<slug>_<nn>_<topic>.sql by hand and append it to database/seed/modules.txt`, and `sql-typed` DB fails until that migration exists.

Controller drift is `route-contract`'s finding (02 §7).

## 4. Generator release matrix (S-46, 02 §7)

[opinion] Every cell runs in a temporary workspace: clean registry install, no STYNX checkout, product `demo`, browsers provisioned. Each option cell runs the campaign as commits:
1. `init`.
2. `--packet PKT-DEMO-002 --full`: PL-15 line, exit 1.
3. `new module [--web]`, then mount, `pnpm install` and the write pairs. Commit with `Packet: PKT-DEMO-002`.
4. `--packet PKT-DEMO-002 --full`: exit 0.
5. `packet rebase PKT-DEMO-003 --to HEAD`, add the reference acceptance file, commit.
6. `--packet PKT-DEMO-003 --full --expect-red`: exit 0, `expect-red 3 (R-1, R-2, R-4)`.
7. Rebase PKT-DEMO-004, add the reference service and repository bodies, commit.
8. `--packet PKT-DEMO-004 --full`: exit 0.

Each commit carries its trailer, which PL-12 reads.

**Evidence** (D-037, 08 C.1; P-5-06). No model runs in CI, and no UNKNOWN is exempt.
- `review` does not gate, because `mustRun: false`; it is tallied.
- `permissions-pattern` evidence (`.devai/review/PKT-DEMO-00n.permissions.json`) is produced per cell and packet on the release author's machine before push, then committed. CI verifies its slice digest. Missing or stale evidence is UNKNOWN and fails the PR (02 §7).
- The reference acceptance file keeps rail assertions out of R-1, R-2 and R-4 (D-058); the fixture carries them in R-3, R-5 and R-6 (06 §7, D-064).

Negative cells mutate the default cell (bare, no `--web`, `lgpd: true`, en-US) after PKT-DEMO-004.

| # | Cell | Options · runtime | Expected outcome |
|---|---|---|---|
| O1–O8 | option matrix | `{--web} × {--lgpd} × {pt-BR}` · bare | en-US cells: PKT-DEMO-002/003/004 as above; `--lgpd` cells run LINT012 over the `author_alias` annotation; `--web` cells populate `e2e` and the detail component. pt-BR cells: as en-US, with `i18n` over `notes.i18n.pt-br.ts` (D-059) |
| O9–O16 | option matrix | same eight · docker | identical verdicts; `schemaDigest` equal to the bare cell's (D-039, C.4) |
| N1 | one contract decorator removed from `notes.controller.ts` (five runs, one per decorator) | default | `route-contract` FAIL `lacks @<Decorator> [S-28]`; `lint` FAIL too for `@NoIdempotent` |
| N2 | `parseDto(` removed from the POST body parameter | default | `route-contract` FAIL `@Body() without parseDto [S-26]` |
| N3 | repository `z.string().max(80)` → `max(1024)` | default | `sql-typed` FAIL static (`≠ spec limit`) and DB (`exceeds varchar(80)`) |
| N4a–c | `ENABLE`, `FORCE`, policy lines removed separately from `db/demo_notes_notes.sql` | default | `sql-lint` FAIL LINT001 and LINT013 (base-present); `db-apply` FAIL `checks.sql` forced-RLS assertion |
| N5 | `-- @pii` line removed | default | `sql-lint` FAIL LINT012 and LINT013 |
| N6 | `demo.notes.missing` removed from `notes.i18n.en-us.ts` | default | `i18n` FAIL `spec key absent from en-US`; `generated` FAIL |
| N7a | one `it('R-3: …')` removed | default | `spec-tests` FAIL `uncovered R-3 [S-65]`; `test-integrity` FAIL |
| N7b | acceptance file deleted | default | `spec-tests` SKIPPED → `accept` FAIL PL-15 `required node skipped for kind: code`; `test-integrity` FAIL (deleted `test/acceptance/**` without `@acceptance-change`) |
| N8 | `create-note.dto.ts` `max(80)` → `max(81)` by hand | default | `generated` FAIL `differs from regeneration [S-45]` |
| N9 | `notes.service.ts` edited, then `--regenerate` (same id) | default | exit 0; `seed edited, left alone`; generated files rewritten byte-identical |
| N10 | spec `status: draft` | default | `devai new module` exit 2 `spec-not-approved` |
| N11 | successor spec adds a column, `--regenerate` | default | exit 0; TS regenerated; base-present `db/*.sql` untouched; migration line printed; `sql-typed` DB FAIL until the hand migration exists; editing old SQL → LINT013 FAIL |
| N12 | `@stynx-nyx/cli` uninstalled | default | `route-contract`, `openapi`, `boundary`, `db-apply` `UNKNOWN: tooling-missing` with install lines; exit 2 |


## 5. STYNX relationship

[fact] `stynx:packages/cli/src/generate-module.ts` (509 lines) contains:
- a closed-key validator: `keys()` at `:54-57`; ≤ 48-character, non-reserved identifiers at `:75-79`; reserved schemas at `:13-16`, `:118-119`; route collisions at `:226-229`;
- a `Map<path, Buffer>` renderer with separate TS and SQL headers (`:430-432`);
- the `app.tenant_id` DDL idiom (`:277-302`);
- a file-set-then-bytes `--check` (`:481-489`);
- an atomic staged write (`:496-508`).

[opinion] **What v3 keeps:** the renderer shape, the DDL renderer with parameterised roles, the check, the staged write, the symlink guard, and the **reserved-schema set unchanged**. That set includes `demo`, `data`, `flow`, `jobs`, `notifications`, `outbox` and `worklist`. Matching is exact, so `demo_notes` is admitted.

**What v3 replaces:**
- the validator, with 06's zod definition carrying the same refinements (D-056, E-5-12), dropping the JSON blueprint, `BP-` id and `version`;
- `renderRepository`'s raw `trx.query` (`:327`), with `defineQuery`;
- `renderController` (`:371-429`), with `parseDto` and the five decorators;
- the CRUD operation set (`:12`), with declared routes;
- the literal version (`:441`).

[opinion] **Helpers.** `parseDto` is STYNX's public helper from `@stynx-nyx/flow` [fact: `stynx:packages/flow/src/index.ts:16`], imported without mounting Flow. It throws `FLOW_VALIDATION_ERROR` [fact: `validation.ts:311-319`], which `apps/api/src/validation.filter.ts` maps to the declared `VALIDATION` envelope. v3 ships no fourth helper (02 §1), and the decorators' package identity is 12's.

**Pins** (`stynx:scripts/check-engines.mjs:13-24`, 07 §5):

| Item | Pin |
|---|---|
| Angular | 22.2.1 |
| Nest peer | `^11.1.19` |
| TypeScript | 6.0.3 (`tsAngular`; `tsNode` is `^6.0.3`; the template's `~6.0.3` is D-057's) |
| `@types/node` | 24.13.4 |
| Node | `>=24 <25` |
| pnpm | `pnpm@9.15.0` |
| STYNX packages | 12's versions, never `workspace:*` |

**Browser request-id.** `generateClientRequestId()` in `@stynx-nyx/angular` already builds a UUIDv7 from `crypto.getRandomValues` and `Date.now()` [fact: `stynx:packages-web/angular/src/request-id.ts:1-29`, `src/index.ts:14-15`]. The template registers the interceptor and adds no dependency. Core keeps `node:crypto` [fact: `stynx:packages/core/src/request-id.ts:1`].

**Items for 11:**
- the `Math.random` fallback (`request-id.ts:6-10`) and a functional interceptor (S-50);
- the catalog loader, which reads only `packages/*/i18n/*.json` [fact: `stynx:packages/i18n/src/catalog.service.ts:94-123`];
- the `stynx_*` roles and testcontainers in `createTestApp` [fact: `create-test-app.ts:126,168`].

## 6. Worked example: `devai new module --spec specs/notes/SPEC-DEMO-001.md`

Configuration is 06 §7's: `productPrefix: demo`, `lgpd: true`, `locales: ["en-US"]`, no `--web`. `G` = `// @generated from SPEC-DEMO-001 do not edit`; `<decorators>` = `@devai-nyx/decorators`.

```
domain/notes/README.md                         generated  <!-- @generated from SPEC-DEMO-001 do not edit -->  # Notes — SPEC-DEMO-001
domain/notes/generation-manifest.json          —          { "generator": "@devai-nyx/cli", "generatorVersion": "<release>", "specId": "SPEC-DEMO-001", …
domain/notes/api/package.json                  seed       { "name": "@demo/notes-api", "private": true, "type": "module", "exports": { ".": "./dist/index.js" }, …
domain/notes/api/tsconfig.json                 generated  G
                                                          { "extends": "@stynx-nyx/tsconfig/node24.json", "compilerOptions": { "outDir": "dist", "experimentalDecorators": true, "emitDecoratorMetadata": true }, "include": ["src"] }
domain/notes/api/src/index.ts                  generated  G
                                                          export { DemoNotesModule } from './notes.module.js';  export { demoNotesEnUs } from './notes.i18n.en-us.js';
domain/notes/api/src/notes.module.ts           generated  G
                                                          @Module({ controllers: [DemoNotesController], providers: [DemoNotesService, DemoNotesRepository] })
domain/notes/api/src/notes.controller.ts       seed       import { parseDto } from '@stynx-nyx/flow';  import { ErrorContract, Slo, UseCase } from '<decorators>';
                                                          @Controller() export class DemoNotesController {
                                                            @Post('/notes') @HttpCode(201) @NoIdempotent() @RequireRoles(['demo-member'], 'all')
                                                            @ErrorContract([{ status: 400, code: 'VALIDATION', messageKey: 'demo.notes.invalid' }, … 401, 403, 503 …])
                                                            @UseCase('UC-DEMO-001') @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 500 })
                                                            async create(@Body() body: unknown, @Query() query: unknown): Promise<CreateNoteResponse> { … parseDto(createNoteBody, body); parseDto(emptyQuery, query); … }
                                                            @Get('/notes/:id') @HttpCode(200) @NoIdempotent() @RequireRoles(['demo-member'], 'all') @ErrorContract([… 404 'demo.notes.missing' …]) @UseCase('UC-DEMO-001') @Slo({ …, maxMs: 250 })
domain/notes/api/src/notes.service.ts          seed       @Injectable() export class DemoNotesService { … throw new NotImplementedException('SPEC-DEMO-001 R-1: implement in a code packet'); }
domain/notes/api/src/notes.repository.ts       seed       import { defineQuery, sql } from '@stynx-nyx/data';
                                                          export const insertNote = defineQuery({ name: 'demo_notes.note.insert', text: sql`insert into demo_notes.note (title, author_alias) values ($1, $2) returning id, title, author_alias`,
                                                            params: z.tuple([z.string().min(1).max(80), z.string().min(1).max(40)]), row: noteRow, expects: 'one' });
                                                          export const getNote = defineQuery({ name: 'demo_notes.note.get', text: sql`select id, title, author_alias from demo_notes.note where id = $1`, params: z.tuple([z.string().uuid()]), row: noteRow, expects: 'zero-or-one' });
domain/notes/api/src/dto/create-note.dto.ts    generated  G
                                                          export const createNoteBody = z.strictObject({ title: z.string().min(1).max(80), author_alias: z.string().min(1).max(40) });  export const createNoteResponse = z.strictObject({ … });
domain/notes/api/src/dto/get-note.dto.ts       generated  G
                                                          export const getNoteParams = z.strictObject({ id: z.string().uuid() });  export const emptyQuery = z.strictObject({});
domain/notes/api/src/notes.i18n.en-us.ts       generated  G
                                                          export const demoNotesEnUs = { 'demo.notes.forbidden': 'You cannot access these notes.', 'demo.notes.invalid': 'Invalid note request.', … } as const;
domain/notes/api/test/notes.controller.spec.ts seed       it('rejects an undeclared body field with 400 VALIDATION', …
domain/notes/api/test/acceptance/.gitkeep      seed       (empty)
domain/notes/db/demo_notes_notes.sql           generated  -- @generated from SPEC-DEMO-001 do not edit
                                                          CREATE SCHEMA "demo_notes" AUTHORIZATION demo_owner;
                                                          CREATE TABLE "demo_notes"."note" ( "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES "tenancy"."tenants"("id"),
                                                            "title" VARCHAR(80) NOT NULL CHECK (char_length("title") BETWEEN 1 AND 80),
                                                            -- @pii: basis=RN-DEMO-002/demo-consent, retention=RN-DEMO-002/until-workspace-destruction
                                                            "author_alias" VARCHAR(40) NOT NULL CHECK (char_length("author_alias") BETWEEN 1 AND 40), PRIMARY KEY ("id") );
                                                          ALTER TABLE "demo_notes"."note" ENABLE ROW LEVEL SECURITY;  ALTER TABLE "demo_notes"."note" FORCE ROW LEVEL SECURITY;
                                                          CREATE POLICY "note_tenant_policy" ON "demo_notes"."note" FOR ALL USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (same predicate);
database/seed/modules.txt                      appended   <sha256>  domain/notes/db/demo_notes_notes.sql
stdout                                                    mount: add "@demo/notes-api": "workspace:*" to apps/api/package.json and DemoNotesModule to apps/api/src/app.module.ts imports, then pnpm install
```

## 7. Open items for the Owner

1. **Closed (D-059): pt-BR versus the fixed fixture.** 06 §7 was revised once (E-5-10): the five keys carry pt-BR values, the digest was recomputed, and 06 §2 admits any D-014 locale.

One ruling made here is reversible without touching another document: the generator prints mount lines instead of editing `apps/api` (§2).

## 8. What we are not building

- No CRUD beyond declared routes, queries and tables. No `list`/`update`/`delete` defaults and no plausible service bodies (02 §7).
- No acceptance skeleton, and no test of a behaviourless seed.
- No admin UI, auth implementation, ORM, GraphQL, client generator beyond STYNX's SDK pair, or i18n extraction tool.
- No example module other than `demo`. No template variant per product or locale, and no translated or re-pinned fixture.
- No `devai new app`, no `init --web`, and no locale restriction beyond A.1's.
- No diff-migration generator, seed merge, rewrite of base-present SQL, or historical-manifest replay (D-033, D-043).
- No generator edit of app shells, and no module registry beyond static `imports` (08 F-16).
- No fourth rail helper and no transitional `stynx_*` membership.
- No root solution `tsconfig.json`, vendored STYNX preset or authored `createRequire` (D-029, D-057).
- No models in CI and no UNKNOWN exemption (D-037).
- No `CONTRIBUTING.md`, `seed.sh` or content-free folders (§1.1).
