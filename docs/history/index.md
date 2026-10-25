---
title: Bootstrap history (11, 12)
sidebar_position: 0
description: The two bootstrap documents the law cites but does not own, committed as read-only history (devai-v3#45).
---

# Bootstrap history

Documents 11 and 12 were written in the bootstrap workspace and ratified there (D-062, D-064, D-065,
D-066). They are **history, not law**: 11 is the migration plan and the v2 law ledger, closed by D-066;
12 is the succession plan whose steps R0–R10 and H1–H8 the release follows. The law (`docs/framework/`,
`decisions.md`) cites them as `11 SM-nn` and `12 §n`; this folder makes those citations resolve inside the
repository ([#45](https://github.com/devai-nyx/devai-v3/issues/45)).

| File | Status | sha256 at commit |
|---|---|---|
| [11-migration-and-ledger.md](./11-migration-and-ledger.md) | final (D-066) | `7730fb36c22f2c46ed98aab669fb3db326358f214e24c4691bc1dfb5ceffc7b2` |
| [11-ledger.json](./11-ledger.json) | final (D-066 records this digest) | `e06736842b1fba2b373c06bf93e73713bb7df590ed6bb8993da0b8a6916e37e3` |
| [12-succession.md](./12-succession.md) | ratified (D-066); §5 H3/H5 amended by D-080 and D-091, §5 H7/§6/§8 by D-090, on 2026-10-24 | `b082d19fe01e7039ac8abc6557812510801d837829d02bf19d29107fa94a6c41` |

D-066 says 11 and 12 are "never edited again". The later edits to 12 are D-080's ruleset step in
§5 (struck again by D-091) and D-090's window in §5 H7, §6 and §8, each recorded in its decision; any
further change to 12 needs a decision entry naming it. The ledger's
`sha256` values refer to v2 at `4289ff51`, as D-066 states.
