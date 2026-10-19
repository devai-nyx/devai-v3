# Agent guide

This repository builds `@devai-nyx/cli` and `@devai-nyx/decorators` (pnpm workspace,
`packages/*`).

## Where the law is
- `decisions.md`: binding decisions, D-001 onward.
- `docs/framework/`: law and spec, `00-intent.md` through `10-agent-surface.md`.

## Build
`pnpm install --frozen-lockfile && pnpm -r --if-present build && pnpm -r --if-present test`
(the CI `build` job). Node `>=24 <25`; pnpm 9.15.0 through Corepack (`packageManager`).

## Conventions
- Tag claims `[fact]` (cited source), `[inference]` (consequence) or `[opinion]` (choice).
- Cite `file:line` for every fact; framework documents as `NN §n`, decisions as `D-nnn`.
