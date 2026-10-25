---
title: Developing DEVAI
sidebar_position: 1
description: For contributors to the devai-v3 repository itself — its layout, build, release, law process and contribution rules.
---

# Developing DEVAI

This section is for the people and agents who work on DEVAI itself: the `devai-v3` repository that
builds `@devai-nyx/cli` and `@devai-nyx/decorators`. If you are adopting DEVAI in a product
repository, read [Adopters](../adopters/index.md) instead.

The code of release prerequisite R6 has landed: the repository holds the law, the CLI
(`src/main.ts`, the commands of 08 Part A and the 28 node adapters), the generator, the decorators,
the template with its `package.json` and lock at STYNX 3.0.0, and the committed schema projections (12 §2, §4,
bootstrap history; [D-065](../../decisions.md)). Neither package is published yet (R10).

## Pages

- [Repository](repository.md): what each path is, as R6 built it.
- [Building and testing](building-and-testing.md): the build command, the generator release matrix
  in `ci.yml`, and the R2 database prototype.
- [Release](release.md): prerequisites R0–R10, the tag-triggered `publish` job, and the host
  ceremony H1–H8.
- [Changing the law](changing-the-law.md): `decisions.md` entries, framework edits, and the
  second-system brake.
- [Contributing](contributing.md): commit identity, Conventional Commits, the PR flow and branch
  protection with no required reviewers.

## Where the law is

- [`decisions.md`](../../decisions.md): binding decisions, D-001 onward.
- `docs/framework/`: start at [01 — Charter](../framework/01-charter.md); the intent behind it is
  [00](../framework/00-intent.md).

The succession plan (12) and the migration ledger (11) are bootstrap history. They are kept outside
this repository and cited here as "bootstrap history" ([D-066](../../decisions.md)).

Source: 00, 01, decisions D-065, D-066; 12 §2, §4 (bootstrap history).
