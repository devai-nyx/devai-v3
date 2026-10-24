# 02 — Architecture

Consolidated 2026-10-18 from the round-1 drafts (Claude Fable, Codex Astra) and both cross-reviews,
under D-001…D-040 and the accepted corrections in `decisions.md`. Binding inputs: `00-intent.md`,
`03-standards.md`, `03b-stynx-extraction.md`, `04-layout.md`. Reference trees are read-only, cited as
`stynx:` (`/Volumes/Development/projects/stech/stynx` @ `63e5f788`), `devai:` (`…/devai` @
`4289ff51`), `detran:` (`…/detran` @ `b2c5d389`). Tags: `[fact]` observed, `[inference]` derived,
`[opinion]` design choice. The node names used in this document are exactly the twenty-eight of §2.

## 1. Components

v3 is one CLI (`devai`), three route decorators, one typed-query contract implemented inside STYNX,
one template, one generator, three git hooks, one GitHub Action and four skill files. Everything else is
the harness's.

| Component | What is code | What is prose | What is delegated |
|---|---|---|---|
| **Rail: template** `devai init` (D-058) | Emits 04-layout §1–§6: workspace, `devai.json` (§6), `database/README.md` band table (D-017, D-040), `compose.yaml`, hooks, Action, `AGENTS.md` (≤ 60 lines), root `decisions.md`, `specs/`, `packets/` (D-027, D-031); depends on published `@stynx-nyx/{eslint-config,tsconfig,migration-linter}` (D-029) | `AGENTS.md`, `database/README.md`, module `README.md` stubs | Nothing |
| **Rail: module generator** `devai new module --spec` | Grows `stynx:packages/cli/src/generate-module.ts` [fact: 509 lines; deterministic; `--check` compares file set and bytes, `:474-491`] into the 04-layout §2 shape; input is the spec's machine block (06, second round) | Module `README.md` (generated, ≤ 30 lines) | Nothing |
| **Rail: helpers** | Decorators `@ErrorContract()`, `@UseCase()`, `@Slo()`, shipped by `@devai-nyx/decorators` (S-28; 12 §1.1), which depends on neither STYNX nor the CLI [fact: STYNX has `Public`/`PublicTenantRoute`/`System`/`ReadOnly`/`Permission` at `stynx:packages/auth/src/decorators.ts:9-25`, `Idempotent`/`NoIdempotent` at `packages/idempotency/src/decorators.ts:5-12`, `RequireRoles`/`RequirePermissions` at `packages/backend/src/authorization/decorators.ts:10-14`, and none of the three]. Typed-query helper (`defineQuery`, `run`, `ResultOf`, `sql` tag) lives in `@stynx-nyx/data` next to `Database.tx()` (D-030): DEVAI owns the contract (§3), STYNX implements it and marks `Transaction.query` `@internal` | TSDoc | Nothing |
| **Harness: `devai check`** | DAG runner (§2), cache (§11), report writer (§8), hooks installer, tooling preflight | Hook messages (one line each) | Process isolation; the harness's own parallelism |
| **Pilot interface** | Packet file (05), spec file (06), `devai check --summary`, PR body written by the Action | The packet and the spec are the only prose the pilot authors | Editing, chat, approvals UI |
| **Independent reviewer** (`review` node) | Snapshot checkout, bounding, two-phase prompt assembly, output validation, `review.json`; CI digest verification | One prompt (§9), ≈ 700 tokens | Model execution by the other-family CLI on the pilot's machine (D-037) |
| **Agentic sensor** (`permissions-pattern`) | Slice locator, prompt, output contract, cache (§4) | One question (§4) | Model execution |

**Tooling distribution is a prerequisite, stated as a standard (S-19, D-029).** [fact] The three
tools are `@stynx-internal/*`, `private: true`, 0.2.0, workspace-local (`stynx:tools/*/package.json`).
v3 never vendors or re-expresses them. The preflight reports a missing package as `UNKNOWN: tooling
missing` for `lint`, `typecheck` and `sql-lint` with the install command; the template does not ship
until the packages exist as ESM semver releases in the fixed group. [fact] STYNX's backend emits
CommonJS today (03-standards Part B S-31); under D-012 the STYNX ESM migration also precedes the
template release.

Not components: scheduler, journal, lock, round controller, dispatcher, evidence chain, scorecard
grid, role identities, constitution (D-002, D-003, D-005, D-018, D-019). Subagents, worktrees,
sandboxes, compaction, native memory, skills, scheduled runs and MCP are the harnesses'.

## 2. The check DAG

Design rules. **(a)** Invoke STYNX tooling where it exists; v3 adds only the nodes marked *new*.
**(b)** Every node reports `expected`, `observed`, `evaluated`; `observed = 0` is `UNKNOWN`, never
`PASS`; `observed < expected` against a complete inventory is `FAIL` (S-65, §8). **(c)** Only `PASS`
is cacheable. **(d)** A node declares `needs: ['postgres']` or nothing; the runtime layer (§6)
satisfies it bare or in Docker. **(e)** Latency **A** sub-second, **B** ≤ 30 s, **C** minutes. Where:
**E** edit loop, **C1** pre-commit (staged), **P** pre-push, **R** PR, **F** full acceptance.
**(f)** Population completeness comes from `inventory`, which runs first and is global; nodes select
*what to evaluate* from the change, never *what exists*. [inference] A duplicate migration prefix is
visible only against unchanged files, and an app-binding change alters mounted routes without
touching a controller; a change-scoped selector misses both (Codex F-5).

Cache key: `sha256(nodeId, nodeVersion, toolchainDigest, configDigest, runtimeMode,
sortedInputDigests, dependencyResultDigests)`; `toolchainDigest` = node/pnpm versions +
`pnpm-lock.yaml`; `configDigest` = the node's config files. This is v2's content-addressed scheme
[fact: `devai:packages/cli/src/services/check-runner/cache.ts:111-177`, only PASS reusable] without
hand-written input selectors: inputs are the changed files' project closure from `tsc -b` references
and the workspace graph `inventory` produces [inference]. DB-backed results are keyed by the schema
digest `db-apply` emits, reproducible in both modes, so bare mode is never penalised. Model results
use the same key plus their model components (prompt digest, model id; for `review` also the
candidate digest, `specSha256` and the packet digest), so a `review` PASS is bound to the
`report.json` it read and falls with any prerequisite's result (D-076).

An adopter that runs Turborepo (STYNX does) keeps two graphs on purpose: `turbo` caches package
builds and test runs by declared task outputs; `.devai/cache` caches node verdicts bound to a
candidate digest, PASS only, with dependency *result* digests in the key. They hold different
objects and neither replaces the other; DEVAI does not schedule nodes through Turborepo (D-075, 07 §7).

| Node | Standards | Mechanism (inputs in italics) | Lat. | Where |
|---|---|---|---|---|
| `inventory` | S-06, S-07, S-31 | *new*: package graph from workspace globs (real packages only); Corepack/pnpm engine check; every package manifest has `"type": "module"`; mounted-route, file and test populations; base diff with deletes, untracked files and symlinks. *Repo.*  Mounted-route census from static `imports`/`controllers` arrays (D-058); dynamic module factories → `UNKNOWN mount-unresolved`. | A | all |
| `format` | S-41 | Prettier `--check`, STYNX root config. *Changed `*.{ts,mjs,json,md}`; SQL is `sql-lint`'s (D-058: Prettier 3.9.6 has no SQL language).* | A | E, C1 |
| `lint` | S-01, S-05, S-25, S-31, S-33–S-38, S-41, S-50, S-51 | ESLint with the published STYNX profiles [fact: `stynx:tools/eslint-config/index.mjs:395-411`] plus a v3 overlay: `no-explicit-any`/`no-unsafe-*` → `error` (D-013; `off` at `:308-312`), `require-idempotent-route-decorator` → `error` (`warn` at `:345`), `boundaries` → `default: 'deny'` (`allow` at `:298`; S-37), `import/no-commonjs` (S-31), selector-prefix and naming rules per app prefix (S-36, D-032), S-38 entry-point exception, `devai/no-raw-query` (§3); always `--max-warnings=0`. *Changed files + project.*  + `devai/define-query-location` (`defineQuery` only in `*.repository.ts`, D-058) | B | E, C1, R |
| `lint-tests` | S-60 | `tools/eslint-config/test.mjs` CW-1 [fact: `:48-57`]. *Changed `*.spec.ts`.* | A–B | E, C1, R |
| `typecheck` | S-30–S-33 | `tsc -b` with the published `tools/tsconfig` chain [fact: `base.json` `module: NodeNext`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`]; effective options (`tsc --showConfig`) must keep the chain's `module` and strictness; a `commonjs` emit is a finding (D-012). *Affected closure.* | B | E, P, R |
| `layout` | 04-layout, D-017, D-021–D-024, D-027, D-031, S-62 | *new*: module shape, flat `api/src`, `test/` spelling, tier-in-filename, every enabled tier glob matches ≥ 1 file, docs layout, workspace-glob sanity, root-guide allowlist, no facades,; seed: PEC `check:test-layout`/`check:docs-layout`. *Full path set.* | A | E, P, R |
| `sql-lint` | S-02, S-15, S-17, S-24, D-033 | STYNX `tools/migration-linter` LINT001–009 [fact: `src/types.ts:1-11`; libpg_query via `pg-query-emscripten`] + v3 rules: LINT010 duplicate prefix (global), LINT011 policies reference `app.*` only (S-17), LINT012 PII column carries `-- @pii: basis=…, retention=…` when `lgpd: true` (S-15), LINT013 a SQL file present at base is byte-identical at head (D-033). *Changed `*.sql` + migration population.* | A | E, C1, R |
| `spec-lint` | S-25, D-008, D-016 | *new*: required fields of 06; every spec route carries the five contract fields; every requirement's `source:` resolves to an existing rule or use-case artifact and its quoted obligation appears there (§14); use-case ids resolve into `product/use-cases/*.json` [fact: `detran:product/use-cases/boat.json`, 82 `UC-BOAT` ids]; approved specs carry the annotation. *Changed `specs/**`, `product/**`.* | A | E, P, R |
| `route-contract` | S-10, S-11, S-20, S-22, S-25, S-26, S-28, S-70 | *new*, on `stynx:scripts/list-routes.mjs` and `verify-api-coverage.mjs`: every mounted route role-bound or `@Public`; every write route carries `@Idempotent|@NoIdempotent`, `@Permission`/`@RequireRoles`, `@ErrorContract`, `@UseCase`, `@Slo` as decorators (sidecar `*.errors.json`/`*.slo.json` are not declarations, S-28); every `@Body()`/`@Query()`/`@Param()` passes `parseDto` or a typed pipe (S-26); `@UseCase` ids exist; spec route table ⇔ code; UUIDv7 request-id middleware mounted in every app (S-70). *Mounted routes, affected controllers, spec, use-cases.* | B | E, P, R |
| `sql-typed` | S-21, S-27 | *new*, §3. **Static** (no DB): literal text, `$n` continuity and count, declared limits vs the spec's entity block, unique `name`. **DB** (`needs: postgres`, after `db-apply`): `PREPARE`/describe, OID mapping, column limits. *Changed `*.repository.ts`; schema digest.* | A / B | E static; P, R, F DB |
| `unit` | tests | Vitest, `TEST_TIER=unit`. *Affected projects.* | B | E, P, R |
| `test-integrity` | S-63, S-64 | *new*: in changed test files, `.skip|.only|.todo` without an issue reference, literal verdicts (`status: 'passed'`, `expect(true)`), deleted/renamed `test/acceptance/**` files without `// @acceptance-change: approved-by=` in the replacement, assertion-count drop > 20 % without an acceptance change; removal of an expected acceptance case is `FAIL`; no changed tests → `SKIPPED`. *Changed `test/**` vs base; expected cases from the spec.* | A | E, P, R |
| `i18n` | S-16 | *new*: every `en-US` key exists in each opted-in locale; `@angular-eslint/template/i18n`. *Catalogs, templates.* | A | E, P, R |
| `actionlint` | S-43 | actionlint. *Changed `.github/**`.* | A | P, R |
| `commitlint` | S-40 | commitlint, scope = package or module slug. *Message.* | A | commit-msg |
| `generated` | S-45, D-033 | *new*: regenerate every `mode: generated` file from the pinned generator version and recorded inputs; compare bytes and file set (STYNX's `--check` property, `generate-module.ts:481-489`), never a manifest-hash comparison; STYNX `:write`/`--check` pairs for SDK, OpenAPI, baselines. *Manifests, generated files.* | B | P, R |
| `boundary` | S-34, S-44 | `scripts/verify-stynx-boundary.ts` reading `.stynxrc.json`. *Manifests, imports.* | B | P, R |
| `deadcode` | S-42 | knip, depcheck, `madge --circular`. *Workspace.* | B–C | P, R |
| `openapi` | S-20, S-22, S-23, S-40 | `api:coverage --strict`, contract and public-API baselines; a breaking baseline diff without a matching major changeset is a finding. *Sources, `openapi.json`, `.changeset/`.* | B–C | P, R |
| `db-apply` | S-01, S-02, S-13, S-18 | `database/apply.sh` from an empty DB + module `db/` via the seed manifest (D-023) + `checks.sql` + `verify-rls-negative.mjs`; emits the schema digest; `needs: postgres`. *DDL, migrations, seeds.* | C | P (SQL changed), R, F |
| `spec-tests` | setpoint, S-61, S-63, S-65 | Vitest over `domain/<m>/api/test/acceptance/*.acceptance.spec.ts` named in the packet; `expected` = `acceptance: yes` requirements, `observed` = `it` blocks tagged `R-n:` collected; `--expect-red` per §8; `needs: postgres`. *Packet, acceptance tests.* | B–C | F, R |
| `integration` | tiers, S-02, S-18, S-70 | `test/integration`, `test/db`; template-emitted tests: RLS isolation as `<product>_app`, never as owner (S-18); a request without a request id is rejected, except an id-less `GET`/`HEAD` `/healthz` or `/readyz` probe (D-072), and ids are UUIDv7 (S-70); `needs: postgres`. *Affected.* | C | P (affected), R |
| `e2e` | tiers | `test/e2e` Playwright. *Apps.* | C | R |
| `permissions-pattern` | S-12 | agentic, §4. *Permission slice.* | C + tokens | F, R |
| `protected-paths` | D-019, D-027, D-031 | hook/Action, §5. *Old and new paths vs base.* | A | P (notice), R (label) |
| `packet-scope` | 05, D-026 | *new*: changed files ⊆ `paths.allowed`; `paths.forbidden` untouched; spec digest = the packet's frozen digest; `generation-manifest.json` changed only by a `generate` packet. *Packet, diff.* | A | F, R |
| `review` | D-003, D-028, D-035, D-037, S-66 | independent reviewer, §9. *Candidate digest, spec, packet, `report.json`.* | C + tokens | F; R verifies digest |
| `accept` | D-005, S-65 | *new*: aggregation of every planned node, population reconciliation, zero-observation rewrite, exit code, text report and summary (§8). *All results.* | A | all |

Edges: `inventory → everything`; `db-apply → sql-typed(DB) → spec-tests, integration`;
`typecheck → route-contract, openapi`; `route-contract → permissions-pattern`; every deterministic
node and `permissions-pattern` precede `review`; everything precedes `accept`. A failed prerequisite
yields `UNKNOWN` with the dependency's locator, never an omitted row.

Affected subset for the edit loop (`devai check`, no flags): `format lint lint-tests typecheck layout
sql-lint spec-lint route-contract sql-typed(static) unit test-integrity i18n`; `sql-typed(DB)` joins
when Postgres is already reachable in the declared mode. Warm, `typecheck` and `unit` dominate
[inference; v2's 339 s `test:cli` median ran an 85k-LOC package's whole suite,
`devai:product/campaigns/CMP-0007-gate-throughput/decisions.md:24-42`]. The service level is
measured on the first module before it is fixed (§14).

Pre-commit runs `format lint lint-tests sql-lint` on the staged snapshot (STYNX's lint-staged does the
first two [fact: `stynx:.husky/pre-commit`]). Pre-push adds `generated boundary deadcode openapi
actionlint`, `db-apply`/`integration` when SQL or data-layer files changed, and the `protected-paths`
notice. Full acceptance (§8) runs every applicable node. PR runs everything deterministic as a job
matrix per latency class and verifies the `review` digest; v2's partition and aggregator design is
not carried [opinion].

## 3. S-21 mechanism — typed raw SQL with validated arguments

Clarified intent (D-010): every raw query is type-safe or type-enforced, and its arguments are
validated against known limits and schemas before execution; shared location is a means. [fact]
STYNX bans `pg` imports outside `data`/`cli` and uses `$n` parameters
(`stynx:tools/eslint-config/index.mjs:24-27`); `Transaction.query<TRow>(text, values?: unknown[])`
takes a caller-supplied result generic and forwards it to the driver unvalidated
(`packages/data/src/transaction.ts:108-114`); ≈ 517 `.query(` sites vs ≈ 128 builder calls (STYNX
report §3). Both drafts chose the same mechanism and rejected the same alternatives (builder-only
cannot express `SKIP LOCKED` and `set_config` idiomatically; SQL-in-lint pulls a database into `lint`;
query-file codegen adds a generated-artefact class): **schema-enforced query definitions plus a
DB-backed node**. The limit lives in the artefact, is checked against the schema, and is enforced at
runtime.

**Authoring form** (the shared location is `*.repository.ts`, layout-checked):

```ts
// domain/crash-record/api/src/crash-record.repository.ts
import { defineQuery, sql } from '@stynx-nyx/data';          // D-030
import { z } from 'zod';

export const insertCrashVehicle = defineQuery({
  name: 'est.crash_vehicle.insert',
  text: sql`insert into est.crash_vehicle (crash_record_id, vehicle_snapshot_id, role, sequence, apparent_damage)
            values ($1, $2, $3, $4, $5) returning id`,     // RLS scopes the tenant; no predicate here
  params: z.tuple([z.string().uuid(), z.string().uuid(),
                   crashVehicleRoleSchema,                   // string-literal union, no enum (S-36)
                   z.number().int().min(1).max(99),
                   z.string().max(512).nullable()]),        // ≤ the column's varchar(512) (S-27)
  row: z.object({ id: z.string().uuid() }),
  expects: 'one',                                           // 'one' | 'zero-or-one' | 'many' | 'none'
});
```

**Contract** (signatures; STYNX implements them in `@stynx-nyx/data`):

```ts
export type Expects = 'one' | 'zero-or-one' | 'many' | 'none';
export interface TypedQuery<P extends z.ZodTuple, R extends z.ZodObject, E extends Expects> {
  readonly name: string; readonly text: string; readonly params: P; readonly row: R; readonly expects: E;
}
export function defineQuery<P, R, E>(q: TypedQuery<P, R, E>): TypedQuery<P, R, E>;
export function sql(strings: TemplateStringsArray, ...holes: never[]): string;   // interpolation is a type error
export type ResultOf<Q> = Q extends TypedQuery<infer _P, infer R, infer E>          // C-7 conceded; no `any` (D-013)
  ? E extends 'one' ? z.output<R> : E extends 'zero-or-one' ? z.output<R> | null
  : E extends 'many' ? readonly z.output<R>[] : void : never;
// On Transaction (from Database.tx(), which sets and re-verifies the app.* GUCs):
run<Q>(q: Q, params: z.input<Q['params']>): Promise<ResultOf<Q>>;
```

`run` parses `params` before binding (failure → `QueryArgumentError`, mapped to 400; internal callers
cannot evade limits), executes with `$n` binding, checks the row count against `expects` (`one` with
0 rows → `NotFoundError`), and **validates every returned row against `row` before exposing it, in
every environment** (F-9 conceded; an invalid row is a typed infrastructure error that leaks no
contents). Tenant ids come from the transaction's verified context, never from arguments. Lint rule
`devai/no-raw-query` forbids `.query(`/`.execute(` on `Transaction`/`PoolClient`, aliases and
indirect imports, everywhere except the single checked executor inside `@stynx-nyx/data`; **no
package-wide exemption**: STYNX's own data layer migrates to typed definitions (D-007).

**What `sql-typed` verifies.** Static part (class A, no DB, edit loop): text is a literal (`sql` tag
with zero holes), `$n` is contiguous and equals the tuple length, `name` is unique, and for generated
modules the declared limits match the spec's entity block. DB part (`needs: postgres`, against the
schema `db-apply` produced):

1. `PREPARE devai_q AS <text>`; read `parameter_types` and `result_types` from
   `pg_prepared_statements` [inference: `result_types` is documented for PostgreSQL 16, not exercised
   here]; column **names** come from the protocol's RowDescription through the driver's describe
   path, since the view does not carry them. Prepare failure → finding with the server message.
2. Parameter count = tuple length; each OID maps to the zod leaf through an **explicit table**:
   `uuid`→`z.string().uuid()`, `int2|int4`→`z.number().int()`, `int8`→`z.bigint()`,
   `text|varchar|bpchar`→`z.string()`, `timestamptz|timestamp`→`z.date()`, `date`→`z.string().date()`,
   `bool`→`z.boolean()`, `numeric`→`z.string()`, `json|jsonb`→declared object schema,
   `_<type>`→`z.array(leaf)`. **A type outside the table yields `UNKNOWN` with the OID**, never a guess.
3. Result columns = `row` keys with compatible OIDs; `expects: 'one'|'zero-or-one'` requires a
   unique-key predicate or `limit 1` (heuristic via `EXPLAIN`, warning only [inference]).
4. **Limits** (S-27): for every parameter bound to a column, resolved from the parsed statement with
   libpg_query [fact: already a STYNX dependency, `tools/migration-linter/src/parser.ts:3`], the zod
   `max` ≤ `character_maximum_length`, integer ranges within the column type, nullability per
   `is_nullable` for insert/update targets, `char_length(x) BETWEEN a AND b` constraints as `min/max`.
5. The query text digest goes into `report.json` so the reviewer sees which queries changed.

Result nullability and business predicates are not provable by describe; runtime row validation and
spec-derived tests cover them. No dynamic SQL; finite identifier or ordering variants are separate
static definitions. The adapter needs a prototype before its latency estimate is accepted.

## 4. S-12 agentic check — the template for a model as a sensor

D-009: pattern guideline, narrow agentic check, no runtime enforcement. D-025: S-12 stands as
written; the question is exactly "is authorization decided from the verified token only, with no DB,
cache or network call on the request path".

**Slice location (deterministic, from the mounted-route inventory).** Slice = mounted routes →
global and route guards → permission predicates and token-to-principal construction → transitive
calls through concrete DI bindings, **including STYNX package sources** (F-2 conceded: filename globs
miss the decision point). A cache library or remote client in the closure is included, not assumed
SQL-free. Token issuance and refresh routes are excluded. Missing source, unresolved dynamic dispatch
or an unbound guard yields `UNKNOWN` before any model call. **Bound: 60k input tokens** (12k was
infeasible: `stynx:packages/auth/src` alone is ≈ 25k); above it, `UNKNOWN: slice too large` with the
file list, and acceptance fails closed.

**The current STYNX guard fails this sensor.** [fact] `StynxAuthGuard.canActivate` calls
`this.permissionCache.getForSession(claims)` on every protected request
(`stynx:packages/auth/src/stynx-auth.guard.ts:96,157`); `PermissionCache` tries memory, then Redis,
then `PermissionQueryService.resolveForUser`, which runs SQL (`permission-cache.ts:162`,
`permission-query.service.ts:28`; `dbFallbackOnRedisDown` at `permission-cache.ts:123`). The token
carries claims and a session id, not permissions. Under D-025 that is a STYNX migration item (token
carries permissions; short TTL and a session-id revocation list are STYNX design items), not a
tolerance in the sensor: until it lands, every STYNX adopter's `permissions-pattern` is `FAIL` with
those locators, which is the correct reading.

**The single question** (the whole prompt after the slice):

> Every protected route must decide authorization from claims carried in the verified bearer JWT (or
> the request principal derived from it) and must not issue a database query, cache lookup or network
> call to obtain permissions or roles while handling the request. Token signature verification and
> JWKS retrieval are allowed. For the code above, answer only with JSON matching the schema:
> `{"verdict":"compliant"|"violation"|"unknown","inspectedEntrypoints":[...],"findings":[{"path","line","statement","evidence"}],"unresolved":[...],"confidence":0..1}`.
> Report a finding for every place where permissions or roles are read from anything other than the
> token-derived principal, or where a guard awaits a repository, `Database`, cache or `fetch` call.

**Output contract.** JSON only. The adapter compares `inspectedEntrypoints` with its inventory and
validates every locator; a missing entrypoint, invalid locator, non-empty `unresolved`, parse or
schema failure, model error, timeout (120 s) or `"unknown"` all yield `UNKNOWN`. `violation` yields
`FAIL` with the findings as locators. Only `compliant` with validated evidence and `confidence ≥ 0.7`
(threshold in `devai.json`) yields `PASS`. On `UNKNOWN` the message says "permissions-pattern UNKNOWN
(reason): <hint>", with the hint from 10 §4; exit 2 already stops the merge.

**When and cost.** Full acceptance and PR (digest check), only when the slice digest changed since the
last `PASS` (key = slice digest + prompt digest + model id). One call, no tools (determinism by the verdict cache, D-058; neither host CLI exposes temperature) (the
closure is complete by construction), output ≤ 2k tokens. Cost is reported as tokens and seconds;
money is `UNKNOWN` without metering. Not a security proof; `review` and `integration` remain the
behavioural checks.

## 5. Protected paths and labelling (D-019)

**Identity.** One agent git identity per repository, configured by `devai init` in each worktree:
`user.name = <product>-agent`, `user.email = agent@<product>.local`, with trailers
`Co-Authored-By: <model name> <vendor noreply>` (both harnesses already add one) and
`Packet: PKT-<PRODUCT>-nnn` (D-050). The pilot commits as themself. No check reads the identity to refuse anything;
`git log --author` separates agent and pilot work for the dashboard. The worker family for `review`
is derived from the trailers, never from a packet field.

**Protected classes** (template default in `devai.json`, per repo):

| Class | Globs | Label |
|---|---|---|
| spec | `specs/**`, `packets/**` | `protected:spec` |
| product | `product/**` | `protected:product` |
| decisions | `decisions.md`, `law/**` | `protected:decisions` |
| standards | `tools/**`, `eslint.config.*`, `tsconfig*.json`, `devai.json`, `.stynxrc.json`, `AGENTS.md`, `CLAUDE.md`, `.agents/**`, `.claude/skills/**` | `protected:standards` |
| infra | `infra/**`, `database/ddl/**`, `database/migrations/**`, `compose.yaml` | `protected:infra` |
| ci | `.github/**`, `scripts/**` | `protected:ci` |
| acceptance | `domain/*/api/test/acceptance/**`, `test/**` | `protected:acceptance` |

**Hook (pre-push).** Computes `git diff --name-only --no-renames <fetched base>..HEAD` ∩ globs, so
**old and new paths** are both classified and a rename out of a class cannot evade it (F-4 conceded).
Prints one line per class touched: `protected:infra — database/ddl/21-est-rls.sql (packet declares:
yes)`. It never exits non-zero for this reason.

**Action (PR).** Recomputes from the diff, applies the labels, reconciles only its own, and adds
`protected:unplanned` when the packet's `protected:` field **as of the packet's introducing commit**
does not list the class; a `protected` widened inside the branch leaves the class undeclared for
this PR, and the pilot pre-declares a class on `main` or in a successor packet (D-078).
`protected:unplanned` makes `review` **mandatory** for that PR (it enters `must-run` even during the
D-028 shadow period) and is the one case where the pilot's attention is explicitly requested; still
no refusal. A labelling API failure is its own visible line, never an admission requirement.

**What the pilot sees.** Labels in the PR list; a five-line block in the PR body: packet id, spec id
and digest, classes touched with file counts, declared/undeclared, reviewer status. That is the
dashboard.

## 6. Docker-or-bare (D-011, D-034, D-039)

**Where it lives.** `devai.json` at the repository root, checked in, protected class `standards`,
validated against the shipped `$schema`; no executable configuration (D-034):

```json
{
  "$schema": "https://devai.nyx/schema/devai.json/3",
  "runtime": { "mode": "bare",
               "services": { "postgres": { "bare": "env:DATABASE_URL", "docker": "compose:postgres" } } },
  "locales": ["en-US"], "lgpd": false, "productPrefix": "boat",
  "protected": { "spec": ["specs/**", "packets/**"], "product": ["product/**"],
                 "decisions": ["decisions.md", "law/**"],
                 "standards": ["tools/**", "eslint.config.*", "tsconfig*.json", "devai.json", ".stynxrc.json",
                               "AGENTS.md", "CLAUDE.md", ".agents/**", ".claude/skills/**"],
                 "infra": ["infra/**", "database/ddl/**", "database/migrations/**", "compose.yaml"],
                 "ci": [".github/**", "scripts/**"], "acceptance": ["domain/*/api/test/acceptance/**", "test/**"] },
  "review": { "mustRun": false, "reviewers": { "claude": "codex exec", "gpt": "claude -p" } },
  "agentic": { "permissionsPattern": { "minConfidence": 0.7, "maxInputTokens": 60000 } },
  "check": { "editLoopCeilingMs": 90000 }
}
```

`"mode"` is `"bare"` or `"docker"`; `DEVAI_RUNTIME=bare|docker` is the single per-invocation
override; any other value fails the command. `"locales"` is where pt-BR is opted in and `"lgpd"` where
S-15 is opted in (D-014). `"protected"` lists all seven classes of §5; `"check"` holds the D-047
ceiling (08 A.8 is the full definition). `"productPrefix"` is per app (D-032): `boat`, `pec`, `teat`, `rait`; shared
code uses `detran`.

**How checks read it.** One function, `resolveRuntime(): { mode, provide(service) }`, resolved once
per command. A node with `needs: ['postgres']` calls `provide('postgres')`; bare → `DATABASE_URL`,
and on failure `UNKNOWN: postgres unreachable (bare) — start PostgreSQL for the declared runtime`;
docker → `docker compose up -d postgres` from the template's `compose.yaml`. **A missing prerequisite
is `UNKNOWN` with the start command, never an implicit fallback to the other mode. No test may
unconditionally invoke testcontainers** [fact: STYNX's `packages/testing/src/create-test-app.ts` does
today]; the template's test support reads the resolved runtime. The mode is part of every cache key
except DB results keyed by schema digest (§2), which are mode-independent by construction.

**CI cadence (D-039).** A PR touching `devai.json`, `compose.yaml`, `scripts/ci-local/**`, `tools/**`
or the generator runs the `needs: postgres` nodes in both modes; other PRs run the declared mode; a
weekly full run in both modes is the backstop; every generator release runs both (§7).

**What the template emits.** `devai.json`, `compose.yaml` (postgres 16), `scripts/ci-local/run.sh`
descended from STYNX's [fact: `stynx:scripts/ci-local/run.sh` requires Docker today, `:72`], and one
line in `AGENTS.md`: "Checks run bare by default; `DEVAI_RUNTIME=docker devai check` runs them in
Docker. Keep both green." That line is the whole contract agents read.

## 7. Scaffolder / generator contract (D-033)

**Inputs.** `devai new module --spec specs/<area>-<capability>/SPEC-<ID>.md [--web] [--out …]`. The
generator reads the spec's machine block (schema fixed in the second round of 06: module name,
namespace, entities with fields/types/constraints/PII, routes with their five contract fields) plus
`locales`, `lgpd` and `productPrefix` from `devai.json`. No separate blueprint JSON: the spec is the
blueprint, and 06's zod definition (D-056) validates that block, carrying STYNX's `validateBlueprint` constraints (`generate-module.ts:108`) as refinements. Missing
business behaviour is not filled with plausible CRUD defaults; it stays a red acceptance test.

**Outputs.** Exactly 04-layout §2, including `api/test/acceptance/.gitkeep` and `web/**` with `--web`.
Emitted code uses `defineQuery` (§3), `parseDto` with zod DTOs, `@RequireRoles(roles, 'all')` (06 maps `roles` to it; S-28 allows either role decorator, the generator and `route-contract` must agree),
`@Idempotent/@NoIdempotent`, `@ErrorContract`, `@UseCase`, `@Slo` on every write route,
`ENABLE`+`FORCE ROW LEVEL SECURITY` with `app.tenant_id` policies in the same file (LINT001, S-17),
`-- @pii` annotations when `lgpd: true`, i18n keys in every configured locale, UUIDv7 request-id
handling wired by the template (S-70), pino with redaction and `prom-client` (S-71), standalone
OnPush components with `input()/output()` signals and the `<prefix>-` selector (D-032).

**`generation-manifest.json`:**

```json
{ "generator": "@devai-nyx/cli", "generatorVersion": "3.0.0",
  "specId": "SPEC-BOAT-CRASH-0001", "specSha256": "…", "machineBlockSha256": "…",
  "options": { "web": true, "locales": ["en-US", "pt-BR"], "lgpd": true, "productPrefix": "boat" },
  "files": [ { "path": "api/src/index.ts", "sha256": "…", "mode": "generated" },
             { "path": "api/src/crash-record.service.ts", "sha256": "…", "mode": "seed" } ] }
```

No timestamp: identical inputs give identical bytes (STYNX INV-CLI-002 [fact:
`stynx:law/invariants/INV-CLI-002.json`]). **The manifest is writable only by `generate` packets**,
and by a `standards` upgrade packet's same-id `--regenerate` (D-074); `packet-scope` fails any other
packet that changes it (C-9 conceded).

**Two file modes.** `generated` files (`index.ts`, `module.ts`, `dto/*`, `routes.ts`, `README.md`, `tsconfig.json`, the catalogs `<slug>.i18n.<locale>.ts`,
the module's initial `db/*.sql`) carry a header **in the language's comment syntax**: `// @generated
from SPEC-… do not edit` in TypeScript, `-- @generated from SPEC-…` in SQL [fact: STYNX already
renders `header` and `sqlHeader` separately, `generate-module.ts:431-432`]. They are wholly owned by
deterministic regeneration and **byte-verified by `generated` against the pinned generator version
and the recorded inputs**, not against the manifest's own hash. A hand edit fails with "regenerate
(`devai new module --regenerate`) or move the logic to a seed file". `seed` files (`package.json`, `acceptance/.gitkeep`, `service.ts`,
`repository.ts`, `controller.ts`, components, unit specs) are emitted once and then hand-owned; the
manifest keeps their initial digest so `--regenerate` reports "seed unchanged, safe to overwrite"
versus "seed edited, left alone". No three-way merge assistant in v3.0.

**Applied migrations are immutable inputs.** Once a module's `db/*.sql` is present at the merge
base, regeneration never rewrites it; a schema change is a new migration in `db/`, and `sql-lint`
LINT013 fails any byte change to a base-present SQL file (F-7 conceded). `--regenerate` therefore
rewrites generated non-SQL files only, and a base-present SQL entry leaves `generated`'s replay (D-043); drift between spec routes and hand-edited controllers is caught
by `route-contract`, not by the generator.

**Self-test rule (03b §3, S-46).** The generator's test suite generates the fixture spec into a
temporary workspace across `{web} × {lgpd} × {pt-BR}` (eight configurations) **in both runtimes**
(sixteen runs, browsers supplied explicitly) and runs `devai check --full` there; any `FAIL` or
`UNKNOWN` fails the generator's PR. The suite runs in the DEVAI repository's own CI (`ci.yml`, 12 §5); it is not a second Action. It also runs a **negative-fixture matrix**: the fixture with
validation removed, with RLS removed, with each contract decorator removed, and with the acceptance
tests removed; each must produce the expected `FAIL` from the expected node, which tests checker and
generator together against shared omissions. Invalid-input, edited-seed, schema-upgrade and
clean-install (no STYNX checkout) cases are included. This is the rule STYNX's `demo-bookmark` broke
[fact: 03-standards Part B S-51].

## 8. Task acceptance

**Commands.** `devai check` is the edit-loop command (affected subset, §2). `devai check --packet
<p>` adds `packet-scope` and the packet's acceptance tests to the affected subset; its report says
`accepted: false` and lists the deferred nodes. **`devai check --packet <p> --full` is the only
command that accepts a packet**: every applicable node, including `spec-tests`,
`permissions-pattern`, `review` and `accept`, over the diff between the packet's `base` commit and
the candidate. `--only <node>` is feedback and can never accept. There is no `review: off`, no
per-packet node allowlist, and no pilot waiver of any node.

**Exit contract** (one, three codes): `0` no gating `FAIL` or `UNKNOWN` — `accepted: true` only on `--packet --full` (feedback and maintenance commands exit 0 on success with `accepted: false`, D-058); `1` at
least one `FAIL`; `2` at least one `UNKNOWN` and no `FAIL`, **or** the command could not run (bad
packet, invalid `devai.json`, missing tooling) with a `reason` code in the report. `FAIL` and
`UNKNOWN` together exit 1 with both preserved. CI treats 1 and 2 as red.

**Statuses.** `PASS` (observed, no findings), `FAIL` (observed, findings), `UNKNOWN` (could not
observe: zero observations, tool crash, service unreachable, model unavailable, prerequisite
`UNKNOWN`), `SKIPPED` (not applicable to this candidate, decided by `inventory` with evidence, e.g.
LGPD disabled at bootstrap; never by the node's runtime). **Taxonomy (F-3 conceded):** with a complete
inventory and a known expected count, a shortfall is a demonstrated violation: `spec-tests` with
`expected 4, observed 2` is `FAIL: uncovered R-3, R-5`; `UNKNOWN` is reserved for "could not
observe". **The runner, not the node author, enforces `UNKNOWN ≠ PASS`:** success with `observed = 0`
is rewritten to `UNKNOWN: no-observations` and not cached. [fact] v2's sensor returned PASS on zero
files (five STYNX readings `files_checked: 0 … status: "pass"`, `assessment/claude-fable-p2.md` §3.1).

**`--expect-red` (test packets only, D-026 provisional, D-051: `code`/`fix` acceptance is all-green; partial delivery is a smaller spec or a successor packet, never red cases accepted).** Applied by the runner to `spec-tests` only, and
narrowly: collection, imports, application start-up and DB setup must succeed first; then each
**named unimplemented observation** (the `R-n:` cases the packet lists as not yet implemented) must
reach its behavioural assertion and fail there; every other collected test, including rail-provided
behaviour the generator already satisfies (RLS isolation, permission guards), stays green. A setup
failure, a missing named case, or a red case that never reached its assertion is `UNKNOWN` or a
diagnosed defect, never an expected-red `PASS`. This records sensor liveness as a mechanical fact
(03b §3 gap §12.7); it is not mutation testing (D-004).

**Report the agent reads** (`--format text`, default, ≤ 40 lines, failing nodes first):

```
devai check --packet packets/CMP-BOAT-0101/PKT-BOAT-103.md --full   runtime=bare   base=1f3c…  head=9e41…
FAIL  route-contract   2 findings   (expected 6 routes, observed 6)
      domain/crash-record/api/src/crash-record.controller.ts:48  POST /crash-records/:id/start lacks @ErrorContract   [S-28]
      domain/crash-record/api/src/crash-record.controller.ts:48  @Slo missing (spec: write-standard)   [S-25]
FAIL  sql-typed        1 finding
      domain/crash-record/api/src/crash-record.repository.ts:61  param $5 z.string().max(1024) exceeds est.crash_vehicle.apparent_damage varchar(512)   [S-27]
FAIL  spec-tests       expected 4 acceptance requirements, observed 2: uncovered R-3, R-5   [S-65]
UNKNOWN permissions-pattern   slice too large (71k tokens > 60k): packages/auth/src/stynx-auth.guard.ts, …   [S-12]
PASS  19 nodes (14 cached, 41 s)
review  not run: deterministic nodes failed
exit 1
```

`--format json` writes `report.json` (`{ packetId, specId, specSha256, base, head, candidateDigest,
runtime, accepted, exitCode, reason?, nodes: [{ id, status, expected, observed, evaluated, findings:
[{ locator, message, hint, standard }], durationMs, cached }] }`) to `.devai/cache/reports/` for the
reviewer and the Action. The candidate digest covers tracked and untracked content, modes and
deletions plus the base commit, hashed before and after the run; a change during the run invalidates
the result.

**Summary the pilot reads** (`--summary`, ≤ 10 lines, becomes the PR body):

```
PKT-BOAT-103  Implement crash record start/classify routes   spec SPEC-BOAT-CRASH-0001 @ 9ab2… (frozen)
acceptance: PASS (28 nodes: 26 pass, 2 skipped: e2e[no test/e2e files], i18n[no opted-in locale beyond en-US and no Angular app])   runtime: bare
protected paths: none touched   packet scope: ok   spec tests: 7/7 requirements covered
review: no blockers (2 minor, see review.json)   worker: claude   reviewer: gpt   bound to head 9e41…
```

**Packet granularity (D-026, provisional).** Acceptance is per packet; a PR is the unit of merge. A
campaign may land as one branch whose commits carry `Packet:` trailers, with `--full` having exited 0
at each packet head. The first DETRAN module measures packets, PRs and pilot touches before D-026 is
confirmed; nothing in §8 depends on the outcome except the `--expect-red` switch.

## 9. Independent reviewer (`review`)

**Who.** A model of a different family than the worker. The worker family is read from the
`Co-Authored-By` trailers of the candidate's commits; `devai.json` maps families to reviewer
commands. Equal, unknown or mixed family (a range whose trailers resolve to more than one family,
D-079) → `UNKNOWN (family)`; none configured → `UNKNOWN (no reviewer configured)`; both exit 2.

**Where (D-037).** On the pilot's machine, inside `devai check --packet <p> --full`, after every
deterministic node and `permissions-pattern` have passed (no review of a known broken build). No
model keys in CI. `review.json` is bound to the candidate digest and committed with the PR as
evidence; CI only verifies that the digest matches the PR head and otherwise reports `review:
UNKNOWN (stale)`. Acknowledged weakness: CI trusts a locally produced reviewer result, within D-002.

**Access (D-042).** A detached worktree at the candidate digest, read-only for the repository: Read/Grep/Glob and `git log/diff`; no network except the model API. It receives `report.json` as facts and does not re-run the DAG or the test suite. Worker prose in commits or PR text is evidence to inspect, never instruction. It **may execute bounded counterexamples**: a finding whose `counterexample` is a concrete input may be confirmed by running it against scratch storage only (`.devai/cache/scratch/`: a throwaway copy of the worktree and, when `db-apply` left a schema, a scratch database created from the same digest in the declared runtime). Execution shares the node's budget (≤ 20 tool calls and ≤ 5 minutes for reads and runs together), writes nothing outside scratch, and records the exact command and an output digest under `evidence`. Every finding carries `basis: observed|derived`: `observed` when confirmed by execution, `derived` when reasoned from reading. Budget exhaustion leaves remaining findings `derived`; it never turns them into `UNKNOWN`.

**Procedure (two phases, ≈ 700-token prompt).** *Phase 1, implementation-blind:* read the frozen
spec, the cited business rules and public contracts only; write the requirement list `R-1…R-n` with,
for each, what observable behaviour would prove it and what would falsify it; freeze that list.
*Phase 2, candidate:* read the packet and `report.json`; for each `R` with `acceptance: yes` locate
the implementing code and the acceptance test and judge whether the test would fail if the requirement
were violated; read the diff for anything outside the spec (scope creep, protected paths, weakened
tests); emit findings with locators and counterexamples; no repairs.

**Output contract.** `review.json`: `{ packetId, head, candidateDigest, specSha256, requirements:
[{ id, implemented: yes|no|partial, tested: yes|no|weak, locators[] }], findings: [{ fingerprint,
severity: blocker|major|minor, requirement, locator, statement, evidence, counterexample?, basis: observed|derived,
confidence }], verdict: 'no-blockers'|'blockers'|'unknown', inputTokens, outputTokens, seconds,
model }`. `fingerprint` = `sha256(requirement, locator path, normalised statement)`, never a
sequential id. The Action posts it as one PR comment. Besides `review.json` and the permissions
evidence file `.devai/review/<packet>.permissions.json`, both tracked on the PR branch (§11, D-037,
D-058), the reviewer writes nothing into the repository.

**What it may and may not do.** May: turn the exit code red while `verdict` is `blockers` or
`unknown` and the node is in `must-run`. May not: edit the candidate, re-run the DAG or the suite, approve, merge, or decide that a
spec is wrong (that is a finding for the pilot). **Its PASS is never authorization**: merging is the
pilot's act or branch protection's.

**Dispositions (D-035).** A small block in the packet, `## Review dispositions`, for `review`
findings only: `RV <fingerprint> · R-3 · <locator> · not-a-defect|accepted-risk · <reason>`. A fixed
finding needs no line: the next `--full` no longer reports it (D-074). `not-a-defect` is a claim: the next `--full` re-observes the candidate and the finding
must be absent or contradicted by evidence against the unchanged contract. `accepted-risk` silences a
`review` finding for that requirement and locator only and **never overrides a deterministic node**.
A business decision that changes what acceptance means is a successor spec and a new packet. The
disposition edit labels the PR `protected:spec`.

**Cadence (D-028).** The node runs from day 0. During the first campaign `review.mustRun` is
`false`: `review.json` is produced and false positives and misses are tallied against dispositions,
but the result does not set the exit code, except on `protected:unplanned` PRs (§5). After that
campaign the flag flips to `true` and stays. It is a repo-level, labelled standards change, never a
per-packet option.

**Bounds.** Input ≤ 150k tokens (spec + packet + report + diff + opened files), output ≤ 4k, 20 tool calls (reads and
counterexample runs together, D-042), 5 minutes including phase 1. Two distinct exhaustion events: input/time exhaustion before every requirement was examined → `UNKNOWN` listing the unexamined requirements; exhaustion of the counterexample-execution budget only → findings stay `derived` (D-042), never `UNKNOWN`. Cost
is reported as tokens and seconds; money is `UNKNOWN` without metering. Cache key: candidate digest +
specSha256 + packet digest (dispositions included) + prompt digest + model id.

## 10. Agent-facing prose budget

Gloaguen et al.: context files do not raise success on average, raise cost > 20 %, and widen
exploration; minimal human-written ones help slightly. Consequence: every file below is an executable
entry point or a repo-specific pitfall, none a reading obligation about governance.

| When | File | Tokens (est.) | Why it earns its place |
|---|---|---|---|
| Session start (auto-loaded) | `AGENTS.md` (`CLAUDE.md` → `@AGENTS.md`), ≤ 60 lines | ≤ 600 | Commands (`devai check`, `… --packet <p> --full`, `pnpm test`), runtime line (§6), protected classes in one line, "a red acceptance test you did not write is a result, not an obstacle", layout one-liner |
| Session start (descriptions only) | `.agents/skills/{devai-task,devai-spec,devai-test,devai-review}/SKILL.md` | ≈ 4 × 50 = 200 | Loaded on invocation only (both harnesses) |
| Per task | the packet (05) | 400–800 | The task itself |
| Per task | the spec (06), excluded from the budget by the brief | 1.5k–4k | The setpoint |
| Per task (on invocation) | `devai-task/SKILL.md` | ≈ 400 | How to read the report, when to run `--full`, how to widen scope by editing the packet |
| Per task | `domain/<m>/README.md` (generated, ≤ 30 lines) | ≤ 200 | Module purpose, spec id, generated vs seed |
| Per iteration | `devai check` text report | 150–800 | The error signal; replaces every "rule" about standards |
| Spec task only | `devai-spec/SKILL.md` | ≈ 440 (10 §5) | Where business specs live, `quote` rule, rail requirements separate (D-058), approval annotation |
| Test task only | `devai-test/SKILL.md` | ≈ 400 | Derive from spec only; sparse-worktree commands (D-035); naming; `@stynx-nyx/testing` helpers |

Per-task mandatory reading excluding spec and packet: ≈ 600 + 400 + 200 + first report ≈ 1.2–1.8k
tokens, under the 3k target. Deliberately absent: constitution, ADR index, campaign file, decisions log
(read only when the packet cites an entry), standards document (each finding carries the standard id
and a one-line hint), this architecture. Hook messages carry the rule when it matters, e.g.
`S-33 no-explicit-any: type the value or parse it with zod`. Prefer a tool to a rule; prefer a hook
message to a document. Measure with the selected harness before trusting the estimates.

## 11. State and memory

| State | Where | Writer | Pruned by |
|---|---|---|---|
| Check cache | `.devai/cache/{nodes,results,reports}/` (gitignored; the **single** runtime store) | `devai check` | `devai check --prune` keeps 200 per node; `rm -rf .devai/cache` is always safe |
| Agentic verdict cache | `.devai/cache/agentic/<node>/<digest>.json` | `permissions-pattern`, `review` | same |
| Sensor verdict evidence | `.devai/review/<packet-id>.permissions.json`, tracked in the PR branch, bound to the slice digest (D-058; CI has no model and the cache is gitignored, so without it CI reports `permissions-pattern: UNKNOWN (stale)`) | `permissions-pattern` on the pilot's machine | superseded by the next candidate |
| Reviewer worktree, scratch DB descriptors | `.devai/cache/scratch/` | `devai check` | command cleanup; interruption cleanup is the harness's |
| Packets | `packets/<CMP>/PKT-*.md`, `packets/<CMP>/campaign.md` (D-027, D-050) | pilot / spec agent / generator | git; a packet is "done" when a merged commit on main carries `Packet: PKT-<PRODUCT>-nnn`; `devai packets status` prints the derivation, no status field |
| Technical specs | `specs/<area>-<capability>/SPEC-*.md` (D-027) | spec agent, approved by pilot annotation | git; written statuses are `draft`, `approved`, `superseded-by: <SpecId>`; `frozen` is derived (a packet pins `base` + sha256); the successor carries `supersedes: {id, path, sha256}` and the predecessor's status line is the one permitted post-pin edit (D-053) |
| Decisions | `decisions.md` at root (D-031) | pilot (agents may draft; the pilot's commit is the approval) | never deleted; entries carry `superseded by` |
| Generation record | `domain/<m>/generation-manifest.json` | `generate` packets only | regenerated |
| Review result | `.devai/review/<packet-id>.json`, tracked in the PR branch, bound to the candidate digest (D-037); excluded from the candidate digest and from `packet-scope` so writing it cannot invalidate itself | `review` on the pilot's machine | superseded by the next candidate |
| Labels | PR | Action | GitHub |

Native memory (Claude auto-memory, Codex Memories) is the agent's own: v3 neither reads nor writes it,
forbids nothing, and puts nothing binding there. Anything that must bind goes to the packet, the spec
or `decisions.md`. The only cross-session memory v3 offers is `devai check --summary`, regenerated on
demand. A fresh session reconstructs work from git and the packet and reruns checks; losing the cache
loses speed only.

**State that could not be avoided, flagged (D-002, D-018):**

1. **Review dispositions live in the packet** (git), so a PR that disposes of a finding edits a
   protected path and gets `protected:spec`. Acceptable; D-035 bounds it to `review` findings.
2. **`review.json` travels in the PR branch.** Evidence CI verifies by digest, not an attestation
   (D-002, D-037). A stale file is `UNKNOWN`, never something to repair by hand.
3. **Agentic verdict caches contain judgments, not derivations.** A cached `compliant` is reused while
   the slice is unchanged; the prompt digest in the key invalidates it on prompt change.
4. **Campaign ordering is derived from git** (`Packet:` trailers on main). Two packets worked in
   parallel against one module are not prevented by v3; the harness or the pilot serialises. That is
   D-018 as intended, stated so it is not mistaken for an omission.

## 12. Standards (O-003 closed) and the D-015 dispositions

Final merged table for `03-standards.md` Part A. Numbers are allocated once from the free ranges;
existing standards keep theirs; the mapping from both reviews' tables is in
`agents/consolidate-1/NOTES.md`. Rationale is in the section each row cites.

| # | Standard | Tag | Enforced by |
|---|---|---|---|
| S-17 | One GUC namespace for request context (`app.tenant_id`, `app.actor_id`, `app.role`, `app.request_id`, `app.session_id`); RLS policies reference only it (03b §3 gap §12.3) | both | `sql-lint` LINT011, `db-apply` |
| S-18 | Three DB roles per product (`<product>_owner` BYPASSRLS for migrations, `_app`, `_reader`); app code never connects as owner; isolation tests never run as owner [fact: `expectRLSIsolated` throws only on a leak, `stynx:packages/testing/src/matchers.ts:38-44`, so it is vacuous under BYPASSRLS] | rail + check | `db-apply`, `integration`, generator |
| S-19 | STYNX tooling is consumed as published versioned ESM packages; v3 never vendors or re-expresses it; missing tooling is `UNKNOWN` (D-029) | rail | preflight |
| S-26 | Every external input (body, query, params, headers used by logic) is validated at the boundary with zod `parseDto` or a typed pipe; interface-typed handlers are a finding (03b §3 gap §12.1) | check | `route-contract` |
| S-27 | Every `defineQuery` declares argument limits ≤ the bound column's constraints, verified against the applied schema; rows are validated at runtime always (D-010) | both | `sql-typed`, `run` |
| S-28 | S-25 contract fields are decorators in code (`@Idempotent\|@NoIdempotent`, `@Permission`/`@RequireRoles`, `@ErrorContract`, `@UseCase`, `@Slo`); sidecar JSON forms are not declarations (D-016) | both | `route-contract` |
| S-29 | SLO **measurement** runs in the release lane only (D-038); packet acceptance verifies the `@Slo` declaration (D-005) | check | `route-contract`; release lane, outside the DAG |
| S-37 | Package layer direction is deny-by-default with an explicit allow list (03b §3 gap §12.5) | check | `lint` overlay |
| S-38 | "Named exports only" (S-36) applies to `src/**` and `test/**`; tool-mandated config entry points (`eslint.config.*`, `vitest.config.*`, `playwright.config.*`) follow the tool's contract; shared packages expose named factories only [fact: `stynx:tools/eslint-config/nest.mjs:2` default-exports because ESLint flat config requires it at the entry point] | check | `lint` |
| S-45 | Files with a `@generated` header are committed and byte-verified against the pinned generator and recorded inputs; a hand edit fails; seeds are excluded (D-015 held item, narrowed; INV-CLI-002) | check | `generated` |
| S-46 | A generator release passes the full option matrix in both runtimes and the negative-fixture matrix (removed validation / RLS / decorators / tests each fail the expected node) (03b §3) | both | generator suite invoking the full DAG |
| S-61 | Coverage = acceptance requirements covered (`expected` vs `observed` in `spec-tests`); no universal percentage; per-package thresholds only by declaration if a case appears (D-036) | check | `spec-tests` |
| S-62 | Test tiers are 04-layout §4's suffixes (unit, acceptance, integration, db, e2e); no wiring tier; every enabled tier glob matches ≥ 1 file (D-015 held item) | check | `layout`, `inventory` |
| S-63 | Spec-derived acceptance tests live in `domain/<m>/api/test/acceptance/*.acceptance.spec.ts`, derived from the frozen spec before the implementation exists or in a sparse worktree without it (D-035), protected; a change needs `// @acceptance-change: approved-by=` (D-022, D-016) | both | `test-integrity`, `spec-tests`, `protected-paths` |
| S-64 | No literal verdicts in tests or gates; no `.skip/.only/.todo` without an issue reference; required tests cannot disappear, be focused away or weakened without a verified contract-consistent correction; an annotation explains, it does not exempt (03b §3 gap §12.7) | check | `test-integrity`, `review` |
| S-65 | Every check reports `expected`/`observed`/`evaluated`; zero observations is `UNKNOWN`; `observed < expected` against a complete inventory is `FAIL`; never `PASS` on empty (v2's zero-file PASS made a rule) | harness | runner, `accept` |
| S-66 | Independent review by a model of a different family than the worker is a DAG node, executed pre-push on the pilot's machine and digest-verified in CI; equal, unknown or unconfigured family is `UNKNOWN` (D-003, D-028, D-037) | check | `review` |
| S-67 | Expected-red applies only to named unimplemented observations after collection, imports, start-up and DB setup succeed; each must reach its behavioural assertion; rail-provided behaviour stays green (D-004: liveness, not mutation testing) | check | `spec-tests --expect-red` |
| S-71 | Logging is pino with redaction; metrics are `prom-client`; no standard *against* OpenTelemetry (D-015 held item) | rail | template |

Amendments to existing rows, no new number (D-043, D-045): **S-24** gains LINT010–013 (§2). **S-31** is enforced by
`inventory`, `lint` and `typecheck` (§2). **S-70** by `route-contract` and `integration`. **S-40**
gains the changeset-vs-baseline check in `openapi`. **L-01** is not a standard: root `specs/`,
`packets/` and `decisions.md` are D-027 and D-031, which already amend 04-layout §1.

D-015 dispositions, as decided: byte-verification adopted narrowly (S-45); 100 % coverage rejected in
favour of S-61 (D-036); taxonomy is the layout's suffixes with no wiring tier (S-62); pino +
`prom-client` as the template default with no OpenTelemetry ban (S-71).

## 13. What v3 does not do

- Run, schedule, dispatch, lock or journal tasks; know that a task is running (D-018).
- Keep an evidence chain, signed receipts or attestations beyond CI verifying `report.json` and
  `review.json` by digest (D-002, D-037).
- Require a human to read diffs or ratify them as observation (D-003).
- Refuse commits by identity or role, or admit paths by signature (D-019).
- Ask the pilot to waive failed checks, rebind artifacts, approve a bypass or repair a signature
  (D-003, D-006).
- Run mutation testing in the cycle (D-004); enforce S-12 at runtime (D-009); measure SLOs inside
  packet acceptance (D-038).
- Re-express or vendor STYNX lint, tsconfig or the migration linter (D-029).
- Treat STYNX conventions as authority over company standards (D-007, D-012, D-013, D-025).
- Hold governance state: scorecard, campaign status, round lifecycle (D-005).
- Author or migrate business specs; execute a mid-task setpoint change (D-008, D-016).
- Ship a three-way merge assistant for seeds or rewrite applied migrations (D-033).
- Manage subagents, worktrees, sandboxes, memory or MCP (harness features; pointers only).
- Turn reviewer opinion or exit zero into deployment or publication authority (D-003, D-018).
- Tolerate CommonJS output or `any` (D-012, D-013).

## 14. Open questions for the author

Closed 2026-10-18 by D-041–D-049 except where marked.

1. **Edit-loop service level (D-047, provisional).** The affected subset of §2 (latency classes A/B)
   is fixed now. A **provisional ceiling of 90 s warm** shapes the class partition: a node that
   cannot meet it on the reference machine moves to class C. The binding number is the measured p95 on
   the first STYNX and DETRAN modules in both runtimes (adjudication 7: a service level, not a latency
   target), then written into `devai.json` as the threshold `accept` reports against. Provisional
   until measured.
2. **Example fixture for 05/06 (D-048).** The round-1 example attributed a 72-hour occurrence cutoff
   to RN-BOAT-119. [fact] `detran:docs/framework/product/domains/est/boat/rules/RN-BOAT-119.md` is
   about the instantaneous speed/time recorder (tachograph): in a crash **with victims**, only the
   official forensic expert may remove the disc or storage unit (CTB art. 279); the rule has no time
   cutoff. Decision: the foundation docs and the `devai init` template use **clearly fictional ids
   under a fictional product** (`RN-DEMO-nnn`, `UC-DEMO-nnn`, a `product/` fixture shipped with
   DEVAI); no real DETRAN rule is quoted in DEVAI's own material. `spec-lint`'s `source:` resolution
   rule makes a repeat mechanically impossible against the fixture and against real repositories
   alike.
3. **Mutation testing's home** stays (b) periodic hardening outside the cycle or (c) not used
   (D-004); nothing in v3 depends on it, so it need not close before v3.0. *Still open; not blocking.*
