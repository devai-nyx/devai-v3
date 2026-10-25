---
title: Install
sidebar_position: 2
description: Prerequisites, devai init in materialise and attach mode, and the pins a DEVAI 3.0.0 repository runs on.
---

# Install

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

A DEVAI 3 product repository is created once by `devai init` and then lives on its own. There is no
installer beyond that command and no interactive setup: every input is a flag, and every missing
tool is a printed line with its install command ([08 A.1](../framework/08-cli-and-nodes.md)).

## Prerequisites

| Need | Why | If it is missing |
|---|---|---|
| Node `>=24 <25` | `engines.node` of every package ([07 §1](../framework/07-dependencies.md)) | `inventory` is `UNKNOWN: engines-mismatch` ([08 B.1](../framework/08-cli-and-nodes.md)) |
| Corepack, selecting `pnpm@9.15.0` from `packageManager` | S-07; the pin is `engines` plus `packageManager`, no pin file ([D-057](../../decisions.md)) | `UNKNOWN: engines-mismatch`, remedy `corepack use <packageManager>` |
| git and a POSIX `sh` | snapshots, diffs, hooks; `database/apply.sh` is POSIX `sh` ([07 §2, §4](../framework/07-dependencies.md), [09 §1](../framework/09-rail.md)) | `db-apply` is `UNKNOWN: shell-missing` |
| PostgreSQL 16 for the declared runtime, plus the `psql` client | `needs: postgres` nodes create a scratch database on it ([02 §6](../framework/02-architecture.md), [08 B.20](../framework/08-cli-and-nodes.md)) | `UNKNOWN: postgres-unreachable` or `psql-missing` |
| Docker with Compose, in docker mode only | `docker compose up -d postgres` from the template's `compose.yaml` | `UNKNOWN: docker-unreachable` |
| A token for GitHub Packages in `NODE_AUTH_TOKEN` | the template `.npmrc` points `@devai-nyx` and `@stynx-nyx` at `npm.pkg.github.com` and reads `${NODE_AUTH_TOKEN}` ([09 §1.1](../framework/09-rail.md)) | install fails |
| The published STYNX tooling (`@stynx-nyx/eslint-config`, `tsconfig`, `migration-linter`, `cli`) | DEVAI invokes it and never vendors it (S-19, [D-029](../../decisions.md)) | dependent nodes are `UNKNOWN: tooling-missing` with the install command |
| `claude` and `codex` CLIs, logged in, on the pilot's machine | the reviewer and the `permissions-pattern` sensor run there, never in CI ([D-037](../../decisions.md), [07 §6](../framework/07-dependencies.md)) | `review` / sensor `UNKNOWN` (`model-error`, `capability-missing`) |
| Playwright browsers | `e2e` needs them provisioned beforehand ([08 B.23](../framework/08-cli-and-nodes.md)) | `UNKNOWN: browsers-missing`, remedy `pnpm exec playwright install` |

In bare mode the database URL is an admin URL on the declared server: `db-apply` runs
`CREATE DATABASE` for each scratch database and reports a missing privilege as
`postgres-unreachable` ([08 B.20](../framework/08-cli-and-nodes.md)).

## Create a repository (materialise mode)

Run the CLI from the registry into an empty directory (12 §6, bootstrap history):

```sh
pnpm dlx @devai-nyx/cli@3.0.0 init --product <prefix> --dir <empty-dir>
```

The flags are exactly these ([08 A.1](../framework/08-cli-and-nodes.md)):

| Flag | Default | Rule |
|---|---|---|
| `--product <slug>` | — | Required here; `^[a-z][a-z0-9]*$`; becomes `productPrefix` ([D-032](../../decisions.md)) |
| `--locales <tag,…>` | `en-US` | Must start with `en-US`; pt-BR is opted in here ([D-014](../../decisions.md)) |
| `--lgpd` | off | Opts in LGPD legal-basis and retention annotations (S-15, D-014) |
| `--runtime bare\|docker` | `bare` | Written to `runtime.mode` ([D-034](../../decisions.md)) |
| `--dir <path>` | `.` | Must be empty or absent |
| `--format text\|json` | `text` | Output form |

There is no `--web` on `init`: both the API and the web shell ship from day one
([09 §0, §1](../framework/09-rail.md)).

`init` validates every input before writing anything, then
([09 §1](../framework/09-rail.md), [08 A.1](../framework/08-cli-and-nodes.md)):

1. writes the template tree of 09 §1.1, running `git init` if needed;
2. runs `pnpm add -w -D --save-exact @devai-nyx/cli@<its own version>`, which installs the workspace
   and completes `pnpm-lock.yaml` ([D-097](../../decisions.md));
3. commits the tree as `chore(template): devai init <product>` with the trailer
   `Packet: PKT-DEMO-001`, with the hooks live;
4. renders the four `CMP-DEMO-001` packets with `base` set to the template commit and commits them
   as `chore(packets): seed CMP-DEMO-001` with the trailer `Packet: CMP-DEMO-001`
   ([D-120](../../decisions.md)); each later packet is rebased onto `HEAD` before its first
   run ([D-095](../../decisions.md));
5. sets, in the current worktree's git config, `core.hooksPath scripts/hooks`,
   `user.name <product>-agent` and `user.email agent@<product>.local`
   ([02 §5](../framework/02-architecture.md));
6. runs the preflight and prints one `UNKNOWN: tooling-missing — <node>: install with <command>`
   line per missing tool.

Exit `0` means everything was written and every tool resolved. Exit `2` means either the files were
written but at least one tool is missing or the install failed (`tooling-missing`, with the
`pnpm add` command as the remedy), or nothing was written because of
`dir-not-empty` or `usage`. `init` never exits `1`.

The repository then contains a fictional `demo` product: business rules under `product/`, the
approved spec `specs/notes/SPEC-DEMO-001.md`, and a four-packet campaign (spec, generate, test,
code) you can run end to end ([09 §1](../framework/09-rail.md), [05 §7](../framework/05-task-packet.md)).
The [quickstart](../start/quickstart.md) walks through it.

## Join an existing repository (attach mode)

On a fresh clone, where `devai.json` already exists and history has both `init` commits, install dependencies (the template README's
install line, [10 §1](../framework/10-agent-surface.md)) and run `init` without `--product`
(passing it is rejected in this mode):

```sh
corepack enable && pnpm install
pnpm exec devai init
```

Attach mode writes only the three hook scripts and sets the same three git config values; it needs
a git repository (`not-a-repository` otherwise) and a valid `devai.json` (`config-invalid`
otherwise) ([08 A.1](../framework/08-cli-and-nodes.md), [09 §1](../framework/09-rail.md)). Do this
in every clone and worktree: the hook path and the agent identity are written to the current
worktree's config, and there is no husky ([08 A.1](../framework/08-cli-and-nodes.md),
[D-057](../../decisions.md)).

A repository with `devai.json` but without both `init` commits (its `HEAD` unborn after a failed
install, or a commit the hooks refused) is not attached: running `init` again there is a first run
([D-112](../../decisions.md), [D-115](../../decisions.md)). It keeps the files on disk, re-runs the
`pnpm add` and makes whichever `init` commit is missing; pass `--product`, `--locales`, `--lgpd` and
`--runtime` only with their recorded values, or omit them (a different one is exit 2
`config-mismatch`, [D-113](../../decisions.md), [D-116](../../decisions.md)).

## The 3.0.0 pins

Exact versions belong to the release plan, not to a pin file (D-057; 12 §3, bootstrap history):

| Item | 3.0.0 value | Where it is written |
|---|---|---|
| Node | 24.20.0 within `>=24 <25` | `setup-node` in the template `devai.yml` |
| pnpm | 9.15.0 through Corepack | `packageManager` |
| PostgreSQL | 16.15, `postgres:16-alpine@sha256:7218…80ea` | template `compose.yaml` ([09 §1.1](../framework/09-rail.md)) |
| `@devai-nyx/cli`, `@devai-nyx/decorators` | 3.0.0, exact | root `devDependencies`; module `api/package.json` |
| `@stynx-nyx/*` | one fixed-group version, exact, never a range or `workspace:*` | template `package.json` |
| `claude` / `codex` | 2.1.292 / 0.163.0 tested | none; other versions are not refused, the capability check decides ([08 B.24, B.27](../framework/08-cli-and-nodes.md)) |

The DEVAI packages must be exact because `generated` requires the installed CLI to equal the
`generatorVersion` each module recorded ([09 §3](../framework/09-rail.md)); see
[Upgrading](upgrading.md).

Source: 02 §5–§6, 07 §1–§6, 08 A.1, B.1, B.20, B.23, 09 §1, §3, decisions D-014, D-029, D-032, D-034, D-037, D-057; 12 §3, §6 (bootstrap history).
