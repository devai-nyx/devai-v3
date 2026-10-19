# Agent guide

NestJS / Angular / PostgreSQL monorepo on the DEVAI v3 rail. `devai check` says whether
a change is inside the standards and meets its spec; its findings carry the rules.

## Commands
- `devai` below means `pnpm exec devai`.
- `devai check` — edit loop over the current change; run it after every edit.
- `devai check --packet <packet>` — adds packet scope and the packet's acceptance tests.
- `devai check --packet <packet> --full` — the only acceptance; exit 0 accepts.
  Acceptance is not merge: merging is the pilot's or branch protection's.
- `pnpm test` · `devai check --only <node>` (one node and its prerequisites) — feedback,
  never acceptance.
- `devai new module --spec <spec>` · `devai packet new --kind <kind> --spec <spec>` ·
  `devai packets status`.

Exit 1: fix each FAIL line (locator, standard, hint). Exit 2: something could not be
observed; do the remedy the line prints. No flag, packet field or waiver disables a
node, and nothing here needs the pilot's permission. `devai check` writes `.devai/`;
never hand-edit anything under it.

## Runtime
Checks run bare by default; `DEVAI_RUNTIME=docker devai check` runs them in Docker. Keep both green.

## Where things go
- `product/` business rules (the pilot's) → `specs/` technical specs → `packets/` tasks.
- Module `domain/<m>/`: `api/src/` flat role-suffixed files (only `dto/`, `adapter/`
  below it), `db/` SQL, tests under `api/test/`, never beside the source.
- A `@generated` file is regenerated (`devai new module --regenerate`), never edited;
  logic goes in seed files.
- A schema change is a new migration; a SQL file present at the packet's base never changes.

## Tests
A red acceptance test you did not write is a result, not an obstacle.
`api/test/acceptance/` changes only in a `test` packet.

## Protected paths
The classes in `devai.json` `protected` label the PR; they are never refused.

## Hooks
`scripts/hooks/` run `devai check --hook …`; CI runs the same nodes, so `--no-verify`
saves nothing.
