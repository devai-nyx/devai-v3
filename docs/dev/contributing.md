---
title: Contributing
sidebar_position: 6
description: Commit identity, commit messages, the PR flow and branch protection in the devai-v3 repository.
---

# Contributing

Most changes to this repository are made by coding agents, with the Owner deciding intent. The rules
below keep that arrangement observable without asking anyone to read diffs.

## Commit identity

Agents commit under **one** git identity, with a trailer that names the model
([D-019](../../decisions.md), [02 §5](../framework/02-architecture.md)). In this repository the
identity is the one the seed used (12 §2, host step H2, bootstrap history):

```sh
git -c user.name=devai-agent -c user.email=agent@devai.local commit
```

and the message ends with a `Co-Authored-By: <model name> <vendor noreply>` trailer. Commits are
unsigned: there is no signing or attestation infrastructure ([D-002](../../decisions.md)). The pilot
commits as themself ([02 §5](../framework/02-architecture.md)).

Nothing reads the identity in order to refuse anything. It separates agent work from pilot work in
`git log --author` ([02 §5](../framework/02-architecture.md)). It also explains why the seed was not
authored by the Owner: an Owner-authored seed would read as diff ratification (12 §2;
[D-003](../../decisions.md)).

In an adopter repository, `devai init` writes the equivalent identity, `<product>-agent` /
`agent@<product>.local`, into each worktree. That needs a `devai.json`, which this repository does
not have, so here you set it yourself (12 §5;
[08 A.1](../framework/08-cli-and-nodes.md)).

## Commit messages

Use Conventional Commits, `type(scope): subject`. Semantic commits are a company standard (S-40,
[03](../framework/03-standards.md)), and every commit in this repository's history follows the form:

```
chore(seed): found DEVAI 3.0.0 from the v3 foundation
docs(framework): R2 passed; sql-typed describes through a pg Submittable (D-068)
docs(decisions): record R3 wave-1 rulings (D-069)
```

This repository runs no commitlint, because it has no DEVAI self-check ([D-064](../../decisions.md);
12 §8). As the history does, name the decision a change implements in the subject. Adopter repositories carry a
`Packet:` trailer per packet ([D-050](../../decisions.md)); this repository has no packets.

## Writing conventions

From `AGENTS.md`:

- Tag claims as `[fact]` (with a cited source), `[inference]` (a consequence) or `[opinion]` (a
  choice).
- Cite `file:line` for every fact; cite framework documents as `NN §n` and decisions as `D-nnn`.

Before adding a file, a field or a mechanism, apply the second-system brake: it exists only if a
named v3 mechanism depends on it ([D-055](../../decisions.md);
[Changing the law](changing-the-law.md)).

## The PR flow

1. Branch from `main`. Do not push to `main` directly: force pushes and deletions are disabled.
2. Open a PR. CI runs `build` and, when `packages/cli/**` changed, `matrix`
   ([Building and testing](building-and-testing.md)).
3. Merge when the required checks are green and the branch is up to date with `main` (protection is
   `strict`).

| Protection (12 §5) | Value |
|---|---|
| Required checks | `build` (H3); `build` and `matrix` once R9 lands (H5) |
| Required workflow (ruleset) | `.github/workflows/ci.yml` from `main`, so a PR cannot redefine its own required check ([D-080](../../decisions.md)) |
| Up to date before merge | yes (`strict`) |
| Applies to admins | yes |
| Required reviews | **none** |
| Force pushes, deletions | not allowed |

## Why there are no required reviewers

A few percent of v2's 319 merged PR diffs were read, so human ratification of diffs is not a
control. Acceptance authority rests on deterministic checks plus an independent reviewer
([D-003](../../decisions.md)). This repository therefore has no CODEOWNERS file, no required
reviewers and no publish PAT (12 §8). The one thing a PR must not be able to do is redefine the check
it is gated by; a ruleset runs the required workflow from `main` ([D-080](../../decisions.md)). Whatever the pilot reads, they read for intent: decisions,
specs and the error state ([D-003](../../decisions.md), [01](../framework/01-charter.md)).

This does not mean nobody looks. A PR that changes the law carries its decision entry, and that entry
is what the Owner rules on ([Changing the law](changing-the-law.md)).

## Licence and provenance

Both packages are Apache-2.0. The STYNX generator code that enters at R6 is carried under NYXK's
Apache-2.0 grant. Each carried file opens with `SPDX-License-Identifier: Apache-2.0` and a provenance
line citing D-067, and the commit states its STYNX provenance ([D-067](../../decisions.md),
[D-064](../../decisions.md); 12 §1). No v2 code is carried (12 §2).

Source: 01, 02 §5, 03, 08 A.1, decisions D-002, D-003, D-019, D-050, D-055, D-064, D-067; 12 §1–§2, §5, §8 (bootstrap history); `AGENTS.md` and git history at HEAD.
