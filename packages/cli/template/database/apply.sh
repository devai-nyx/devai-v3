#!/bin/sh
# 09 §1: apply the database in order. psql and stynx read the PG* variables; no URL goes on argv (E-5-08).
set -eu
PSQL=${PSQL:-psql -v ON_ERROR_STOP=1}
for f in database/ddl/*.sql; do [ -e "$f" ] || continue; $PSQL -f "$f"; done
node_modules/.bin/stynx migrate up --role-prefix __PRODUCT__
while read -r sum path; do [ -n "$path" ] || continue; $PSQL -f "$path"; done < database/seed/modules.txt
for f in database/migrations/*.sql; do [ -e "$f" ] || continue; $PSQL -f "$f"; done
for f in database/seed/*.sql; do [ -e "$f" ] || continue; $PSQL -f "$f"; done
