<!-- Ratified 2026-10-19 (D-064, D-065, D-066); promoted from agents/consolidate-8/claude-opus/, revised for D-064's Owner choices (P-8-08 relicensing, P-8-09 public). One-time plan. Amended in place by D-080 (§5 H3/H5), D-090 (§5 H7, §6, §8), D-091 (§5 H3/H5, ruleset struck) and D-100 (§4 R6, done clause); the line below is consolidation 8's provenance as of 2026-10-18. -->
<!-- Consolidation 8 · Claude Opus 5.5 · 2026-10-18. Base: draft-round-8/claude-opus (reviews split; NOTES §1). Binding: decisions.md D-001–D-063, 01–10; 11 PROVISIONAL. P-8-nn, E-8-nn and Owner items: agents/campaign-8/. devai: = v2 @ 4289ff51 (origin aarusso-nyx/devai); stynx: @ 63e5f788; detran: @ 50b6c174; gh: = `gh api` 2026-10-18/19; ref: = reference/succession-2026-07/. Not promoted. -->
# 12 — Succession plan

Tags: `[fact]`, `[inference]`, `[opinion]`. Unprefixed citations are `foundation/`. Owner rulings on P-8-nn are D-064; adopted orchestrator rulings are D-065.

## 0. The brake, applied

[opinion] A one-time plan: no node, state, command or field. `ci.yml` and `.npmrc`, which no foundation document places, name their mechanism (§5, §2), as does every ceremony step. From the legacy → v2 succession (`ref:Plan.md:22-31`) it keeps "law transfers; evidence standing does not" (`ref:D-196.md:60-63`), not the waves, attestations or frozen records (D-002, D-055).

## 1. Identity

| Item | Value | Basis |
|---|---|---|
| CLI package | `@devai-nyx/cli` **3.0.0** | D-063 (`decisions.md:541-546`). [fact] Exists on GitHub Packages: private, 0.1.0–0.8.0, linked to archived `devai-nyx/devai-original` (gh). |
| Decorator package | `@devai-nyx/decorators` **3.0.0** | §1.1. [fact] Free (gh: 404). |
| Bin | `devai` | `08-cli-and-nodes.md:96-109`; v2's too (`devai:packages/cli/package.json:11-12`). |
| Repository | `github.com/devai-nyx/devai-v3`, branch `main`; local checkout `/Volumes/Development/projects/stech/devai-v3` (P-8-01 → D-064) | [fact] `devai-nyx/devai` is an unarchived DEVAI-II rc, last pushed 2026-08-11; `devai-v3` is 404; `…/stech/devai` is v2's checkout (gh). A fresh name renames nothing. |
| `engines` / `packageManager` | `"node": ">=24 <25"`, `"pnpm": ">=9 <10"` / `pnpm@9.15.0` | `07-dependencies.md:10`. [fact] STYNX: same (`stynx:package.json:7-10`); v2: `>=24.0.0`. |
| Licence | Apache-2.0, both packages; STYNX generator bytes carried after NYXK relicenses them to Apache-2.0 (P-8-08 → D-064) | [fact] v2 Apache-2.0 (`devai:package.json:7`); STYNX BUSL-1.1, licensor NYXK (`stynx:LICENSE:1-16`), and 02 §1 grows its `generate-module.ts` (`02-architecture.md:19`). Owner ruling: NYXK, as licensor, relicenses the STYNX generator code that 09 §5 keeps (`packages/cli/src/generate-module.ts` and the files it imports) to Apache-2.0; the CLI carries those bytes with their STYNX provenance stated in the commit (R0). |
| Visibility | repository public; packages **public** (P-8-09 → D-064; irreversible, H8) | [fact] v2: both public. STYNX: repo public, packages restricted (`stynx:.changeset/config.json:54`). [inference] The registry needs a token even for public packages, which adopters hold (`stynx:.npmrc:1-3`); public is irreversible; making `@devai-nyx/cli` public also exposes its existing 0.1.0–0.8.0. |

### 1.1 Decorators: a sibling package, not a subpath

[opinion] Product **runtime** code imports the decorators (`09-rail.md:282`); a subpath would make every product API install the CLI's TypeScript, `pg` and `pg-query-emscripten` (07 §2). The sibling has one peer, `@nestjs/common ^11.1.19` (`09-rail.md:254`). Direction: product app (or a governed STYNX package, D-007) → decorators; decorators never import `@stynx-nyx/*`; the CLI imports neither (`route-contract` reads them statically, 08 B.9). One version for both, so `generatorVersion` (`02-architecture.md:339`) names the decorators emitted (E-8-07, E-8-08).

## 2. Seed commit

[opinion] The first commit of `devai-nyx/devai-v3`; every path literal, none depending on STYNX `<v>`:

```
README.md                    new, ten lines: what DEVAI is, install, pointer to 01
AGENTS.md                    new, ≤ 40 lines: where the law is; the build command
CLAUDE.md                    "@AGENTS.md"
LICENSE                      devai:LICENSE bytes (Apache-2.0) ← the only v2 bytes
decisions.md                 foundation/decisions.md bytes after R0
docs/framework/00-intent.md 01-charter.md 02-architecture.md 03-standards.md 03b-stynx-extraction.md
  04-layout.md 05-task-packet.md 06-spec-format.md 07-dependencies.md 08-cli-and-nodes.md
  09-rail.md 10-agent-surface.md                              foundation bytes after R0 (law and spec)
package.json                 private root: type module, engines, packageManager
pnpm-workspace.yaml          packages/*
pnpm-lock.yaml               from the seed manifests
.npmrc                       both scopes → npm.pkg.github.com; ${NODE_AUTH_TOKEN} (stynx:.npmrc:1-3)
.gitignore                   node_modules/ dist/
.github/workflows/ci.yml     jobs build · matrix · publish (§5)
packages/cli/package.json    3.0.0; bin devai → dist/main.js; files [dist, template]; 07 §2 deps exact
packages/cli/src/config.ts   08 A.8 zod definition, verbatim
packages/cli/src/report.ts   08 C.2 zod definitions, verbatim
packages/cli/template/       09 §1.1 rows with foundation-fixed bytes:
  AGENTS.md README.md CLAUDE.md                                 (10 §1)
  .agents/skills/devai-task/SKILL.md  devai-spec/SKILL.md  devai-test/SKILL.md  devai-review/SKILL.md   (10 §2)
  .claude/skills/devai-task  devai-spec  devai-test  devai-review   mode 120000 → ../../.agents/skills/<name> (10:104-109)
  scripts/hooks/pre-commit  pre-push  commit-msg                 (08 A.7 after E-8-11, mode 100755)
  product/demo/README.md  product/demo/rules/RN-DEMO-001.md  RN-DEMO-002.md
  product/use-cases/UC-DEMO-001.json  specs/notes/SPEC-DEMO-001.md   (06 §7 bytes; P-8-06)
  packets/CMP-DEMO-001/campaign.md  PKT-DEMO-001.md  PKT-DEMO-002.md  PKT-DEMO-003.md  PKT-DEMO-004.md  (05 §7; base rendered by init)
  database/README.md  .stynxrc.json  .gitignore  compose.yaml  (09 §1.1 values)
packages/decorators/package.json  packages/decorators/src/index.ts   three SetMetadata wrappers; argument shapes from 06 §2
```

[inference] Law and spec cross byte for byte after R0 applies the editorial fixes that clean stale text (E-8-01…E-8-04, E-8-18); (P-8-10 → D-065). All twelve are carried: 02 cites 03 Part B (`02-architecture.md:375`), and rewording breaks D-number citations. D-055's "ADRs distributed to their owners" is the ledger: the 33 absorbed records already target 01–10, `decisions.md` or 03 (`11-migration-and-ledger.md:71-78`). No `law/adr/`; 11 and 12 stay in the bootstrap workspace (P-8-12).

In R6, not the seed (P-8-11): the packages' `tsconfig.json`, which extend the published `@stynx-nyx/tsconfig/node24.json` (`07-dependencies.md:14`); `devai.schema.json` and `use-case.schema.json` with their projection test (D-056, `07-dependencies.md:67`); `src/main.ts`; the `<v>`-dependent template files (`09-rail.md:54-56`). No v2 code. Until R6, `build` is `pnpm install --frozen-lockfile && pnpm -r --if-present build && pnpm -r --if-present test`.

**Message and author** (D-019; `02-architecture.md:245-250`):

```
chore(seed): found DEVAI 3.0.0 from the v3 foundation

decisions.md and docs/framework/ are foundation/ as of <last D-number at R0>. LICENSE is the only
file carried from aarusso-nyx/devai. Evidence standing does not transfer.

Co-Authored-By: <model that assembled the tree> <vendor noreply>
```

Author and committer `devai-agent <agent@devai.local>`, unsigned (D-002); an Owner-authored seed would read as diff ratification (D-003).

## 3. Pins

| Item | 3.0.0 pin | Written in | Rule |
|---|---|---|---|
| Node | **24.20.0**; `engines >=24 <25` | `setup-node` `node-version` in `ci.yml` and template `devai.yml` | [fact] The release host's `node` reports v24.20.0 today; another PATH reported 24.22.0 in round 8. Rule: the pin is the 24.x patch the green matrix (R8) ran on. No pin file (D-057). |
| Corepack · pnpm | 0.36.0 · **9.15.0** | `packageManager`, both roots | 07 §1. [fact] The global pnpm is 12.14.0, so every command runs through `corepack pnpm@9.15.0`. |
| PostgreSQL server | **16.15**, `postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` | template `compose.yaml` (E-8-06); `ci.yml` service | [fact] `docker image inspect`: `PG_VERSION=16.15`, that RepoDigest, local arch arm64. Rule: the tag plus the digest R8 ran, with R8 resolving it on the amd64 runner. |
| psql client | **16.15**, `/Applications/Postgres.app/Contents/Versions/16/bin` first on PATH | release host | [fact] That binary reports 16.15. Bare `psql` is not on PATH today, and another PATH resolves to 18.6. |
| Docker | client 29.9.1 · Engine 29.8.2 · Desktop 4.95.0 · Compose v5.6.0 | none (07 §4 preflight) | Observed today; tested-with, not enforced. |
| git · sh | 2.54.0 · POSIX `/bin/sh` | none | Observed; tested-with. |
| CI runner | `ubuntu-24.04` | both workflows | Rule: never `ubuntu-latest` [fact: STYNX uses it, `stynx:.github/workflows/ci.yml:31`]. |
| Actions | `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020`, `pnpm/action-setup@a8198c4bff370c8506180b035930dea56dbd5288` | both workflows | [fact] STYNX's pins (`stynx:.github/workflows/ci.yml:33-38`). Rule: full sha, re-read at R8. |
| CLI runtime (R) | `typescript ~6.0.3` (lock 6.0.3), `commander 15.0.0`, `yaml 2.9.0`, `zod 4.4.3`, `ignore 7.0.5`, `pg 8.23.1` (`pg-protocol` 1.16.1), `pg-query-emscripten 5.1.0`; dev `@types/pg 8.20.0` | `packages/cli/package.json` + lock | 07 §2 (`07-dependencies.md:28-36`); B.10 binds `pg`/`pg-protocol` (`08-cli-and-nodes.md:309`); `@types/pg` from `stynx:pnpm-lock.yaml:1170-1172` (E-8-09). |
| Template dev (B/C) | `vitest 4.1.11`, `@swc/core 1.16.2`, `unplugin-swc 1.5.9`, `@playwright/test 1.60.0` (browsers from its manifest), `eslint 10.10.0`, `prettier 3.9.6`, `knip 6.35.1`, `depcheck 1.4.7`, `madge 8.0.0`, `github-actionlint 1.7.12`, `@commitlint/cli` + `config-conventional 21.2.2`, `@changesets/cli 2.31.0`, `@angular-eslint/* 22.0.0`, `@types/node 24.13.4` | template `package.json` + lock | 07 §2 (`:40-51`), 09 §5 (`09-rail.md:249-259`). |
| Template consumer (C) | `@nestjs/{common,core,platform-express} 11.2.3`, `reflect-metadata 0.2.2`, `rxjs 7.8.2`, Angular `22.2.1`, `pino 10.3.1`, `prom-client 15.1.3` | template `package.json` + lock | 07 §2 (`:52-54`). |
| Harness CLIs | `claude` **2.1.292**, `codex` (codex-cli) **0.163.0** | the `capability-missing` / `tool-use-observed` hints (`10-agent-surface.md:462-463`) | [fact] The versions D-058 verified flags against (`decisions.md:446-448`), observed today. Rule: other versions are not refused; the capability check decides (08 B.24, B.27). |
| Model ids | reviewer and sensor for a Claude worker: `codex exec --model gpt-6-astra`; for a GPT worker: `claude -p --model claude-opus-5-5` | template `devai.json` `review.reviewers` (E-8-05) | [fact] These are the campaign's launch ids (`agents/campaign/run.sh:16,20`). 08 allows a model inside the prefix (`08-cli-and-nodes.md:166`), and D-058's calibration is per CLI/model pair. Rule: R8 records the id each CLI reports (§3.1); if it differs, this pin changes and R8 reruns. There is no runtime mismatch refusal. |
| `@stynx-nyx/*` | **`<v>`**, one fixed-group version, exact; never a range or `workspace:*` | template `package.json`; module `api/package.json`; CLI and decorators `devDependencies` (`tsconfig`) | Rule: `<v>` is the first fixed-group release on which every template-gating 11 Part A acceptance command (R3–R4) passes against the published packages in an empty consumer directory (E-8-15). This scope is D-064 (P-8-03). [inference] SM-01 changes the module format, which is semver-major from 1.6.2, so `<v>` is likely 2.0.0. The rule binds, not the number. |
| DEVAI | `@devai-nyx/cli` **3.0.0**, `@devai-nyx/decorators` **3.0.0**, both exact in adopters | template root `devDependencies`; module `dependencies` (E-8-13) | `generated` requires the installed version to equal `generatorVersion` (`09-rail.md:171`). |

### 3.1 Recorded at release (filled once by R8)

| Node | CLI | Reported model | utf8Bytes | proxyTokens `ceil(b/3.5)` | CLI inputTokens | ratio |
|---|---|---|---|---|---|---|
| `permissions-pattern` | claude / codex | | | | | |
| `review` (phase 1 + 2) | claude / codex | | | | | |

D-058's first-call calibration (`decisions.md:466-468`), read from `details` (`08-cli-and-nodes.md:653-654`), plus one line per harness for wrapper H (`10-agent-surface.md:510-511`).

## 4. Release prerequisites, ordered

| # | Prerequisite | Who | Turns observing | 3.0.0 |
|---|---|---|---|---|
| R0 | Ledger batches A, B, C ruled (§7). Foundation edits E-8-01…E-8-20 applied (D-065); E-8-21 with the ledger ruling. Fixture decomposition applied (D-064: R-5, R-6). NYXK relicensing act done (D-067; `agents/relicense-2026-10-19/GRANT.md`). 11 final | Owner | — | **blocking (seed)** |
| R1 | H1–H4; seed pushed | Owner, agent | — | **blocking** |
| R2 | 08 B.10 four-case prototype, on PG 16.15 + `pg` 8.23.1, bare and docker. Only Parse/Describe/Sync/Close are sent, never Bind/Execute, and each case ends at `readyForQuery` with the statement closed. Expected results: empty SELECT → `rowDescription` with fields; INSERT RETURNING → `rowDescription`, row count unchanged; unsupported OID → UNKNOWN `unsupported-oid`; server `errorMessage` on Parse → FAIL with the server message; dropped connection → UNKNOWN `postgres-unreachable` (`08-cli-and-nodes.md:309-311`) | agent | `sql-typed` DB (adapter bound) | **blocking**. Runs first: it needs no STYNX, and a failure reopens 02 §3 |
| R3 | STYNX wave 1: SM-01, 02, 03, 04, 06, built and callable | STYNX | `inventory`/`lint`/`typecheck` FAIL→PASS (01); `typecheck`, `inventory` (02); `lint`, `lint-tests` (03); `sql-lint` (04); `db-apply`, `integration` (06) — each UNKNOWN→observing | **blocking** |
| R4 | STYNX wave 2, template-gating: SM-07, 08, 10, 14, 15, 20 (after 01); SM-13 (after 03); SM-17 (after 06); SM-18 (after 07); SM-16, 19 | STYNX | `route-contract`, `generated`, `boundary`, `openapi`, `db-apply` RLS step (07); `sql-typed` (08); `route-contract` decorators (10); `lint` at error for N1 (13); `permissions-pattern` (14); `integration` (15, 17, 19); `lint` S-50 (16); SDK pair (18); `inventory` mount census (20) | **blocking** (P-8-03 → D-064) |
| R5 | STYNX publishes `<v>`. The R3–R4 acceptance commands are rerun against it; R6's locally built CLI serves the rows that call `devai check` | STYNX, agent | `devai init` preflight clean | **blocking** |
| R6 | CLI per 08, decorators, template per 09 §1.1, generator per 09 §2. Packages' `tsconfig.json`, both schema projections and the projection test. Template `package.json`/lock produced at `<v>` (`09-rail.md:56`). Done (D-100) when W9's clause check is green modulo the S10 list D-100 enumerates: until STYNX ships it, campaign step 4 is exit 0, or exit 2 whose only non-PASS rows are `UNKNOWN tooling-missing` or FAILs traced to the S10 list (D-088's write pair is item 1); `--full` completion is W10 code work | agent | — | **blocking** |
| R7 | Release host: psql 16.15 on PATH; `claude` 2.1.292 and `codex` 0.163.0 authenticated; Docker | Owner | sensor evidence producible (`09-rail.md:205`) | **blocking** |
| R8 | 09 §4 matrix O1–O16 and N1–N12 green in CI, with sensor evidence committed; §3.1 filled | agent | — | **blocking**. Calibration is recorded, not separately gated: an under-estimating proxy surfaces inside the matrix as `input-bound-exceeded` |
| R9 | H5: `matrix` becomes required | Owner | — | **blocking** |
| R10 | H6: tag and publish. `npm view @devai-nyx/{cli,decorators}@3.0.0 version` → `3.0.0` twice; `pnpm dlx @devai-nyx/cli@3.0.0 init --product demo` in an empty directory → exit 0 | agent | — | the release |

[inference] Critical path: SM-01 → SM-07 → SM-18 → R5 → R6 lock → R8. The rest runs alongside R3–R4.

**Not blocking 3.0.0** (`decisions.md:548-553`):
- D-047: p95 measured on the first STYNX and the first DETRAN module, both runtimes, written into each adopter's `check.editLoopCeilingMs`; 3.0.0 ships 90000.
- D-026: the first DETRAN campaign (§6).
- D-028 is per repository (`02-architecture.md:491-495`): each adopter starts `mustRun: false` and flips after its own first campaign.
- D-004 and 02 §3 step 3 stay open. SM-05, 09, 11, 12 change only STYNX's own check (D-007).
- SLO measurement (D-038, S-29) is each product's release lane; the fixture's SLOs are fictional (`06-spec-format.md:429`) (P-8-14).

## 5. Host ceremony

`ci.yml`, the DEVAI repository's only workflow, is what 02 §7 requires: the generator suite "fails the generator's PR" (`02-architecture.md:367-375`); (P-8-02 → D-064):
- `build`: the §2 command, plus `tsc -b` from R6.
- `matrix`: 09 §4, both runtimes, when `packages/cli/**` changes, as a job condition, never a workflow `paths` filter (an absent required check blocks merges silently, `detran:AGENTS.md:10`).
- `publish`: on a `v*` tag, `needs: [build, matrix]`, only if `git merge-base --is-ancestor $GITHUB_SHA origin/main`; `permissions: packages: write`; `pnpm -r publish` with `GITHUB_TOKEN` (P-8-07 → D-064).

The template's `devai.yml` (02 §1) is the adopters' required check.

| Step | Who | Command | Needed by |
|---|---|---|---|
| H1 | Owner | `gh repo create devai-nyx/devai-v3 --public` (empty) | seed push |
| H2 | agent, Owner's credential | in `/Volumes/Development/projects/stech/devai-v3`: `git init -b main && git add -A && git -c user.name=devai-agent -c user.email=agent@devai.local commit -F seed-message.txt && git remote add origin https://github.com/devai-nyx/devai-v3.git && git push -u origin main` | §2 |
| H3 | Owner | `gh api -X PUT repos/devai-nyx/devai-v3/branches/main/protection --input -` with `{"required_status_checks":{"strict":true,"contexts":["build"]},"enforce_admins":true,"required_pull_request_reviews":null,"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}`; then `gh api repos/devai-nyx/devai-v3/branches/main/protection --jq '[.required_status_checks.contexts,.enforce_admins.enabled]'` → `[["build"],true]`; the ruleset D-080 added here is retired (D-091: GitHub Free cannot require a workflow from `main`) | merge = green `build`; **no required reviews** (D-003); residual risk of a PR editing `ci.yml` in D-091 |
| H4 | Owner | Package settings: `@devai-nyx/cli` → connect `devai-v3` (0.x kept), Actions access Write; each installed `@stynx-nyx/*` → Actions access `devai-v3`, Read. [inference] GitHub's docs do not say cross-org repositories can be added; if not, `gh secret set STYNX_READ_TOKEN --repo devai-nyx/devai-v3` (`read:packages`) is the install steps' `NODE_AUTH_TOKEN` | `matrix` installs `<v>`; no publish PAT |
| H5 | Owner | H3's protection command and read-back with `"contexts":["build","matrix"]`; no ruleset (D-091) | 02 §7, once `<v>` exists |
| H6 | agent | `git tag -a v3.0.0 -m "DEVAI 3.0.0" <green main sha> && git push origin v3.0.0` | `publish` |
| H8 | Owner | After R10: package settings → Change visibility → Public for `@devai-nyx/cli` and `@devai-nyx/decorators`; read-back `gh api orgs/devai-nyx/packages/npm/cli --jq .visibility` → `public` (and `npm/decorators`) | D-064 (P-8-09) |
| H7 | Owner, then agent | `gh repo archive aarusso-nyx/devai --yes` after R10 and after §6's window closes (D-090); agent: `gh api repos/aarusso-nyx/devai --jq .archived` → `true` | §6 |
| per adopter clone | agent | `devai init` (attach) → `core.hooksPath scripts/hooks`, worktree identity (`08-cli-and-nodes.md:23-27`); needs `devai.json`, so not the DEVAI repository | hooks (D-057) |

[inference] A check, read-back, `npm view` or exit code decides each step; none needs a human reading a diff.

## 6. Cutover from v2

[fact] `aarusso-nyx/devai` was pushed 2026-10-19 01:15 UTC (2.6.3 preparation; gh); both adopters pin `@aarusso-nyx/devai` `2.6.2` exactly (`stynx:package.json:88`, `detran:package.json:96`).

[fact] 2.x continued after D-065: `@aarusso-nyx/devai` 2.6.3 (2026-10-19), 2.7.0 (2026-10-23), 2.7.1 (2026-10-24); `main` at `2df84159`, unarchived (gh, 2026-10-24; D-090).

[opinion] `aarusso-nyx/devai` keeps a **bounded stabilization window** (D-090): unarchived, defect fixes only (no features, no new law), until the first adopter (STYNX through S10, or DETRAN's first module below) has one v3 module green in its CI (`devai.yml` `matrix` or `check --full` exit 0), its applied SQL history kept (D-033) and a recovery path shown (a `devai check` after a deliberate break returns to green). Then H7 archives it: no rename or notice. `devai-nyx/devai` and `devai-verifier` are untouched; no v3 mechanism reads them (P-8-13). Adopters pin within `2.x` (`^2.6.2` or their own exact pin) until they move (D-090, replacing P-8-16). [fact] Archived repositories still serve packages and clones (`devai-original`), and every citation pin resolves remotely (`4289ff51`, `63e5f788`, `b2c5d389`).

**An adopter moves from a fresh scaffold, never by conversion** (P-8-15). [inference] `init` materialises only into an empty directory and attaches only where `devai.json` exists (`08-cli-and-nodes.md:23-25`); a v2 repository fails `layout` (DETRAN: `tests/`, `CONSTITUTION.md`; `04-layout.md:35`), and both CLIs claim the `devai` bin:
1. `pnpm dlx @devai-nyx/cli@3.0.0 init --product <prefix> --dir <empty>`, locales/LGPD per product (D-014);
2. the scaffold becomes a new repository or a migration branch; then only attach runs;
3. protection requires the `devai.yml` job;
4. modules arrive one approved spec at a time; applied SQL history is kept (D-033);
5. v2 builds on its 2.x pin until its last module is ported, then is archived.

**First DETRAN module (D-026, `decisions.md:159-168`)**: `domain/inf-rait-worklist`, narrowly the analyst's "claim next", existing case integration a declared boundary (`detran:docs/framework/arch/rait-web-journeys/JW-01-analista.md:10-11,60-68`); (P-8-05 → D-064). Criteria: one capability in one app (prefix → `productPrefix`, D-032), rules in DETRAN `product/` (D-008), at least one write route. Its `kind:` packets measure D-026's packets/PRs/touches, D-028's shadow counts and D-047's p95. No DETRAN rule is quoted (D-048). **STYNX** keeps its 2.x pin until R5 and its own rows land (D-090).

## 7. 11 ledger review

[fact] All 186 `confidence: low` rows carry an `alternative`. By bucket pair (recounted today), (P-8-04 → D-064):

| Batch | Rows | Split | v3 text affected | Decision |
|---|---|---|---|---|
| A | 125 | REJECTED ↔ JOURNAL (83 / 42) | none: neither bucket carries an obligation | one Owner ruling, "as recorded" (P-7-01) |
| B | 4 | ABSORBED ↔ ABSORBED, other target (`CONST-ART-01`, `-37`, `-39`, `INV-CORE-001`) | none: both targets carry the text | one ruling, in A's panel |
| C | 57 | absorbed ↔ not (14 absorbed now, 43 not) | possibly | three panels by owner: spec 27, standards 17, decisions 13 |

[opinion] An agent prepares one line per row (id, obligation, bucket, alternative, carrying v3 path:line or "none"); the Owner rules per batch or panel and may isolate any row. A row needing *new* text is a foundation edit (D-055). Then bucket changes are written once into `11-ledger.json`, 11's PROVISIONAL header goes, and the ledger decision (D-066) records counts and the ledger sha256. 11, the ledger and 12 remain bootstrap history, never read or edited again (`11-migration-and-ledger.md:122-123`). The review precedes the seed (R0; `decisions.md:553`).

## 8. What we are not building

- No `devai.json`, adopter layout, hooks or self-check in the DEVAI repository; its matrix runs `--full` in sixteen temporary workspaces (P-8-02).
- No Changesets there: two packages, one literal version, no node over it; in adopters it stays the `openapi` mechanism (P-8-18). No signed tags, provenance or attestations (D-002).
- No migration command, converter, shim, dual bin or 2.x branch; 2.x takes defect fixes only, during §6's window (D-090).
- No v2 code or law text, evidence standing, genesis attestation, seed hash inventory or frozen succession folder (P-8-12).
- No rename, redirect or notice; no archive beyond `aarusso-nyx/devai`, and that one after §6's window (D-090).
- No hosting for the `$schema` URL; the committed `devai.schema.json` is the artifact.
- No pin file or enforced tested-with versions (D-057); no model-id mismatch refusal.
- No publish PAT, CODEOWNERS or required reviewers (D-003). No SLO measurer in DEVAI's release (P-8-14).
- No ledger tooling, index or forward maintenance.

## 9. Open items

None open from round 8: P-8-01…P-8-09 ruled in D-064 (the Owner chose relicensing for P-8-08 and public packages for P-8-09; the rest as recommended); P-8-10…P-8-18 adopted in D-065. The ledger panels (§7) were ruled in D-066.
