---
title: Repository
sidebar_position: 2
description: The layout of the devai-v3 repository as release prerequisite R6 built it.
---

# Repository

`github.com/devai-nyx/devai-v3`, branch `main`, builds two packages: `@devai-nyx/cli` and
`@devai-nyx/decorators` (12 §1, bootstrap history; [D-063](../../decisions.md),
[D-064](../../decisions.md)). It is a pnpm workspace over `packages/*`. This page describes the tree
as release prerequisite R6 built it.

## Root

| Path | What it is |
|---|---|
| `README.md` | Ten lines: what DEVAI is, how to install, where the law starts |
| `AGENTS.md`, `CLAUDE.md` | The agent guide (where the law is, the build command, the claim-tagging convention); `CLAUDE.md` is the single line `@AGENTS.md` |
| `LICENSE` | Apache-2.0. These are the only bytes carried from the v2 repository (12 §2) |
| `decisions.md` | The binding decisions, D-001 onward ([Changing the law](changing-the-law.md)) |
| `docs/framework/` | The law and the specification, `00-intent.md` through `10-agent-surface.md` |
| `package.json` | Private root: `type: module`, `engines` `node >=24 <25`, `pnpm >=9 <10`, `packageManager pnpm@9.15.0` ([07 §1](../framework/07-dependencies.md)) |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Workspace `packages/*`; the lock from the seed manifests |
| `.npmrc` | Both scopes, `@devai-nyx` and `@stynx-nyx`, point at `https://npm.pkg.github.com`, with the token from `${NODE_AUTH_TOKEN}` |
| `.gitignore` | `node_modules/`, `dist/`, and the documentation site's build output |
| `.github/workflows/ci.yml` | The repository's only workflow: jobs `build`, `matrix`, `publish` ([Building and testing](building-and-testing.md), [Release](release.md)) |

The DEVAI repository is not itself a DEVAI adopter. It has no `devai.json`, no adopter layout, no
hooks and no self-check; its `matrix` job runs the CLI in temporary workspaces instead
([D-064](../../decisions.md); 12 §8).

## The law: `docs/framework/` and `decisions.md`

The twelve framework documents and `decisions.md` entered the seed byte for byte from the bootstrap
`foundation/`, after the release-prerequisite R0 editorial fixes ([D-065](../../decisions.md);
12 §2). All twelve are carried because later documents cite earlier ones by section and decision
number (12 §2). Since the seed they have been amended by ordinary commits that pair a framework edit
with a new decision (D-068, D-070 in the history). The bootstrap documents 11 (migration ledger) and
12 (succession plan) are history, not law, never edited again except by a decision that names the edit
([D-065](../../decisions.md), [D-066](../../decisions.md)); since R6 W0 they are committed read-only under
[`docs/history/`](../history/index.md) so that `11 SM-nn` and `12 §n` citations resolve (#45).

## `packages/cli` → `@devai-nyx/cli`

| Path | Today |
|---|---|
| `package.json` | Version 3.0.0, `type: module`, Apache-2.0; bin `devai` → `dist/main.js`; `files: [dist, template, schema]`; `exports` `./eslint-overlay`; `publishConfig.registry` GitHub Packages; `repository` this repository, `directory` `packages/cli`; runtime dependencies pinned as 07 §2 lists them (`commander` 15.0.0, `ignore` 7.0.5, `pg` 8.23.1, `pg-query-emscripten` 5.1.0, `typescript` `~6.0.3`, `yaml` 2.9.0, `zod` 4.4.3; dev `@types/pg` 8.20.0) |
| `src/config.ts` | The `devai.json` zod definition, verbatim from [08 A.8](../framework/08-cli-and-nodes.md) |
| `src/report.ts` | The `report.json`, sensor-evidence and review zod definitions, verbatim from [08 C.2](../framework/08-cli-and-nodes.md) |
| `template/` | The [09 §1.1](../framework/09-rail.md) template `devai init` materialises (below) |
| `src/main.ts` | The 08 Part A preamble: `devai.json` load (A.8), runtime resolution (02 §6), `--format`, the three exit codes and `--version`, and the commands' registration |
| `src/commands/` | `check`, `init`, `new module`, `packet`, `packets` and the hook entry ([08 Part A](../framework/08-cli-and-nodes.md)) |
| `src/runner/`, `src/cache/`, `src/candidate/` | The DAG plan and runner, the verdict cache and the candidate digest ([08 Part C](../framework/08-cli-and-nodes.md), [D-075](../../decisions.md), [D-076](../../decisions.md)) |
| `src/nodes/` | One adapter per 02 §2 node ([08 Part B](../framework/08-cli-and-nodes.md)); `lint-overlay/` is the ESLint overlay the template's `eslint.config.mjs` imports |
| `src/generator/`, `src/spec/` | The [09 §2](../framework/09-rail.md) renderer and manifest; the spec machine-block parser |
| `src/db/`, `src/model/`, `src/packet/`, `src/vitest/` | Scratch databases and `sql-typed` describe; the model nodes' CLI drivers and evidence; packet rules; the C.5 Vitest reporter |
| `src/schema.ts`, `schema/devai.schema.json`, `schema/use-case.schema.json` | The D-056 projections and their committed output (`pnpm project` rewrites them; the test fails when they differ) |
| `tsconfig.json`, `vitest.config.ts`, `test/` | `tsc -b` build on `@stynx-nyx/tsconfig/node24.json`; Vitest 4.1.11 tests that spawn the built `dist/main.js` ([D-057](../../decisions.md)); the database tests use `DEVAI_TEST_DATABASE_URL` (default `postgresql://localhost:5432/postgres`) and skip, saying why, when it does not answer |

### `packages/cli/template/`

The seed carried the [09 §1.1](../framework/09-rail.md) rows whose bytes the foundation fixed
(12 §2):

| Path | Fixed by |
|---|---|
| `AGENTS.md`, `README.md`, `CLAUDE.md` | [10 §1](../framework/10-agent-surface.md) |
| `.agents/skills/{devai-task,devai-spec,devai-test,devai-review}/SKILL.md` | [10 §2](../framework/10-agent-surface.md) |
| `.claude/skills/<name>`, four symlinks (mode `120000`) to `../../.agents/skills/<name>` | [10 §2](../framework/10-agent-surface.md) |
| `scripts/hooks/pre-commit`, `pre-push`, `commit-msg` (mode `100755`) | [08 A.7](../framework/08-cli-and-nodes.md) |
| `product/demo/README.md`, `product/demo/rules/RN-DEMO-001.md`, `RN-DEMO-002.md`, `product/use-cases/UC-DEMO-001.json`, `specs/notes/SPEC-DEMO-001.md` | [06 §7](../framework/06-spec-format.md) |
| `packets/CMP-DEMO-001/campaign.md`, `PKT-DEMO-001.md` … `PKT-DEMO-004.md` | [05 §7](../framework/05-task-packet.md); `base` is rendered by `init` |
| `database/README.md`, `.stynxrc.json`, `gitignore` (written as `.gitignore` by `init`; npm and pnpm drop `.gitignore` when packing, [D-074](../../decisions.md)), `compose.yaml` | [09 §1.1](../framework/09-rail.md) values |

R6 W7 built the rest of 09 §1.1: the root `package.json` and `pnpm-lock.yaml` at STYNX 3.0.0,
`eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, the `apps/api` and `apps/web`
shells, `database/apply.sh` and `checks.sql`, `test/`, `tools/` and `.github/workflows/devai.yml`.
`devai.json` and the packets' `base` are rendered by `devai init`, not stored
([D-065](../../decisions.md); 12 §2).

## `packages/decorators` → `@devai-nyx/decorators`

| Path | Today |
|---|---|
| `package.json` | Version 3.0.0, `type: module`, Apache-2.0; one peer, `@nestjs/common ^11.1.19` |
| `src/index.ts`, `src/error-contract.ts`, `src/use-case.ts`, `src/slo.ts` | `ErrorContract`, `UseCase` and `Slo`: three `SetMetadata` wrappers, with argument shapes from [06 §2](../framework/06-spec-format.md) |

The decorators are a sibling package, not a CLI subpath: product runtime code imports them, and a
subpath would make every product API install the CLI's TypeScript, `pg` and SQL parser. They import
neither STYNX nor the CLI, and the CLI does not import them; `route-contract` reads their arguments
statically ([02 §1](../framework/02-architecture.md), [08 B.9](../framework/08-cli-and-nodes.md);
12 §1.1). Both packages share one version, so `generatorVersion` also names the decorators a module
was generated against ([09 §2](../framework/09-rail.md)).

## What R6 built

Per 12 §2 and §4, and [D-065](../../decisions.md), in waves W0–W9:

- `src/main.ts` and the CLI per [08](../framework/08-cli-and-nodes.md);
- the generator per [09 §2](../framework/09-rail.md), with the STYNX generator code carried under
  Apache-2.0 after NYXK's relicensing, each file opening with `SPDX-License-Identifier: Apache-2.0`
  and a provenance line citing D-067 ([D-067](../../decisions.md));
- the packages' `tsconfig.json`, extending the published `@stynx-nyx/tsconfig/node24.json`;
- `devai.schema.json` and `use-case.schema.json`, emitted from zod, with the projection test
  ([D-056](../../decisions.md));
- the remaining template files and the template's `package.json` and lock at STYNX 3.0.0.

No v2 code enters the repository at any point (12 §2).

## Commits in this repository

The seed and every later commit so far are authored by `devai-agent <agent@devai.local>` with a
`Co-Authored-By` trailer naming the model, in Conventional Commits form; see
[Contributing](contributing.md).

Source: 02 §1, 05 §7, 06 §2, §7, 07 §1–§2, 08 A.7, A.8, B.9, C.2, 09 §1–§2, 10 §1–§2, decisions D-056, D-063–D-067; 12 §1–§2, §4, §8 (bootstrap history); the repository tree at HEAD.
