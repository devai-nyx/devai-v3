---
title: Quickstart
sidebar_position: 3
description: Scaffold a repository with devai init, then take the shipped demo campaign through its first packet with devai check.
---

# Quickstart

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

This walk-through scaffolds a fresh repository and takes its shipped example campaign, `CMP-DEMO-001`,
through the first packet that does real work. It follows the same steps the generator's own release
matrix runs ([09 §4](../framework/09-rail.md)). How to obtain the CLI and the registry token is on
[Install](../adopters/install.md).

## Before you begin

- Node 24 and pnpm 9.15.0 through Corepack; DEVAI pins them with `engines` and `packageManager`
  ([07 §1](../framework/07-dependencies.md)).
- git.
- PostgreSQL 16, either running locally (bare mode, reached through `DATABASE_URL`) or through Docker
  with the template's `compose.yaml` ([02 §6](../framework/02-architecture.md), [09 §1.1](../framework/09-rail.md)).
- The `claude` and `codex` CLIs, authenticated, for full acceptance: the reviewer and the permissions
  sensor run on your machine, never in CI ([D-037](../../decisions.md), [08 B.24, B.27](../framework/08-cli-and-nodes.md)).

If something is missing, DEVAI does not stop to ask. It reports `UNKNOWN: tooling-missing` for the
affected node with the install command, and exits 2 ([08 §0, A.1](../framework/08-cli-and-nodes.md),
[D-029](../../decisions.md)).

## 1. Scaffold

```sh
devai init --product demo --lgpd --dir notes-demo
```

`--dir` must be empty or absent. In this *materialise* mode `init` writes the template, runs `git init`
if needed, commits it as `chore(template): devai init demo` with the trailer `Packet: PKT-DEMO-001`,
then renders the four demo packets with `base` set to that commit and commits them as
`chore(packets): seed CMP-DEMO-001` ([08 A.1](../framework/08-cli-and-nodes.md), [09 §1](../framework/09-rail.md)).
It also sets `core.hooksPath scripts/hooks` and the agent identity `demo-agent` /
`agent@demo.local` in the worktree's git config ([08 A.1](../framework/08-cli-and-nodes.md),
[02 §5](../framework/02-architecture.md)). The last step is a tooling preflight.

The options match the configuration the shipped fixture assumes: product prefix `demo`, LGPD
declarations on, locale `en-US` ([06 §7](../framework/06-spec-format.md)). `--locales` defaults to
`en-US` and `--runtime` to `bare` ([08 A.1](../framework/08-cli-and-nodes.md)).

Then install:

```sh
cd notes-demo
corepack enable && pnpm install
```

## 2. Look around

The template ships a fictional product and one campaign ([05 §7](../framework/05-task-packet.md),
[06 §7](../framework/06-spec-format.md)):

| Path | What it is |
|---|---|
| `product/demo/`, `product/use-cases/UC-DEMO-001.json` | Business rules and a use case (the pilot's) |
| `specs/notes/SPEC-DEMO-001.md` | The approved technical spec: two routes, one table |
| `packets/CMP-DEMO-001/PKT-DEMO-001…004.md` | `spec` (already complete), `generate`, `test`, `code` |
| `AGENTS.md`, `.agents/skills/` | What your coding agent reads ([10](../framework/10-agent-surface.md)) |
| `devai.json` | Configuration, validated against its schema ([08 A.8](../framework/08-cli-and-nodes.md)) |

`pnpm exec devai packets status` prints each packet's state as derived from git; packets carry no
status field ([08 A.5](../framework/08-cli-and-nodes.md), [05 §4](../framework/05-task-packet.md)).

`pnpm exec devai check` with no flags runs the edit-loop subset over the current change
([02 §2](../framework/02-architecture.md), [08 A.3](../framework/08-cli-and-nodes.md)). Your agent runs it
after every edit.

## 3. Ask for acceptance before the work exists

```sh
pnpm exec devai check --packet packets/CMP-DEMO-001/PKT-DEMO-002.md --full
```

On a fresh template this exits 1 with
`required node skipped for kind: generate: generated (inventory: no generation-manifest.json under domain/)`.
That is the correct reading: a `generate` packet whose module does not exist yet has not delivered
([05 §3, §7](../framework/05-task-packet.md), [09 §1](../framework/09-rail.md)). PKT-DEMO-003 and
PKT-DEMO-004 likewise report their `after:` packets as unmet ([05 §7](../framework/05-task-packet.md)).

## 4. Work the generate packet

In practice you hand the packet to Claude Code or Codex, which follows the `devai-task` skill
([10 §2.1](../framework/10-agent-surface.md)). The steps it takes:

```sh
pnpm exec devai new module --spec specs/notes/SPEC-DEMO-001.md
```

The generator writes `domain/notes/` (generated files with a `@generated` header, seed files without),
`generation-manifest.json` and one line in `database/seed/modules.txt`. It does not edit the app shell;
it prints the mount lines to apply by hand: add `"@demo/notes-api": "workspace:*"` to
`apps/api/package.json` and `DemoNotesModule` to the `imports` of `apps/api/src/app.module.ts`, then
`pnpm install` ([09 §2, §6](../framework/09-rail.md)).

Then the loop: `devai check --packet <packet>` while editing, `devai check --packet <packet> --full`
when the subset is green, and a commit carrying `Packet: PKT-DEMO-002` as a trailer
([05 §6](../framework/05-task-packet.md), [09 §4](../framework/09-rail.md)). Nodes that need PostgreSQL
use the declared runtime; `DEVAI_RUNTIME=docker` overrides it for one invocation, and a database that
cannot be reached is `UNKNOWN` with its start command, never a silent switch to the other mode
([02 §6](../framework/02-architecture.md)).

Let an agent make the commits. The reviewer and the permissions sensor are chosen as the *other*
model family, read from the `Co-Authored-By` trailers of the candidate's commits. For the reviewer an
equal, unknown or mixed family is `UNKNOWN (family)`; the sensor, with no agent trailer, runs the first
configured reviewer ([D-074](../../decisions.md)) ([02 §9](../framework/02-architecture.md), [08 A.8, B.24, B.27](../framework/08-cli-and-nodes.md)).

## 5. Read the exit code

| Exit | Meaning | What to do |
|---|---|---|
| `0` | No gating `FAIL` or `UNKNOWN`; on `--packet … --full` this is acceptance (`accepted: true`) | Push; open the PR |
| `1` | At least one `FAIL` | Fix each finding line: locator, standard id, hint |
| `2` | At least one `UNKNOWN` and no `FAIL`, or the command could not run | Do the remedy the line prints; never disable a node, there is no switch |

([02 §8](../framework/02-architecture.md), [08 A.3](../framework/08-cli-and-nodes.md))

While `review.mustRun` is `false` — the template default for the first campaign — the reviewer's
verdict is recorded and tallied but does not set the exit code, except on a PR that touches a
protected class the packet did not declare ([D-028](../../decisions.md), [02 §5, §9](../framework/02-architecture.md)).

## 6. What comes next

The rest of the campaign follows the same rule ([09 §4](../framework/09-rail.md)):

1. Advance PKT-DEMO-003's `base` past the generate commit with `devai packet rebase <packet> --to <commit>`
   ([05 §4](../framework/05-task-packet.md)).
2. PKT-DEMO-003 (`test`) derives six acceptance cases from the spec before the implementation exists;
   R-1, R-2 and R-4 must be red at their assertions, the other three green
   ([05 §3](../framework/05-task-packet.md)). See [Deriving tests](../guides/deriving-tests.md).
3. PKT-DEMO-004 (`code`) implements the service and repository bodies; every case must pass
   ([D-051](../../decisions.md)). See [Implementing](../guides/implementing.md).

Source: [02](../framework/02-architecture.md), [05](../framework/05-task-packet.md), [06](../framework/06-spec-format.md),
[07](../framework/07-dependencies.md), [08](../framework/08-cli-and-nodes.md), [09](../framework/09-rail.md),
[10](../framework/10-agent-surface.md), [decisions.md](../../decisions.md).
