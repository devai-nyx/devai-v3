# database

## DDL bands (tens digit = object kind; D-017)

| Band | Kind |
|---|---|
| `00–08` | tables, by schema |
| `11–14` | functions |
| `21–24` | RLS |
| `80–89` | views and materialized views |
| `90` | assertions |
| `91–94` | comments |
| `98` | seed |

Files: `ddl/NN-<schema>-<topic>.sql`, `migrations/YYYYMMDD_NN_snake_case.sql`. Module SQL is
`domain/<m>/db/<ns>_<slug>.sql`, listed in `seed/modules.txt` (`<sha256>  <path>`, apply order).

## Apply order

`apply.sh` (POSIX `sh`) runs `$PSQL -f` over, in order:
1. `ddl/*.sql`
2. the installed `@stynx-nyx/data` platform migrations
3. each path in `seed/modules.txt`
4. `migrations/*.sql`
5. `seed/*.sql`

`psql` reads the `PG*` environment; no connection string goes on argv.

## Role contract

`ddl/00-core-bootstrap.sql` creates only `<product>_owner`, `<product>_app` and
`<product>_reader` (S-18). `_app` and `_reader` are `NOBYPASSRLS`; every non-system table has
row-level security enabled and forced, and policy predicates read only `app.*` (S-17).
Isolation is observed as `<product>_app`, never as owner.
