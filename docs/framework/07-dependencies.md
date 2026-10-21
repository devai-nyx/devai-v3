<!-- Consolidated 2026-10-18 from agents/consolidate-3 (Astra base per both cross-check-3 reviews; Fable corrections; D-056, D-057). Versions cite STYNX @ 63e5f788 and v2 @ 4289ff51 manifests. -->
# 07 — Dependencies and runtime

Final consolidation 3 · GPT-6 Astra · 2026-10-18 · D-001–D-057. Base: Astra round 3; both cross-reviews applied under the later rulings. [opinion] This selects implementations for existing mechanisms, not new components or release authorization.

Citations: `F:` = this workspace's `foundation/`; `S:` = `/Volumes/Development/projects/stech/stynx/`; `V:` = `/Volumes/Development/projects/stech/devai/`; `L:` = `S:pnpm-lock.yaml`; `P:` = `S:node_modules/.pnpm/`. Sources were re-read today. `[fact]` means observed source, `[inference]` a consequence, `[opinion]` an implementation prescription. Manifest ranges, lock resolutions and publication readiness are distinct.

## 1. Runtime and publication

[opinion] Set `engines.node: ">=24 <25"`, `engines.pnpm: ">=9 <10"` and `packageManager: "pnpm@9.15.0"`; Corepack selects pnpm. These are the runtime pins; exact host patches belong in 12, with no runtime pin file (D-057, `F:decisions.md:431–432`). [fact] STYNX declares those values (`S:package.json:7–10`). v2 has `.node-version` containing `24`, no `.nvmrc`, and unbounded `>=24` engines (`V:.node-version:1`; `V:package.json:11`; `NOTES.md:51`).

[opinion] Compile and run emitted JS in development too: `tsc -b`, then `node dist/main.js`. Authored Node packages and output use `type: module`, NodeNext for `module`/`moduleResolution`, and relative `.js` specifiers. Native imports of third-party CJS are allowed; authored `require`, `createRequire`, `module.exports`, `__dirname` and `__filename` are lint violations (`F:decisions.md:414–417,426–427`).

[opinion] Extend published `@stynx-nyx/tsconfig/node24.json → base.json`; preserve ES2022, strictness, declarations and source maps. Angular extends `angular18.json → base.json`, retaining ES2022/Bundler; effective-option checks are profile-specific (`S:tools/tsconfig/base.json:4–16`; `S:tools/tsconfig/node24.json:3–8`; `S:tools/tsconfig/angular18.json:3–10`). Checkout-relative aliases must be removed upstream before publication (`S:tools/tsconfig/base.json:17–58`).

[opinion] Release requires clean installation without a STYNX checkout, compliant ESM packages, the D-025 claims-only auth migration, D-030 typed executor and runtime-selectable test support. D-029's four tooling deliverables remain prerequisites; missing deliverables produce `UNKNOWN: tooling missing` with an install remedy, never vendored substitutes (`F:decisions.md:150–157,181–193,433–437`; `F:02-architecture.md:26–32,301–312,365–373`). [fact] STYNX data exports include both `require` and `default`; that does not establish ESM output (`S:packages/data/package.json:12–17`). [opinion] Not adding: tsx, ts-node, bundlers, dual authored output or another runtime manager.

## 2. Dependency table

[opinion] **R** = DEVAI runtime import; **B** = invoked binary; **C** = consumer dependency; **W** = thin result adapter. Exact third-party resolutions below are selected for CLI/template locks; TypeScript's manifest range is explicitly retained. STYNX successor versions await 12. Each of the four D-029 published deliverables has its own row and status **pending publication**.

The E1–E5 classification makes the draft's module-format evidence explicit: **E1** native ESM/built-in; **E2** ESM entry with dual exports or a CJS-backed facade; **E3** CJS imported natively; **E4** process/service boundary, no module-format claim; **E5** JSON/data. A pending STYNX migration is not a third-party exception. Evidence is in `NOTES.md:67–71`.

| dependency | version pinned where | v3 mechanism that needs it | STYNX already uses? | ESM? | rejected alternative | drop consequence |
|---|---|---|---|---|---|---|
| Node + built-ins (R) | Node >=24 <25, engines; exact patch in 12 (`S:package.json:9`; `F:decisions.md:431–432`) | CLI, process execution, SHA-256 and text/JSON (`F:02-architecture.md:21,427–440`) | Yes, cited engines | E1 | Bun/Deno; execa/hash libraries duplicate runtime | CLI and tool execution unavailable |
| pnpm through Corepack (B) | [fact] 9.15.0 → packageManager; `S:package.json:7`; Corepack required `F:03-standards.md:23` | `inventory` engines/lock and installed tool resolution (`F:02-architecture.md:62`) | Yes, cited pin | E4 | npm/Yarn add a second lock resolution | Cannot reproduce toolchain |
| TypeScript (R/B) | ~6.0.3 runtime dependency; lock 6.0.3 (`L:168–170`; `F:decisions.md:428–430`) | Library: `route-contract`, `sql-typed` static, `test-integrity`, `permissions-pattern`; binary: `typecheck`, `inventory` via `tsc --showConfig` (same ruling) | Yes (`S:package.json:117`) | E3 library / E4 binary (`NOTES.md:69`) | ts-morph adds abstraction; layout needs paths, not another compiler consumer | AST/type and compiler observations missing |
| @stynx-nyx/tsconfig (C/build) — **pending publication** | Private 0.2.0 today; fixed-group successor in 12 (`S:tools/tsconfig/package.json:2–4`) | `typecheck`, CLI/template compiler chain (`F:02-architecture.md:66`) | Workspace-local predecessor | E5 | Vendored presets drift, D-029 | `UNKNOWN: tooling missing` |
| Commander (R) | 15.0.0 → CLI lock (`L:1157–1159`) | Existing command/option grammar (`F:02-architecture.md:18–22`; `F:05-task-packet.md:57–59`) | Yes (`S:packages/cli/package.json:38`) | E1 (`NOTES.md:67`) | CAC/native grammar replaces adopted parser | Command dispatch unavailable |
| yaml (R) | 2.9.0 → CLI lock (`L:1163–1165`) | Packet front matter, spec machine block (`F:05-task-packet.md:26`; `F:06-spec-format.md:16,164`) | Yes (`S:packages/cli/package.json:40`) | E3 Node entry (`NOTES.md:69`) | js-yaml is a second parser, not missing Core schema; gray-matter adds envelope library | YAML/duplicate-key validation unavailable |
| zod (R/C) | 4.4.3 → CLI/template locks (`L:1258–1260`) | All artifact/model schemas and projections (D-056); `defineQuery`, `run`, `parseDto` (`F:decisions.md:403–411`; `F:02-architecture.md:129–162,329`) | Yes (`S:packages/data/package.json:38`) | E2 (`NOTES.md:68`) | Ajv duplicates schema authority | Artifact and runtime validation unavailable |
| ignore (R) | 7.0.5 → CLI lock (`L:9498`; `F:decisions.md:418–420`) | Scope, protected classes, tiers; forbidden wins (`F:05-task-packet.md:40–41`; D-057) | Transitive in cited lock | E3 (`NOTES.md:69`) | Node globs/minimatch do not supply specified dialect | Path selection violates contract |
| git (B) | [opinion] Host executable, exact host pin in 12; no manifest pin asserted | `inventory`, `packet-scope`, `review` snapshot/blob/history operations (`F:02-architecture.md:62,264–266`; `F:05-task-packet.md:212–215`) | [fact] Git repository metadata, `S:packages/cli/package.json:47–50` | E4 | isomorphic-git duplicates installed git semantics | Cannot establish base/candidate or raw blob pin |
| pg (R; C transitive) | 8.23.1 → CLI lock; consumer via data; @types/pg 8.20.0 → CLI dev lock (`L:1249–1251`; `S:packages/data/package.json:37`) | Scratch DB, PREPARE/OIDs/Describe (`F:02-architecture.md:71,81–83,174–188`) | Yes, same source | E2 facade (`NOTES.md:68`) | postgres.js/ORM adds driver | DB observations unavailable |
| pg-query-emscripten (R) | 5.1.0 → CLI lock (`L:11035`; `S:tools/migration-linter/package.json:23`) | SQL AST bindings in `sql-typed`; transitive parser for `sql-lint` (`F:02-architecture.md:68,185–188`) | Yes, cited linter | E1 (`NOTES.md:67`) | Regex/native addon changes parser or provisioning | SQL bindings unresolved |
| PostgreSQL + psql; Docker Compose (B/W) | PostgreSQL 16 (`F:02-architecture.md:314`); host/image exact pins in 12 | Declared-mode scratch services; psql host preflight; Docker/Compose preflight in docker mode (`F:02-architecture.md:81,301–317`) | psql invoked (`S:scripts/db-verify.mjs:11`); PG16 container (`S:packages/testing/src/create-test-app.ts:32`) | E4 | testcontainers/dockerode adds lifecycle | Relevant DB nodes UNKNOWN |
| Host shell (B) | Interpreter required by emitted `database/apply.sh`; release pin in 12 | `db-apply` host preflight in both modes (`F:02-architecture.md:81`; `F:04-layout.md:90`) | Shell-based CI (`F:02-architecture.md:314–315`) | E4 | Shell framework adds no mechanism | `db-apply` UNKNOWN |
| @stynx-nyx/migration-linter (B/W) — **pending publication** | Private 0.2.0 today; successor in 12 (`S:tools/migration-linter/package.json:2–8`) | `sql-lint` LINT001–013, parser failure observable (`F:02-architecture.md:68`; `S:tools/migration-linter/src/parser.ts:1–14`) | Workspace-local bin | E1 declared (`S:tools/migration-linter/package.json:5`) | SQL-rule clone violates D-029 | `UNKNOWN: tooling missing` |
| Vitest (B/W) | [fact] 4.1.11 → template dev lock, `S:package.json:119,194`, `L:174–176` | `unit`, `spec-tests`, integration/db tiers (`F:02-architecture.md:72,82–83`; `F:04-layout.md:105–122`) | Yes | E4 | Jest adds a runner | No test observations or expected-red evidence |
| SWC + unplugin-swc (C/test) | 1.16.2 + 1.5.9 → template dev lock (`L:117–119,171–173`) | Nest test metadata transform (`S:tools/repo-config/vitest.base.mjs:243–253`; `F:02-architecture.md:82–83`) | Yes, cited config | E3 + E2 (`NOTES.md:69`; `NOTES.md:68`) | Plain stripping loses decorator metadata | Nest-backed test startup unsupported |
| Playwright (B/W) | [fact] @playwright/test 1.60.0 → template dev lock; `S:reference/web/package.json:44`, `L:2457–2459` | `e2e` (`F:02-architecture.md:84`) | Yes | E4 | Another browser runner duplicates e2e | Browser observations unavailable |
| ESLint (B) | 10.10.0 → template dev lock (`L:135–137`) | `lint`, `lint-tests` (`F:02-architecture.md:64–65`) | Yes (`S:package.json:106`) | E4 | Alternate linter drops adopted rules | Standards lint unavailable |
| @stynx-nyx/eslint-config (C) — **pending publication** | Private 0.2.0 today; successor must export `./test` (`S:tools/eslint-config/package.json:2–12`; `F:decisions.md:433–437`) | Published profiles for `lint`, `lint-tests` (`F:02-architecture.md:64–65`) | Workspace-local predecessor | E1 (`S:tools/eslint-config/package.json:5–11`) | Rewritten profiles violate D-029 | `UNKNOWN: tooling missing` |
| Prettier (B) | [fact] 3.9.6 → template dev lock; `S:package.json:115`, `L:162–164`; root options `S:package.json:130–135` | `format` (`F:02-architecture.md:63`) | Yes | E4 | Custom formatter adds policy | Cannot observe formatting compliance |
| knip / depcheck / madge (B, all required) | [fact] 6.35.1 / 1.4.7 / 8.0.0 → template dev lock; `L:132–134,153–161`; scripts `S:package.json:22–25` | `deadcode` S-42 (`F:02-architecture.md:79`) | Yes | E4 | Picking only one drops an adopted S-42 check | Missing dead-code/dependency/cycle observation |
| github-actionlint (B) | [fact] 1.7.12 → template dev lock; `S:package.json:109`; invocation `S:scripts/lint-workflows.mjs:54–58` | `actionlint` (`F:02-architecture.md:75`) | Yes | E4 | YAML parse alone cannot lint workflow semantics | Workflow validation unavailable |
| commitlint CLI + conventional config (B/C) | [fact] 21.2.2 → template dev lock; `S:package.json:93–94`, `L:96–101` | `commitlint` hook S-40 (`F:02-architecture.md:76`) | Yes | E4 | Bespoke commit regex duplicates adopted check | Semantic commit validation missing |
| Changesets (B/W) | [fact] CLI 2.31.0 → dev lock; `L:93–95`; fixed group `S:.changeset/config.json:5–51` | `openapi` breaking-change/major check; package publication (`F:02-architecture.md:80`) | Yes | E4 | semantic-release adds a second release policy | No adopted semver-intent check |
| @stynx-nyx/cli (B/W) — **pending publication** of required entry points | Current manifest 1.6.2, bin `stynx`; compliant successor in 12 (`S:packages/cli/package.json:2–10`) | `verify-api-coverage`, `list-routes`, `verify-openapi-contract`, `verify-public-api-baselines`, `verify-rls-negative`, `verify-stynx-boundary`, machine-readable; serves `route-contract`, `openapi`, `generated`, `db-apply`, `boundary` (`F:02-architecture.md:70,77–81`; `F:decisions.md:433–437`) | Repo scripts (`S:package.json:30–36,40`; `S:scripts/list-routes.mjs:7–13`) | E4; ESM publication required | Vendoring or new tool packages violate delivery ruling | Dependent nodes `UNKNOWN: tooling missing` |
| Angular ESLint plugin/template/parser (C) | 22.0.0 → template dev lock (`S:package.json:89–91`) | `i18n` catalog parity plus `@angular-eslint/template/i18n`; Angular lint (`F:02-architecture.md:64,74`) | Installed, same source; overlay enables rule | E4 via ESLint | i18n extractor not required by this node | Template i18n observations missing |
| Nest common/core/platform + required peers (C) | 11.2.3; reflect-metadata 0.2.2, rxjs 7.8.2 → template lock (`L:229–240,1252–1257`) | API/DI rail (`F:03-standards.md:19`; `F:02-architecture.md:328–334`) | Yes, cited lock | E3 Nest (`NOTES.md:69`) | Express-only/Fastify-only violates S-03 | Generated API cannot start |
| Angular family (C/web) | 22.2.1 → template web lock (`S:packages-web/angular/package.json:48–54`; `S:scripts/check-engines.mjs:14–15`) | Standalone OnPush rail (`F:02-architecture.md:328–334`) | Yes, same source | E1 (`NOTES.md:67`) | React/Vue violate S-04 | Web surface cannot compile |
| pino + prom-client (C) | 10.3.1 + 15.1.3 → consumer lock (`L:1537–1539,1356–1358`) | Redacted logging/metrics S-71 (`F:02-architecture.md:333`) | Yes (`S:packages/logging/package.json:34`; `S:packages/health/package.json:35`) | E3 (`NOTES.md:69`) | Winston/OTel adds no required mechanism | Standard logging/metrics missing |
| Required @stynx-nyx app/testing packages (C) | Current manifests 1.6.2; compliant successor pins in 12 (`NOTES.md:55`) | Auth/context/data/roles/idempotency/localization/logging/metrics and isolation tests (`F:02-architecture.md:20,83,328–334`) | Yes, cited manifests | Backend E3 → E1 required; web E1 (`NOTES.md:69`; `NOTES.md:67`) | Whole fixed group installs unrelated features | Required helper imports absent |
| STYNX core UUIDv7 helper (C; no extra package) | Core release as above; public export (`S:packages/core/package.json:3`; `S:packages/core/src/index.ts:14`) | S-70 backend/test producer and validation (`F:02-architecture.md:70,83`) | Yes (`S:packages/core/src/request-id.ts:1–44`) | Core E3 → E1 required (`S:packages/core/package.json:12–17`) | Extra uuid package duplicates backend helper | Required request IDs unavailable |
| Claude Code / Codex CLI (B/W) | Host-managed capability checks; `claude` 2.1.292, `codex` 0.163.0 (12 §3) (`F:decisions.md:399–401`; `NOTES.md:75`) | `review`, `permissions-pattern` (`F:02-architecture.md:85,88,220–240`) | Not selected from STYNX dependencies | E4 | Provider SDK/orchestration framework duplicates harness | Missing binary/capability → UNKNOWN |

[opinion] Not adding: speculative public versions or direct dependencies merely because they appear transitively.

## 3. Parsing, validation and CLI support

[opinion] Commander handles the existing grammar. Render plain text, JSON and summary from the same results; no TTY-dependent colour or progress in JSON. Spawn with `node:child_process`, an argument vector, `shell:false`, explicit cwd/environment and bounded output/time. `devai init` installs hooks by setting `core.hooksPath` (`F:02-architecture.md:18–22,245,387–440`; `F:decisions.md:421–422`). Hash raw blobs with SHA-256; candidate framing includes paths, modes, deletions and base, checked before/after execution, respecting the review/cache exclusions (`F:02-architecture.md:427–432,529–538`).

[opinion] Parse YAML documents with positions, YAML 1.2 core and `uniqueKeys:true`; walk the document before conversion, explicitly rejecting aliases, tags and non-string keys. [fact] Unknown tags can be warnings, so checking `document.errors` alone is insufficient (`S:node_modules/yaml/dist/compose/compose-scalar.js:62–70`; `S:node_modules/yaml/dist/compose/composer.js:65–70`). js-yaml has a Core schema; it is rejected as a second parser (`P:js-yaml@4.3.2/node_modules/js-yaml/index.js:17`). Preserve 05's packet-invalid exits and 06's malformed-readable-input diagnostics (`F:05-task-packet.md:208–214,231–234`; `F:06-spec-format.md:160–175`).

[opinion] All five persisted artifact schemas—`devai.json`, packet front matter, spec machine block, use-case JSON and `review.json`—and the sensor verdict are closed zod definitions, without coercion. Emit and commit `devai.schema.json` and the use-case JSON Schema using `z.toJSONSchema()`; emit model CLI schemas from their corresponding definitions. Uniqueness is enforced with `superRefine`s, including roles/rules/endpoints and local identifier sets. These constraints do not project: an editor may accept a duplicate that `spec-lint` rejects inside the loop. The DEVAI build lints that every artifact schema projects and committed projections match; do not silently replace unsupported constructs with permissive schemas (`F:decisions.md:403–411`; `NOTES.md:60`). Source resolution and route joins remain semantic checks.

[opinion] Use `ignore` for scope, protected classes and tier globs. Evaluate repository-relative paths from the complete inventory/diff, including deletes and both rename sides. Allowed and forbidden are separate matchers; forbidden wins (D-052). Apply the same gitignore dialect to tier inclusion/exclusion (`F:decisions.md:348–351,418–420`; `F:04-layout.md:105–122`; `F:05-task-packet.md:214–215`). Not adding: Ajv, gray-matter, minimatch or a second matcher.

## 4. Database nodes and runtime services

[opinion] Keep PostgreSQL 16 and resolve bare `DATABASE_URL` or Docker Compose once, without fallback. In either mode, pg creates a uniquely named empty scratch database on the declared server. The host shell runs `database/apply.sh` with host psql against that scratch URL, SQL errors fatal; Compose exposes the server port. Preflight shell, psql and, in Docker mode, docker/Compose plus daemon access. Missing binary, connectivity or create privilege yields UNKNOWN with a remedy (`F:02-architecture.md:81–83,301–317`; `S:scripts/db-verify.mjs:11`). Separate migration credentials from app/reader roles, close connections and remove only the created scratch DB. Keep descriptors in existing scratch storage (`F:02-architecture.md:533`).

[opinion] `sql-typed` uses libpg_query for bindings and pg PREPARE/OIDs/RowDescription without executing candidate writes. [fact] Describe is internal `Connection.describe`, not public `Client.describe` (`P:pg@8.23.1/node_modules/pg/lib/connection.js:233–235`). 08 must version-bind and prove the adapter; unsupported capability means UNKNOWN. Parser-load failure in migration-linter currently returns silently; its published interface must expose that failure as UNKNOWN (`S:tools/migration-linter/src/parser.ts:1–14`; `F:02-architecture.md:169–193,392–400`). Not adding: another driver, ORM, testcontainers, Docker SDK or alternate SQL-apply path.

## 5. Invoked checks and consumer pins

[opinion] Invoke installed checks, normalizing results without downloading during checks. Vitest follows tier selection and excludes acceptance from unit; its adapter must establish collection, behavioral-assertion reachability and green rail assertions for expected-red. Retain the metadata-preserving SWC transform for Nest tests; provision Playwright browsers before checks (`F:04-layout.md:105–122`; `F:06-spec-format.md:189–191`; `S:tools/repo-config/vitest.base.mjs:243–253`). ESLint loads published profiles plus the v3 overlay; `i18n` performs catalog parity and `@angular-eslint/template/i18n`, not extraction (`F:02-architecture.md:64–65,74`).

[opinion] Source the consumer compatibility pins from `S:scripts/check-engines.mjs:13–24`: Angular build 22.2.1, Nest peer ^11.1.19, TypeScript 6.0.3 and Node typings 24.13.4. Resolve exact consumer locks from the table; `~6.0.3` is DEVAI's D-057 TypeScript choice, not the checker's current `^6.0.3`. Emit only required STYNX imports, with verified published versions rather than `workspace:*`. Keep pg transitive through data where the consumer does not import it (`S:packages/data/package.json:37`).

[opinion] Core's backend/test UUIDv7 helper is retained, but current missing-ID synthesis must become rejection (`S:packages/core/src/core.module.ts:42`; `F:06-spec-format.md:422–426`). Browser production belongs in 09 because core imports `node:crypto` (`S:packages/core/src/request-id.ts:1`). Not adding: every STYNX package by default, browser UUID dependency yet, universal coverage thresholds or another DAG runner.

## 6. Agent harness interfaces

[opinion] Select the other-family reviewer from trailers and `review.reviewers`; unknown/equal family remains UNKNOWN, with no first-entry fallback (`F:02-architecture.md:450–459`). The one exception is the sensor: when no family resolves, it runs the first configured reviewer in `Family` order (D-074). Send reviewer and sensor prompts on **stdin**, never in a long argv element (D-057). These are argument-vector recipes; placeholders are values, not shell substitutions (`F:decisions.md:423–425`; `NOTES.md:75`):

```text
claude -p --output-format json --json-schema <schema-json> --model <model>
  --no-session-persistence --setting-sources "" --strict-mcp-config
  --mcp-config '{"mcpServers":{}}' --allowedTools <approved-rules>
codex exec --json --output-schema <schema-file> --model <model> --ephemeral
  --ignore-user-config --ignore-rules --skip-git-repo-check --cd <isolated-root>
  --sandbox <enforced-policy> -
```

[opinion] Extract Claude `structured_output`; collect Codex's completed final agent message and require successful terminal `turn.completed`, not merely process exit zero. Parse and validate the result with the same zod definition that emitted its CLI schema. [fact] These output shapes are documented ([Claude headless](https://code.claude.com/docs/en/headless), lines 157–182; [Codex non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode), lines 984–1021; `NOTES.md:75`).

[opinion] For the sensor add Claude `--tools ""`; `--allowedTools` grants prompt-free permission, not tool removal. Codex read-only sandbox still permits command execution, so it does not establish “no tools.” 08 must verify tool disabling, temperature and budgets; missing enforceable capability yields UNKNOWN. Reviewer phase blindness, read-only candidate and scratch-only execution likewise require demonstrated harness isolation, not these flags alone (`F:02-architecture.md:238–240,461–498`; [Claude CLI reference](https://code.claude.com/docs/en/cli-reference), lines 105,186–187; `NOTES.md:75`).

[opinion] Missing auth/source, invalid JSON/schema, absent terminal success or incomplete sensor coverage yields UNKNOWN; a validated violation yields FAIL. CI verifies bound digests rather than regenerating model results (`F:02-architecture.md:230–240,455–459`).

[opinion] Apply a bytes-per-token proxy before calls for the 60k sensor and 150k reviewer bounds, then use CLI-reported usage, not model self-report; 08 fixes the proxy and accounting. Input/time exhaustion before complete review yields UNKNOWN; counterexample-budget exhaustion leaves findings `derived` (`F:decisions.md:438–439`; `F:02-architecture.md:206–208,474,497–500`). Not adding: tokenizer, provider SDK, shell evaluation, hidden retries, Markdown repair or new sensor configuration fields.

## 7. What we are not adding

[opinion] D-055 and the existing component boundary govern exclusions (`F:decisions.md:388–401`; `F:02-architecture.md:596–614`):

- Ajv: D-056 fixes zod as the sole schema source and validator.
- Husky: `devai init` already installs hooks through `core.hooksPath`.
- Pin files: engines/packageManager suffice; host patches belong in 12.
- Tokenizer: D-057 selects proxy plus reported usage.
- i18n extractor: the node needs catalog parity and template lint.
- Colour libraries: plain text/JSON meet the output contract.
- OpenTelemetry: no named mechanism needs traces; S-71 does not ban later adoption.
- isomorphic-git: installed git supplies snapshot semantics.
- Plugin system, config DSL, task queue, DEVAI database and web UI: existing nodes, inert JSON, external harnesses, cache/git and PR summary suffice.
- Mutation tooling, signed receipts and attestations: D-004 and D-002 exclude them here.
- Second package manager or runtime: no mechanism needs another resolution/execution authority.

## 8. Closure

[opinion] No Owner item remains for 07. Publication identity, founding version and exact release pins stay in 12; implementation prerequisites are assigned in NOTES. Finalizing this document does not claim publication, clean-install success or a runnable v3 acceptance path.
