---
title: Guides
sidebar_position: 1
description: How product engineers and the coding agents they direct take a feature from business rule to accepted packet on the DEVAI 3 rail.
---

# Guides

These guides are for two readers who work side by side:

- **You, the product engineer.** The law calls you the *pilot*. You state intent and business
  rules, approve technical specs, read the error state and make the few calls that need a human
  ([01 Charter](../framework/01-charter.md)).
- **The coding agents you direct.** Claude Code, Codex or any other harness picks up a packet and
  works it to acceptance. DEVAI never knows a task is running; it only knows whether a result
  passes ([D-018](../../decisions.md)).

Each guide says which parts are yours and which are the agent's. DEVAI never asks you for
permission to run a check, widen a boundary or bypass a hook. If it ever does, that is a defect in
DEVAI ([01 Charter](../framework/01-charter.md)).

## The running example

Every guide uses the fixture that `devai init` ships: the fictional product `demo`, module `notes`,
spec `specs/notes/SPEC-DEMO-001.md`, and campaign `packets/CMP-DEMO-001/` with four packets
([05 §7](../framework/05-task-packet.md), [06 §7](../framework/06-spec-format.md),
[D-048](../../decisions.md)):

| Packet | Kind | What it delivers |
|---|---|---|
| `PKT-DEMO-001` | `spec` | `SPEC-DEMO-001`, already approved and committed by `devai init` |
| `PKT-DEMO-002` | `generate` | The `notes` module skeleton generated from the spec |
| `PKT-DEMO-003` | `test` | Six acceptance tests; R-1, R-2 and R-4 expected red |
| `PKT-DEMO-004` | `code` | The implementation that turns every acceptance test green |

The spec has six requirements. R-1, R-2 and R-4 are business behaviour the generator does not
write. R-3, R-5 and R-6 are rail behaviour (authentication, input rejection, row-level security)
that stays green from the start ([D-064](../../decisions.md)).

## The guides, in the order a feature meets them

1. [Writing a spec](writing-a-spec.md): turning business rules in `product/` into an approved
   technical spec.
2. [Packets and campaigns](packets-and-campaigns.md): the six packet kinds, what goes in a packet
   and how its state is derived from git.
3. [Deriving tests](deriving-tests.md): the `test` packet, expected red and test independence.
4. [Implementing](implementing.md): the `code` and `fix` packets and the all-green rule.
5. [Review and dispositions](review-and-dispositions.md): the independent reviewer and how to
   answer its findings.
6. [Edit loop and hooks](edit-loop-and-hooks.md): the three check levels and the git hooks.
7. [Database and migrations](database-and-migrations.md): DDL bands, module SQL, applied-migration
   immutability.
8. [Runtimes](runtimes.md): bare and Docker, and why both stay green.
9. [i18n and LGPD](i18n-and-lgpd.md): locales and personal-data declarations.
10. [Troubleshooting](troubleshooting.md): from a reason code to the next action.

For the exact grammar of every command, node and file, see the [reference](../reference/index.md).
For why the loop is shaped this way, see [theory](../theory/index.md).

Source: [01](../framework/01-charter.md), [05](../framework/05-task-packet.md),
[06](../framework/06-spec-format.md), [D-018, D-048, D-064](../../decisions.md).
