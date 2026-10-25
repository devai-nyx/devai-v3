---
title: Runtimes
sidebar_position: 9
description: Running checks bare or in Docker, how the runtime is declared and overridden, and what happens when a service is missing.
---

# Runtimes

Every check, the dev environment, local CI and remote CI must run either bare on your machine or in
Docker. Docker is supported, never mandatory ([S-08](../framework/03-standards.md)). This used to be
practice with no written home; DEVAI states it as a contract agents read
([D-011](../../decisions.md)). The whole contract an agent reads is one line in `AGENTS.md`:

```
Checks run bare by default; `DEVAI_RUNTIME=docker devai check` runs them in Docker. Keep both green.
```

([02 §6](../framework/02-architecture.md), [10 §1](../framework/10-agent-surface.md))

## Declaring the mode

The mode is declared in `devai.json`, checked in, in the `standards` protected class, with no
executable configuration ([D-034](../../decisions.md), [02 §6](../framework/02-architecture.md)):

```json
"runtime": { "mode": "bare",
             "services": { "postgres": { "bare": "env:DATABASE_URL", "docker": "compose:postgres" } } }
```

`devai init --runtime bare|docker` writes it; the default is `bare`
([08 A.1](../framework/08-cli-and-nodes.md)).

For one invocation, override it:

```sh
DEVAI_RUNTIME=docker devai check
```

`bare` and `docker` are the only values. Any other value fails the command with `config-invalid`,
exit 2 ([08 Part A](../framework/08-cli-and-nodes.md)).

## How a check gets PostgreSQL

The runtime is resolved once per command. A node that needs PostgreSQL asks for it
([02 §6](../framework/02-architecture.md), [07 §4](../framework/07-dependencies.md)):

| Mode | Source | Typical remedy when missing |
|---|---|---|
| `bare` | `DATABASE_URL`: an admin URL on the declared server | Start PostgreSQL for the declared runtime; check `DATABASE_URL` and `CREATE DATABASE` privilege |
| `docker` | `docker compose up -d postgres` from the template's `compose.yaml` | Start Docker |

`compose.yaml` has one service, `postgres`, pinned to a PostgreSQL 16 image by digest
([09 §1.1](../framework/09-rail.md)). In both modes the check creates its own scratch database on
that server and drops it afterwards; see [Database and migrations](database-and-migrations.md).

**There is no fallback.** A missing service is `UNKNOWN` with its remedy printed, never a silent
switch to the other mode ([02 §6](../framework/02-architecture.md)). It is never a reason to skip a
node either.

Before the database nodes run, the preflight resolves `sh`, `psql` and, in Docker mode,
`docker compose` and daemon access ([07 §4](../framework/07-dependencies.md),
[08 B.20](../framework/08-cli-and-nodes.md)). Each missing piece has its own reason code:
`shell-missing`, `psql-missing` (install the PostgreSQL 16 client), `docker-unreachable`,
`postgres-unreachable` ([10 §4](../framework/10-agent-surface.md)).

## Tests read the runtime; they never choose it

No test may start testcontainers or Docker on its own ([02 §6](../framework/02-architecture.md)).
The template's `test/support/utils/runtime.ts` reads `DATABASE_URL` and `DEVAI_RUNTIME` and
connects as `_app` or `_reader` ([09 §1.1](../framework/09-rail.md)). The fixture spec says the same
in its Acceptance notes: the runtime resolver supplies PostgreSQL in bare or Docker mode, and no
test chooses Docker ([06 §7](../framework/06-spec-format.md)).

For a test agent this means: get the database through the `@stynx-nyx/testing` helpers, and never
start Docker or testcontainers ([10 §2.3](../framework/10-agent-surface.md)).

## Why both stay green

Results that depend on the database are keyed by the **schema digest** `db-apply` emits, which is
equal in both modes by construction. Bare mode is therefore never penalised by the cache, and the
two modes can be compared ([02 §2](../framework/02-architecture.md),
[08 C.4](../framework/08-cli-and-nodes.md)).

CI runs the declared mode on most PRs. A PR that touches `devai.json`, `compose.yaml`,
`scripts/ci-local/**`, `tools/**` or the generator runs the PostgreSQL-backed nodes in **both**
modes; a weekly run in both modes is the backstop ([D-039](../../decisions.md)). If you only ever run
bare locally, that PR is where a Docker-only failure first shows up, so it pays to run
`DEVAI_RUNTIME=docker devai check` yourself before opening one.

`scripts/ci-local/run.sh` is the template's Docker-mode runner: it brings Compose up, runs
`DEVAI_RUNTIME=docker devai check --full --format json`, and brings Compose down
([09 §1.1](../framework/09-rail.md)).

## What you do not configure

There is no start command in `devai.json` and no implicit mode switch
([10 §4](../framework/10-agent-surface.md), [02 §6](../framework/02-architecture.md)). The
reviewer's counterexample runs use a scratch database created from the same schema digest in the
declared runtime ([D-042](../../decisions.md)).

Source: [02 §2, §6](../framework/02-architecture.md), [03 S-08](../framework/03-standards.md),
[06 §7](../framework/06-spec-format.md), [07 §4](../framework/07-dependencies.md),
[08 A.1, B.20, C.4](../framework/08-cli-and-nodes.md), [09 §1.1](../framework/09-rail.md),
[10 §1, §2.3, §4](../framework/10-agent-surface.md), [D-011, D-034, D-039, D-042](../../decisions.md).
