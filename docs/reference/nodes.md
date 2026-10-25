---
title: Check nodes
sidebar_position: 3
description: The 28 check-node contracts of 08 Part B in table form, with standards, placement, population, statuses and reason codes.
---

# Check nodes

`devai check` runs a fixed graph of **28 nodes** ([02 §2](../framework/02-architecture.md), [08 Part B](../framework/08-cli-and-nodes.md)). The ids are a closed enum (`NodeId` in [08 C.2](../framework/08-cli-and-nodes.md)); there is no plugin or node registry ([08 Part D](../framework/08-cli-and-nodes.md)). Each 08 block has nine rows: Standards, Inputs, Population, Invokes, Observation, Status, Findings, Latency/where, Needs. The tables below condense them; the 08 block is the contract.

## Conventions that hold for every node

From [08 §0](../framework/08-cli-and-nodes.md) and [02 §2](../framework/02-architecture.md):

- **Four statuses:** `PASS`, `FAIL`, `UNKNOWN`, `SKIPPED` ([02 §8](../framework/02-architecture.md)).
- **Counts.** Every node reports `expected`, `observed`, `evaluated`. `PASS` needs `evaluated = observed = expected` and no finding. With a complete inventory, `observed < expected` is `FAIL`. The runner rewrites a success with `observed = 0` to `UNKNOWN: no-observations` (S-65).
- **`SKIPPED` is decided only by `inventory`**, from the population predicate written per node; the predicate string is printed as evidence ([D-044](../../decisions.md)). A node that runs and finds nothing to do while its population was non-empty is `UNKNOWN`, never `SKIPPED`.
- **Deferred** nodes (not planned for this invocation) have no row; `accept` lists them without a status ([D-058](../../decisions.md)).
- **Prerequisites.** A node whose prerequisite is `FAIL` or `UNKNOWN` does not run and is reported `UNKNOWN: prerequisite-failed`, locator = the prerequisite ([08 C.1](../framework/08-cli-and-nodes.md) step 8). `accept` is exempt.
- **Tools** are spawned as argument vectors with `shell: false`, explicit `cwd`, bounded output and bounded wall time; a missing binary is `UNKNOWN: tooling-missing` with the install command ([07 §3](../framework/07-dependencies.md), [D-029](../../decisions.md)).
- **Cache.** Only `PASS` is cached ([08 C.4](../framework/08-cli-and-nodes.md)).
- **Findings** carry a locator, message, standard id and a one-line hint ([02 §8](../framework/02-architecture.md)).

### Latency and placement letters

Latency ([02 §2](../framework/02-architecture.md) rule e): **A** sub-second, **B** ≤ 30 s, **C** minutes. Where: **E** edit loop, **C1** pre-commit (staged), **P** pre-push, **R** PR, **F** full acceptance. Classes A and B form the edit loop; the class partition is provisional under [D-047](../../decisions.md).

### Prerequisite edges

From [08 C.1](../framework/08-cli-and-nodes.md) step 3: `inventory → *`, `db-apply → sql-typed (DB)`, `sql-typed (DB) → spec-tests`, `sql-typed (DB) → integration`, `typecheck → route-contract`, `typecheck → openapi`, `route-contract → permissions-pattern`, every deterministic node `→ review`, `permissions-pattern → review`, `* → accept`.

## Table 1 — identity, placement, population

"Population" is the predicate `inventory` evaluates; when it is empty the node is `SKIPPED` with exactly this evidence string.

| # | Node | Standards | Lat. | Where | Needs | Population (`SKIPPED` evidence) |
|---|---|---|---|---|---|---|
| 1 | `inventory` | S-06, S-07, S-31, S-62 | A | all | — | Always applies; never `SKIPPED` |
| 2 | `format` | S-41 | A | E, C1 | — | `no changed *.{ts,mjs,json,md}` |
| 3 | `lint` | S-01, S-05, S-25, S-31, S-33–S-38, S-41, S-50, S-51 | B | E, C1, R | — | `no changed *.ts, *.mts or *.html` |
| 4 | `lint-tests` | S-60 | A–B | E, C1, R | — | `no changed *.spec.ts` |
| 5 | `typecheck` | S-30–S-33, S-31 (D-045) | B | E, P, R | — | `no affected project` |
| 6 | `layout` | 04 §1–§6, D-017, D-021–D-024, D-027, D-031, S-62 | A | E, P, R | — | Always applies (the root itself is the population) |
| 7 | `sql-lint` | S-02, S-15, S-17, S-24 (LINT001–013), D-033, D-043 | A | E, C1, R | — | `no changed *.sql` |
| 8 | `spec-lint` | S-25, D-008, D-016, D-048, D-056 | A | E, P, R | — | `no changed specs/** or product/**` |
| 9 | `route-contract` | S-10, S-11, S-20, S-22, S-25, S-26, S-28, S-70 | B | E, P, R | — | `no mounted routes in domain/<m>` **and** spec `routes[]` empty |
| 10 | `sql-typed` | S-21, S-27, D-010, D-030, D-054 | A static / B DB | E static; P, R, F DB | `postgres` (DB part only) | `no *.repository.ts changed` |
| 11 | `unit` | tests (04 §4), S-62 | B | E, P, R | — | `no unit test files in affected projects` |
| 12 | `test-integrity` | S-63, S-64 | A | E, P, R | — | `no changed test/**` |
| 13 | `i18n` | S-16 | A | E, P, R | — | `no opted-in locale beyond en-US and no Angular app` |
| 14 | `actionlint` | S-43 | A | P, R | — | `no changed .github/**` |
| 15 | `commitlint` | S-40 | A | commit-msg (and F over the range) | — | `no commits between base and HEAD` (`--full` only) |
| 16 | `generated` | S-45, D-033 | B | P, R | — | `no generation-manifest.json under domain/`; for `code`/`fix`: `no changed @generated file or manifest` |
| 17 | `boundary` | S-34, S-44 | B | P, R | — | Never `SKIPPED`; a missing `.stynxrc.json` is `FAIL` |
| 18 | `deadcode` | S-42 | B–C | P, R | — | Always applies |
| 19 | `openapi` | S-20, S-22, S-23, S-40 | B–C | P, R | — | `no app binding changed and no public-API surface changed` |
| 20 | `db-apply` | S-01, S-02, S-13, S-17, S-18 | C | P (SQL changed), R, F | `postgres` | `no database/` |
| 21 | `spec-tests` | S-61, S-63, S-65, S-67, D-051 | B–C | F, R | `postgres` | `no acceptance file for <spec id>` |
| 22 | `integration` | tiers (04 §4), S-02, S-18, S-70 | C | P (affected), R | `postgres` | `no test/integration or test/db files affected` |
| 23 | `e2e` | tiers (04 §4) | C | R | — (the app's own services) | `no test/e2e files` |
| 24 | `permissions-pattern` | S-12 (D-009, D-025) | C + tokens | F, R (R verifies the evidence digest only) | `model` | `no mounted routes` |
| 25 | `protected-paths` | D-019, D-027, D-031, D-046 | A | P (notice), R (label) | — | Always applies |
| 26 | `packet-scope` | 05 §5 PL-01–PL-07, PL-09, PL-11, PL-13, PL-14, PL-17; 06 §4 SL09–SL11; D-052, D-054 | A | F, R | — | Always applies under `--packet`; without a packet it is deferred, not `SKIPPED` |
| 27 | `review` | S-64, S-66; D-003, D-028, D-035, D-037, D-042 | C + tokens | F; R verifies the digest only | `model` | Always applies under `--packet --full`; otherwise deferred, not `SKIPPED` |
| 28 | `accept` | S-65; D-005, D-047, D-051 | A | all | — | Always applies; always executes; never cached; never blocked by a failed prerequisite |

Count: 28 rows; 4 nodes need `postgres` (`sql-typed` DB part, `db-apply`, `spec-tests`, `integration`), 2 need `model`.

## Table 2 — what each node invokes and observes

| Node | Invokes | One observation = |
|---|---|---|
| `inventory` | `git ls-files`, `git diff --name-status --no-renames`, `node`/`corepack`/`pnpm --version`, `tsc --showConfig` per project; TypeScript library for the mount walk | one workspace package manifest. Side products: `toolchainDigest`, every population, the mounted-route population, test census per tier, project closure |
| `format` | `prettier --list-different -- <files…>` (Prettier 3.9.6) | one file |
| `lint` | `eslint --format json --max-warnings=0 --no-warn-ignored -- <files…>` (ESLint 10.10.0): published STYNX profiles plus the v3 overlay and `devai/*` rules | one file |
| `lint-tests` | `eslint --config <@stynx-nyx/eslint-config/test> …`; CW-1 (`WAVE-05A/CW-1:`) and `R19-W06:` messages mapped by prefix ([D-086](../../decisions.md)) | one test file |
| `typecheck` | `tsc -b --verbose --pretty false <tsconfigs…>` (TypeScript 6.0.3; no trailing `--`) | one project |
| `layout` | Nothing; path predicates with `ignore` 7.0.5 | one predicate × path |
| `sql-lint` | `stynx-migration-lint <root>… --format=json --lgpd --base-dir <dir> --manifest <path>`, one invocation over every root ([D-085](../../decisions.md)); imports `pg-query-emscripten` 5.1.0 first | one SQL file across the roots |
| `spec-lint` | In-process `yaml` 2.9.0 and zod 4.4.3 | one spec file (SL01–SL08, SL12) |
| `route-contract` | `stynx list-routes --json --roots <…>`; TypeScript library for decorator arguments | one `(method, normalised path)` pair in spec routes ∪ mounted routes |
| `sql-typed` | Static: TypeScript library over each `defineQuery`. DB: `pg` 8.23.1, one Submittable per query sending parse/describe/close/sync, never bind/execute ([D-068](../../decisions.md)) | one `defineQuery` site |
| `unit` | `vitest run … --project <affected…>` with `TEST_TIER=unit` and the C.5 reporter | one test case |
| `test-integrity` | TypeScript library (parse only) | one changed test file |
| `i18n` | In-process catalog comparison; `eslint` with `@angular-eslint/template/i18n` | one `(key, locale)` pair, plus one per template file |
| `actionlint` | `github-actionlint -format '{{json .}}' -- <files…>` (1.7.12) | one workflow file |
| `commitlint` | `commitlint --config tools/commitlint.config.mjs --edit <msgfile>` or `--from <base> --to HEAD` (21.2.2) | one message |
| `generated` | The DEVAI generator in check mode; `stynx verify-api-coverage --strict --json`, `stynx verify-public-api-baselines --json`, `stynx-sdk-codegen --check …` | one `mode: generated` manifest entry, plus one per STYNX pair |
| `boundary` | `stynx verify-stynx-boundary --json` | one source file scanned |
| `deadcode` | Per package: `knip --reporter json …`, `depcheck … --json`, `madge --circular --json …` | one package × tool (expected = packages × 3) |
| `openapi` | `stynx verify-api-coverage`, `stynx verify-openapi-contract`, `stynx verify-public-api-baselines` (all `--json`) | one of the three checks plus the changeset rule (expected = 4) |
| `db-apply` | Preflight `sh`, `psql`, docker; `CREATE DATABASE devai_<digest12>`; `sh -x database/apply.sh`; `psql -f database/checks.sql`; `stynx verify-rls-negative --json`; schema digest | one applied SQL file |
| `spec-tests` | `vitest run … -- <acceptance file>` with `TEST_TIER=acceptance` and the C.5 reporter | one top-level `it` named `^R-(\d+): ` |
| `integration` | `vitest run …` once per populated tier (`TEST_TIER=integration`, `TEST_TIER=db`) | one test case |
| `e2e` | `playwright test --config playwright.config.ts --reporter json` (1.60.0) | one test |
| `permissions-pattern` | The reviewer command of the candidate's worker family, no tools, 120 s wall time | one inspected entrypoint |
| `protected-paths` | `git diff`, `git ls-files`; `ignore` 7.0.5, one matcher per class | the classification of the whole diff (expected = 1) |
| `packet-scope` | `git`, `yaml`, zod, `ignore` (one `allowed`, one `forbidden` matcher) | one changed path plus one per PL/SL rule |
| `review` | Two invocations of the other-family CLI (phase 1 blind, phase 2 in a scratch worktree) | one `acceptance: yes` requirement (or deliverable obligation for `spec`/`standards`) |
| `accept` | Nothing | one planned node other than `accept` |

## Table 3 — statuses and reason codes

`FAIL` and `UNKNOWN` conditions specific to each node. Reason codes are in `code` form; every one is listed on [Reason codes](./reason-codes.md).

| Node | `FAIL` when | `UNKNOWN` reasons |
|---|---|---|
| `inventory` | a manifest without `"type": "module"`; wrong effective `module`/`moduleResolution` (Node `nodenext`, Angular `es2022`/`bundler`); a missing strictness option or `target` ≠ `es2022`; a workspace glob naming no package | `engines-mismatch`, `tooling-missing`, `mount-unresolved` |
| `format` | stdout lists ≥ 1 path, or a syntax error in a candidate file | `tooling-missing`, `runner-crashed` |
| `lint` | any message (warnings count); an expected file absent from the JSON | `lint-config-failed`, `tooling-missing` |
| `lint-tests` | as `lint` | as `lint` (`./test` is exported by `@stynx-nyx/eslint-config` 3.0.0; [D-089](../../decisions.md)) |
| `typecheck` | ≥ 1 diagnostic; effective `module: commonjs` or a missing strictness option | `tooling-missing`, `runner-crashed` |
| `layout` | any predicate violation | `io` |
| `sql-lint` | ≥ 1 issue or `parserIssues` entry naming a candidate file (one invocation over every root; [D-085](../../decisions.md)) | `tooling-missing`, `parser-unavailable`, `lint-config-failed` / `io` (exit 2 without JSON, by stderr), `runner-crashed` |
| `spec-lint` | any SL01–SL08/SL12 violation, incl. malformed readable YAML | `io` |
| `route-contract` | a pair on one side only; any of the five contract fields mismatched; a non-literal decorator argument; boundary input without `parseDto`/typed pipe; a route neither role-bound nor `@Public()`; an unknown `@UseCase` id; an app root module without request-id middleware | `tooling-missing` (incl. a `@RequireRoles` route while `list-routes` does not read it; [D-087](../../decisions.md)), `mount-unresolved`, `prerequisite-failed`, `runner-crashed` |
| `sql-typed` | any static or DB mismatch; a prepare error (SQLSTATE + server message) | `unsupported-oid`, `unsupported-binding`, `adapter-unbound`, `postgres-unreachable`, `prerequisite-failed`, `parser-unavailable` |
| `unit` | ≥ 1 failed case; a test module that fails to import; a skipped or pending case (collected, not observed; [D-081](../../decisions.md)) | `runner-crashed`, `timeout`, `tooling-missing` |
| `test-integrity` | `.skip/.only/.todo` without issue reference; literal verdicts; assertion count below 80 % of base without annotation; any change to a base-present acceptance file without `// @acceptance-change: approved-by=`, or any such edit while `kind ∉ {test}`; an `acceptance: yes` case removed | `base-unreadable` |
| `i18n` | a key missing in a locale; a spec key absent from `en-US`; any template i18n message | `catalog-unresolved`, `io`, `tooling-missing` |
| `actionlint` | ≥ 1 entry | `tooling-missing`, `runner-crashed` |
| `commitlint` | exit 1 with a parsed violation | `tooling-missing`, `lint-config-failed`, `io` (pre-flighted before invoking), `runner-crashed` ([D-086](../../decisions.md)) |
| `generated` | byte difference; generated file missing or unlisted; hand-edited `@generated` file outside a manifest; a STYNX pair reporting drift. Never because the spec at HEAD changed status | `generator-version-mismatch`, `generator-unavailable`, `tooling-missing` |
| `boundary` | any violation line; `.stynxrc.json` missing | `config-invalid` (`.stynxrc.json` fails DEVAI's zod check; [D-087](../../decisions.md)), `tooling-missing`, `runner-crashed` |
| `deadcode` | any unused file/export/dependency, missing dependency, cycle | `tooling-missing`, `runner-crashed` |
| `openapi` | any check failure; a breaking baseline without a major changeset | `tooling-missing` (incl. while STYNX publishes no write pair; [D-088](../../decisions.md)), `config-invalid`, `prerequisite-failed`, `base-unreadable`, `runner-crashed` |
| `db-apply` | `psql` error; `checks.sql` assertion; RLS-negative violation; a role connecting as owner for app checks; `observed < expected` | `shell-missing`, `psql-missing`, `docker-unreachable`, `postgres-unreachable`, `scratch-collision`, `tooling-missing` |
| `spec-tests` | `observed < expected` (uncovered `R-n`); foreign, duplicate or untagged top-level cases; a non-named case failed; a named expected-red case passed; a non-named case failed before its assertion | `setup-failed`, `expect-red-not-reached`, `assertion-unresolved` |
| `integration` | as `unit`; a suite that connected as owner for an isolation assertion | as `unit`, plus `postgres-unreachable`, `prerequisite-failed` |
| `e2e` | ≥ 1 failed or timed out | `browsers-missing`, `setup-failed`, `runner-crashed`, `tooling-missing` |
| `permissions-pattern` | `verdict: violation` with ≥ 1 valid finding | `slice-too-large`, `missing-source`, `mount-unresolved`, `schema-invalid`, `model-error`, `timeout`, `verdict-unknown`, `tool-use-observed`, `capability-missing`, `no-reviewer-configured`, `family`, `stale`, `input-bound-exceeded`, `output-bound-exceeded` |
| `protected-paths` | never (a notice; `PASS` when evaluated) | `base-unreadable` |
| `packet-scope` | every PL/SL rule it owns that is not a pre-DAG stop; pre-DAG rules end the command with exit 2 `packet-invalid` / `base-not-ancestor` | `base-unreadable` |
| `review` | verdict `blockers` | `family`, `no-reviewer-configured`, `model-error`, `schema-invalid`, `verdict-unknown`, `review-incomplete`, `budget-exhausted`, `input-bound-exceeded`, `output-bound-exceeded`, `capability-missing`, `stale` |
| `accept` | PL-15, PL-12, PL-16, or any gating `FAIL` | any gating `UNKNOWN` and no `FAIL`, carrying the first such node's reason ([D-084](../../decisions.md)); `runner-crashed` (a planned node without a status) |

`PASS` rules worth noting: `permissions-pattern` passes iff `verdict: compliant`, `unresolved` empty, every locator valid, `observed = expected` and `confidence ≥ minConfidence`; `spec-tests` passes iff every non-named case passed and every named case failed at a reached assertion ([08 B.21, B.24](../framework/08-cli-and-nodes.md)). Any node may additionally be `UNKNOWN: no-observations` (runner rewrite) or `UNKNOWN: prerequisite-failed` (runner, step 8).

## Gating

Every planned node gates the exit code except `review` while `devai.json` `review.mustRun` is false and `protected-paths` reports no undeclared class (`declared: false`). Gating is derived at read time, never stored ([08 C.2](../framework/08-cli-and-nodes.md), [D-028](../../decisions.md), [D-058](../../decisions.md)).

## Model-node budgets

| Node | Input bound | Output bound | Other bounds |
|---|---|---|---|
| `permissions-pattern` | `ceil(utf8Bytes(slice + question) / 3.5)` ≤ `maxInputTokens` before the call; CLI-reported input tokens binding after | ≤ 2000 output tokens | 120 s wall time; zero tool items in the stream |
| `review` | ≤ 150k input tokens (`bytes/3.5` proxy before, CLI usage after) | ≤ 4k output | ≤ 20 tool calls across both phases; ≤ 5 min total |

Source: [08 Part B, C.1, C.2, Part D](../framework/08-cli-and-nodes.md), [02 §2, §8](../framework/02-architecture.md), [05 §3](../framework/05-task-packet.md), [D-044](../../decisions.md), [D-047](../../decisions.md), [D-058](../../decisions.md), [D-068](../../decisions.md).
