---
title: Database and migrations
sidebar_position: 8
description: Where SQL lives, how it is applied, why applied migrations never change, and which checks guard the schema.
---

# Database and migrations

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

The backend database is PostgreSQL, and multi-tenancy with row-level security is mandatory
([S-01, S-02](../framework/03-standards.md)). SQL lives in two places: the root `database/` folder
and each module's `db/` folder.

## The root `database/` folder

```
database/
  README.md                               # band table, apply order, role contract
  ddl/NN-<schema>-<topic>.sql             # tens digit = object kind
  migrations/YYYYMMDD_NN_snake_case.sql
  seed/modules.txt                        # root manifest of module SQL
  apply.sh  checks.sql
```

([04 §3](../framework/04-layout.md), [09 §1.1](../framework/09-rail.md))

**DDL bands** ([D-017](../../decisions.md), [D-040](../../decisions.md)):

| Band | Object kind |
|---|---|
| `00–08` | Tables by schema |
| `11–14` | Functions |
| `21–24` | RLS |
| `80–89` | Views and materialized views |
| `90` | Assertions |
| `91–94` | Comments |
| `98` | Seed |

`layout` checks the band digits and the migration name form ([08 B.6](../framework/08-cli-and-nodes.md)).

## Module SQL

Each module's SQL is `domain/<m>/db/<ns>_<slug>.sql`, applied through the root manifest
`database/seed/modules.txt` ([D-023](../../decisions.md)). The manifest has one line per module SQL
file in apply order, in `sha256sum` form (`<sha256>  <path>`). The generator appends lines and never
edits them ([09 §1](../framework/09-rail.md)). For the demo:

```
<sha256>  domain/notes/db/demo_notes_notes.sql
```

The generated module file keeps a table and its `ENABLE`/`FORCE ROW LEVEL SECURITY` and policies
together, in the same file; do not split them across bands
([06 §5](../framework/06-spec-format.md)).

## Apply order

`database/apply.sh` is POSIX `sh` and applies, in order ([09 §1](../framework/09-rail.md)):

1. `database/ddl/*.sql`
2. the installed `@stynx-nyx/data` platform migrations, through
   `stynx migrate up --role-prefix <productPrefix>`
3. each path in `database/seed/modules.txt`
4. `database/migrations/*.sql`
5. `database/seed/*.sql`

Module baselines therefore come before any root migration that alters them. No connection string
goes on the command line; `psql` and `stynx migrate` read the `PG*` variables, so the trace never
prints credentials.

**Roles.** Each product has three: `<product>_owner` (bypasses RLS, migrations only), `<product>_app`
and `<product>_reader`. App code never connects as owner, and isolation tests never run as owner
([S-18](../framework/03-standards.md)). `00-core-bootstrap.sql` creates only those three. STYNX's
platform migrations name `stynx_*` roles in their bytes; the STYNX migration runner substitutes the
prefix at apply time, so the bytes stay unchanged ([D-070](../../decisions.md)).

## Applied migrations never change

**A schema change is a new migration**, never a rewrite of a file that is already applied
([D-033](../../decisions.md)).

- A module's initial `db/*.sql` is a `@generated` file only until it is present at the merge base.
  From then on it is immutable: `--regenerate` never rewrites it, and the `generated` node no longer
  replays it ([09 §3](../framework/09-rail.md)).
- `sql-lint` rule LINT013 fails any byte change to a SQL file that was present at base
  ([D-043](../../decisions.md)).
- A module migration after the baseline is named `<ns>_<slug>_<nn>_<topic>.sql` in the module's
  `db/` folder ([04 §2](../framework/04-layout.md)) and is appended to `database/seed/modules.txt`
  ([09 §3](../framework/09-rail.md)).

When a successor spec adds a column and you regenerate inside a `generate` packet, the generator
prints:

```
write domain/<slug>/db/<ns>_<slug>_<nn>_<topic>.sql by hand and append it to database/seed/modules.txt
```

and `sql-typed` against the database fails until that migration exists
([09 §3](../framework/09-rail.md)).

New migrations under `domain/<m>/db/` are a `code` packet deliverable
([05 §3](../framework/05-task-packet.md)). The `code` default globs include `domain/<slug>/db/**`
but not `database/seed/**` ([08 A.4](../framework/08-cli-and-nodes.md)); widening `paths.allowed`
is an amendment the agent may make itself ([05 §2](../framework/05-task-packet.md)).

## The checks that guard SQL

| Node | What it checks |
|---|---|
| `sql-lint` | STYNX's LINT001–009 (including RLS and policy in the same migration, LINT001) plus LINT010 duplicate prefix across all migrations, LINT011 policies reference only `app.*` settings, LINT012 the `-- @pii` annotation when `lgpd: true`, LINT013 base-present files unchanged ([02 §2](../framework/02-architecture.md)) |
| `db-apply` | Applies everything from an empty scratch database, runs `checks.sql` (every table has forced RLS; `_app`/`_reader` do not bypass RLS; policies read only `app.*`) and the RLS-negative check, then emits the schema digest ([08 B.20](../framework/08-cli-and-nodes.md)) |
| `sql-typed` | Every `defineQuery`: static text, `$n` count, unique names, and against the applied schema the parameter types, result columns and limits ([02 §3](../framework/02-architecture.md)) |
| `integration` | The template's RLS isolation test, observed as `<product>_app` ([08 B.22](../framework/08-cli-and-nodes.md)) |

LINT010 counts a prefix collision only when it involves a file absent from the merge base, so
applied history with existing duplicates stays green ([D-069](../../decisions.md)).

The request context lives in one settings namespace: `app.tenant_id`, `app.actor_id`, `app.role`,
`app.request_id`, `app.session_id`, and RLS policies reference only it
([S-17](../framework/03-standards.md)). Tenant ids come from the transaction's verified context,
never from query arguments ([02 §3](../framework/02-architecture.md)).

## Scratch databases

`db-apply` works in a scratch database. It creates `devai_<digest12>` on the declared server,
applies everything into it, and drops it after its last consumer under `--full`; in the edit loop it
keeps it for reuse, and `devai check --prune` drops it later. On a name collision it reports
`UNKNOWN: scratch-collision` and never drops a database it did not create
([08 B.20](../framework/08-cli-and-nodes.md)). In bare mode the `DATABASE_URL` user needs
`CREATE DATABASE` privilege; see [Runtimes](runtimes.md).

## Protected paths

`database/ddl/**` and `database/migrations/**` are in the `infra` protected class; touching them
labels the PR `protected:infra` ([D-046](../../decisions.md), [02 §5](../framework/02-architecture.md)).
A schema change is made visible by the migration linter report, not by a separate label
([D-046](../../decisions.md)).

Source: [02 §2, §3, §5](../framework/02-architecture.md), [03](../framework/03-standards.md),
[04 §2–§3](../framework/04-layout.md), [05 §2–§3](../framework/05-task-packet.md),
[06 §5](../framework/06-spec-format.md), [08 A.4, B.6, B.20, B.22](../framework/08-cli-and-nodes.md),
[09 §1, §3](../framework/09-rail.md), [D-017, D-023, D-033, D-040, D-043, D-046, D-069, D-070](../../decisions.md).
