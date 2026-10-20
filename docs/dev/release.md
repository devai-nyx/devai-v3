---
title: Release
sidebar_position: 4
description: The ordered release prerequisites R0 to R10, the tag-triggered publish job, and the host-ceremony steps.
---

# Release

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

DEVAI 3.0.0 is released by a one-time plan, the succession plan (bootstrap document 12). It adds no
node, state, command or field (12 §0). Every step is decided by a check, a read-back, an
`npm view` or an exit code; none needs a human to read a diff ([D-003](../../decisions.md); 12 §5).

## Release prerequisites

From 12 §4. Each row blocks 3.0.0 except R10, which *is* the release.

| # | Prerequisite | Who |
|---|---|---|
| R0 | Ledger batches ruled; foundation edits applied; fixture decomposition applied; NYXK relicensing act done; 11 final | Owner |
| R1 | Host steps H1–H4; seed pushed | Owner, agent |
| R2 | The [08 B.10](../framework/08-cli-and-nodes.md) four-case `sql-typed` prototype on PostgreSQL 16.15 + `pg` 8.23.1, bare and docker. Runs first: it needs no STYNX | agent |
| R3 | STYNX wave 1 (SM-01, 02, 03, 04, 06) built and callable | STYNX |
| R4 | STYNX wave 2, the template-gating items | STYNX |
| R5 | STYNX publishes `<v>`; the R3–R4 acceptance commands are rerun against it | STYNX, agent |
| R6 | CLI per [08](../framework/08-cli-and-nodes.md), decorators, template per [09 §1.1](../framework/09-rail.md), generator per [09 §2](../framework/09-rail.md); tsconfigs, schema projections and the projection test; template `package.json` and lock at `<v>` | agent |
| R7 | Release host: `psql` 16.15 on PATH; `claude` 2.1.292 and `codex` 0.163.0 authenticated; Docker | Owner |
| R8 | [09 §4](../framework/09-rail.md) matrix O1–O16 and N1–N12 green in CI, with sensor evidence committed; the model calibration table filled | agent |
| R9 | H5: `matrix` becomes a required check | Owner |
| R10 | H6: tag and publish; `npm view @devai-nyx/{cli,decorators}@3.0.0 version` prints `3.0.0` twice; `pnpm dlx @devai-nyx/cli@3.0.0 init --product demo` in an empty directory exits 0 | agent |

The critical path is STYNX SM-01 → SM-07 → SM-18 → R5 → the R6 lock → R8; the rest runs alongside
R3–R4 (12 §4).

**Where things stand.** `decisions.md` records the seed (D-065, D-067), R2 passed
([D-068](../../decisions.md)), and rulings taken while landing STYNX wave 1
([D-069](../../decisions.md), [D-070](../../decisions.md)).

**Not blocking 3.0.0** (12 §4): the D-047 edit-loop p95 measurement (3.0.0 ships 90000); the first
DETRAN campaign that settles D-026; each adopter's own `review.mustRun` flip (D-028); the open items
D-004 and 02 §3 step 3; STYNX-only items SM-05, 09, 11, 12; SLO measurement, which is each product's
release lane ([D-038](../../decisions.md)).

## The `publish` job

`ci.yml` has three jobs: `build`, `matrix` and `publish` (12 §5, [D-064](../../decisions.md)).
`publish`:

- runs only on a `v*` tag, with `needs: [build, matrix]`;
- first checks that the tagged commit is on `main`
  (`git merge-base --is-ancestor $GITHUB_SHA origin/main`);
- has `permissions: packages: write` and publishes with `pnpm -r publish`, authenticated by the
  workflow's `GITHUB_TOKEN`. There is no publish PAT.

The matrix job refuses tags until R8 fills it, so a tag cannot publish early (see
[Building and testing](building-and-testing.md)).

There are no Changesets in this repository: two packages, one literal version, and no node reads a
changeset here ([D-065](../../decisions.md)). There are no signed tags, provenance or attestations
([D-002](../../decisions.md); 12 §8).

## Host ceremony

The H-steps are the one-time GitHub actions around the release (12 §5):

| Step | Who | What |
|---|---|---|
| H1 | Owner | Create the empty public repository `devai-nyx/devai-v3` |
| H2 | agent, with the Owner's credential | Commit the seed as `devai-agent <agent@devai.local>` and push `main` |
| H3 | Owner | Protect `main`: required check `build`, strict, enforced for admins, **no required reviews** ([D-003](../../decisions.md)), no force pushes or deletions; read back `[["build"],true]` |
| H4 | Owner | Package settings: connect `@devai-nyx/cli` to the repository with Actions write access; give the repository read access to the installed `@stynx-nyx/*` packages, or set a `STYNX_READ_TOKEN` secret if cross-org access is not possible |
| H5 | Owner | Protection with checks `build` and `matrix`, read back |
| H6 | agent | `git tag -a v3.0.0 -m "DEVAI 3.0.0" <green main sha>` and push the tag; `publish` runs |
| H7 | Owner, then agent | After R10, archive the v2 repository `aarusso-nyx/devai`; read back `archived: true` |
| H8 | Owner | After R10, make `@devai-nyx/cli` and `@devai-nyx/decorators` public; read back `public`. This is irreversible and also exposes the CLI's existing 0.1.0–0.8.0 ([D-064](../../decisions.md)) |

Each Owner step ends with a read-back command, so the step is observed rather than trusted (12 §5).

## Recorded at release

R8 fills one table once: for `permissions-pattern` and `review`, per CLI, the reported model, the
prompt's UTF-8 bytes, the `ceil(bytes / 3.5)` proxy and the CLI-reported input tokens. This is
D-058's first-call calibration. It is recorded, not separately gated: a proxy that under-estimates
shows up inside the matrix as `input-bound-exceeded` ([D-058](../../decisions.md); 12 §3.1, §4).

## After 3.0.0

Adopters move by fresh scaffold; see [Moving from v2](../adopters/moving-from-v2.md). A later
release would follow the same jobs: green `build` and `matrix` on `main`, then a `v*` tag. The law
does not define a policy for 3.x releases beyond these jobs.

Source: 08 B.10, 09 §1.1, §2, §4, decisions D-002, D-003, D-026, D-028, D-038, D-047, D-058, D-064, D-065, D-067–D-070; 12 §0, §3–§5, §8 (bootstrap history).
