---
title: Release
sidebar_position: 4
description: The ordered release prerequisites R0 to R10, the tag-triggered publish job, and the host-ceremony steps.
---

# Release

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
| R8 | [09 §4](../framework/09-rail.md) matrix O1–O16 and N1–N20 green in CI ([D-130](../../decisions.md)); R8 closes on a green `matrix` in both runtimes with its Open list ruled. Sensor evidence and the model calibration table are pending S10 #4 and D-124, re-checked at R9 ([D-134](../../decisions.md)) | agent |
| R9 | H5: `matrix` becomes a required check | Owner |
| R10 | H6: tag and publish; `npm view @devai-nyx/{cli,decorators}@3.0.0 version` prints `3.0.0` twice; `pnpm dlx @devai-nyx/cli@3.0.0 init --product demo` in an empty directory exits 0 | agent |

The critical path is STYNX SM-01 → SM-07 → SM-18 → R5 → the R6 lock → R8; the rest runs alongside
R3–R4 (12 §4).

**Where things stand.** `decisions.md` records the seed (D-065, D-067), R2 passed
([D-068](../../decisions.md)), and rulings taken while landing STYNX wave 1
([D-069](../../decisions.md), [D-070](../../decisions.md)) and the wave-2 design rulings
([D-071](../../decisions.md)), with the probe ruling revisited in [D-072](../../decisions.md).
R5 is met: STYNX 3.0.0 is published and 07 §2 cites it ([D-089](../../decisions.md)). R6's code
has landed: the CLI, decorators, template and generator, in waves W0–W8 (devai-v3#53–#66), with the
readings ruled in [D-084](../../decisions.md)–[D-088](../../decisions.md) and the hosting rule of
[D-091](../../decisions.md); the W9 close-out lists the R6 clauses still unmet and what R8 inherits.
[D-092](../../decisions.md)–[D-102](../../decisions.md) rule W9's open items: R6 closes modulo the
S10 list of STYNX defects ([D-100](../../decisions.md)), and the W10 fix wave applies the rulings in
code and template.
[D-103](../../decisions.md)–[D-107](../../decisions.md) rule W10's open items (module manifests,
fresh-module dead code, the web `unit` setup, the step 3 build, W10's readings) and [D-108](../../decisions.md)–[D-112](../../decisions.md) the questions those left
open (app `build` scripts, the `unit-api`/`unit-web` projects, `init` re-runs); W11 applies them.
[D-113](../../decisions.md) and [D-114](../../decisions.md) settle the `init` re-run and `unit`'s invocation;
[D-115](../../decisions.md)–[D-118](../../decisions.md) finish the re-run rules and ratify W11's readings
(devai-v3#70–#76).
**R6 is closed** at 10/10 modulo the S10 list ([D-119](../../decisions.md), [D-100](../../decisions.md)),
with devai-v3#74 merged: clause 2 is met at 09 §4 steps 1–4, and steps 5–8 are R8 acceptance
([D-098](../../decisions.md)).
[D-120](../../decisions.md) and [D-121](../../decisions.md) settle how `init` recognises its two commits and
ratify W11's `config-mismatch` readings; [D-122](../../decisions.md) admits the campaign id in that commit's
`Packet:` trailer (devai-v3#77–#80). With it, R6 leaves no open law question.
R8's first pass (devai-v3#81) ran the 09 §4 matrix; [D-123](../../decisions.md)–[D-131](../../decisions.md) rule
its open items (devai-v3#83): the shell's guards and error bodies, `packet rebase`'s PL-14, the aggregate `matrix`
job, and the sensor evidence, deferred until S10 #4 ([D-128](../../decisions.md)); devai-v3#84 applies them, and #82 makes `typecheck`'s population the `tsc -b` closure.
[D-132](../../decisions.md)–[D-134](../../decisions.md) make the test config a `typecheck` project, word `unit`'s
population as coded, and let R8 close on a green `matrix` in both runtimes, the sensor evidence re-checked at
R9 (devai-v3#86; #85 applies D-132). [D-135](../../decisions.md)–[D-138](../../decisions.md) drop PKT-DEMO-004's repository range, ratify the
shell's filter wiring, add the public health controller to S10 (#8; the probes answer 401 until then) and
let the test config reach the modules through the apps (devai-v3#87, applied by #88, with #89's PL-15 evidence text).
**R8 is closed** ([D-134](../../decisions.md)): `matrix` is green in both runtimes, O1–O16 and N1–N20; the sensor
evidence and 12 §3.1's token rows stay pending S10 #4 and D-124 ([D-124](../../decisions.md), [D-128](../../decisions.md)).
**R9 is applied** (2026-10-25): `main`'s protection requires `build` and `matrix`, strict, enforced for admins;
read back `[["build","matrix"],true,true]`.
[D-139](../../decisions.md) adds `-w` to `init`'s install (`pnpm add -w -D --save-exact @devai-nyx/cli@<own version>`):
without it pnpm 9.15.0 refuses to add to the workspace root, and R10's `init` would exit 2.
[D-140](../../decisions.md) follows the add with `pnpm install`, since `add -w` links only the root importer;
every printed `pnpm add` remedy takes the `-w … && pnpm install` shape.
R7 is confirmed on the release host.
**R10 is done** (2026-10-25): `v3.0.0` is tagged on `8d87aea2` and run 40234658131 passed `build`, the
`matrix` shards, `matrix` and `publish`; `npm view @devai-nyx/{cli,decorators}@3.0.0 version` prints `3.0.0`
twice, and `pnpm dlx @devai-nyx/cli@3.0.0 init --product demo` in an empty directory exits 0 with both
`init` commits. That run needed a user-level registry config, now on [Install](../adopters/install.md).
**H8 is applied**: both packages are public. **3.0.0 is released.**

**Not blocking 3.0.0** (12 §4): the D-047 edit-loop p95 measurement (3.0.0 ships 90000); the first
DETRAN campaign that settles D-026; each adopter's own `review.mustRun` flip (D-028); the open items
D-004 and 02 §3 step 3; STYNX-only items SM-05, 09, 11, 12; SLO measurement, which is each product's
release lane ([D-038](../../decisions.md)).

## The `publish` job

`ci.yml` has four jobs: `build`, the matrix shards with their aggregate `matrix` check, `publish`
(12 §5, [D-064](../../decisions.md), [D-127](../../decisions.md)), and `pages` (see [Docs site](#docs-site); D-141).
`publish`:

- runs only on a `v*` tag, with `needs: [build, matrix]`;
- first checks that the tagged commit is on `main`
  (`git merge-base --is-ancestor $GITHUB_SHA origin/main`);
- has `permissions: packages: write` and publishes with `pnpm -r publish`, authenticated by the
  workflow's `GITHUB_TOKEN`. There is no publish PAT.

On a `v*` tag `matrix` always runs every cell, whatever changed, so a tag publishes only what the full
matrix passed (see [Building and testing](building-and-testing.md)). The install steps authenticate with
`STYNX_READ_TOKEN` (H4's fallback for the cross-organisation `@stynx-nyx/*` read); the publish step itself
sets `NODE_AUTH_TOKEN` to `GITHUB_TOKEN`, so that read token is never a publish credential (12 §5).

Both manifests name `repository` (`https://github.com/devai-nyx/devai-v3.git`, `directory`
`packages/cli` or `packages/decorators`), which GitHub Packages uses to connect a package it creates
to this repository. `@devai-nyx/cli` already exists, connected to the v2 repository with 0.1.0–0.8.0;
H4 grants this repository Actions write access to it.

There are no Changesets in this repository: two packages, one literal version, and no node reads a
changeset here ([D-065](../../decisions.md)). There are no signed tags, provenance or attestations
([D-002](../../decisions.md); 12 §8).

## Docs site

The Docusaurus site in `site/` deploys to GitHub Pages at <https://devai-nyx.github.io/devai-v3/> from
`main`, by the `pages` job in `ci.yml` (D-141, Owner 2026-10-25). `pages` runs only on a push to `main`,
with `needs: [build]`, so a red `main` never deploys; it is not a required check. It builds the site with
`pnpm --filter @devai-nyx/site build`, uploads `site/build` and deploys it with `actions/deploy-pages`;
`onBrokenLinks: 'throw'` fails the build on a broken internal link.

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
| H7 | — | Struck by [D-142](../../decisions.md) (Owner, 2026-10-25): v2 and v3 cohabit, and the v2 repository `aarusso-nyx/devai` stays unarchived. It was: archive v2 after R10 and the first adopter's green v3 module ([D-090](../../decisions.md)) |
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

Source: 08 B.10, 09 §1.1, §2, §4, decisions D-002, D-003, D-026, D-028, D-038, D-047, D-058, D-064, D-065, D-067–D-070, D-098, D-100, D-119–D-138, D-141, D-142; 12 §0, §3–§5, §8 (bootstrap history).
