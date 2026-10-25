#!/bin/sh
# Docker-mode runner (D-039): the compose service up, every applicable node in docker mode, then down.
# Docker is required; POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB come from the environment.
set -eu
command -v docker >/dev/null 2>&1 || { echo 'run.sh: docker is required' >&2; exit 2; }
docker compose up --detach --wait postgres
status=0
DEVAI_RUNTIME=docker pnpm exec devai check --full --format json || status=$?
docker compose down
exit "$status"
