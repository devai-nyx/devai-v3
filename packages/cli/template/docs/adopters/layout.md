# Layout and runtime contract

This repository follows the DEVAI v3 layout (04); `devai check --only layout` enforces it.

## Root

- Guides: `README.md`, `AGENTS.md`, `CLAUDE.md` (a pointer) and `decisions.md`; nothing else at the root is Markdown.
- `product/` business rules and use cases, `specs/<area>-<capability>/` technical specs, `packets/<CMP>/` task packets.
- `apps/<role>/` app shells (`api`, `web`), `domain/<module>/` business modules, `database/`, `test/`, `scripts/`, `tools/`, `docs/`.
- `pnpm-workspace.yaml` names real packages only: `apps/*`, `domain/*/api`, `domain/*/web`.

## Module (`domain/<module>/`)

- `api/src/` is flat and role-suffixed (`<slug>.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `index.ts`); only `dto/` and `adapter/` are folders below it.
- `web/src/` is flat and mirrors `api/src/`.
- `db/<ns>_<slug>.sql`, listed in `database/seed/modules.txt`; a SQL file present at a packet's base never changes.
- Unit tests in `api/test/` and `web/test/`, acceptance tests in `api/test/acceptance/<spec-id>.acceptance.spec.ts`.

## Database (`database/`)

- `ddl/NN-<schema>-<topic>.sql` by band: `00–08` tables, `11–14` functions, `21–24` RLS, `80–89` views, `90` assertions, `91–94` comments, `98` seed.
- `migrations/YYYYMMDD_NN_snake_case.sql`; `apply.sh` applies `ddl/`, the STYNX platform migrations, `seed/modules.txt`, `migrations/`, `seed/*.sql` in that order; `checks.sql` asserts row-level security.

## Tests

| Tier        | Location                                         | Suffix                  | `TEST_TIER`   |
| ----------- | ------------------------------------------------ | ----------------------- | ------------- |
| Unit        | `domain/<m>/{api,web}/test/`, `apps/<app>/test/` | `*.spec.ts`             | `unit`        |
| Acceptance  | `domain/<m>/api/test/acceptance/`                | `*.acceptance.spec.ts`  | `acceptance`  |
| Integration | `test/integration/`                              | `*.integration.spec.ts` | `integration` |
| DB          | `test/db/`                                       | `*.db.spec.ts`          | `db`          |
| E2E         | `test/e2e/`                                      | `*.playwright.ts`       | Playwright    |

`test/` is singular everywhere; the tier is in the file name; every tier glob matches a file.

## Runtime

`devai.json` `runtime.mode` declares `bare` (a PostgreSQL 16 reachable at `DATABASE_URL`) or `docker`
(`compose.yaml`'s `postgres` service). `DEVAI_RUNTIME=bare|docker` overrides it for one run; both modes
stay green. `devai check` creates a scratch database per run and hands DB-backed tests its URL.
