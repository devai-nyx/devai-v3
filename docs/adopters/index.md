---
title: Adopters
sidebar_position: 1
description: How a product repository installs, configures and runs DEVAI 3, and how it moves from DEVAI 2.
---

# Adopters

This section is for the people who set up and maintain a product repository on DEVAI 3: the
application architect, the engineer who owns CI, and the pilot who approves specs. It covers what
you install, what the template writes, what you may change, and what CI does with the result.

DEVAI 3.0.0 is unreleased. The CLI, the decorators and the template land at release prerequisite
R6 of the succession plan (12 §4, bootstrap history). These pages describe the behaviour the law
specifies, so you can plan an adoption before the first publish.

## Pages

- [Install](install.md): prerequisites, `devai init` in materialise and attach mode, and the pins a
  3.0.0 repository runs on.
- [Configuration](configuration.md): `devai.json` key by key, the `DEVAI_RUNTIME` override, and the
  two values each repository changes after it has measured them.
- [CI](ci.md): the template's GitHub Action, the required check, and why no model key ever reaches
  CI.
- [Protected paths](protected-paths.md): the seven classes, the labels they produce, and how they
  differ from a packet's `paths.allowed` scope.
- [Moving from v2](moving-from-v2.md): a fresh scaffold per product, no conversion, and a 2.x pin
  until you move.
- [Upgrading](upgrading.md): generator versions, `--regenerate`, and successor specs.

## Three facts to keep in mind

1. **One acceptance rule.** A packet is accepted when `devai check --packet <p> --full` exits 0;
   the independent review is a node inside that command, not a second condition
   ([01](../framework/01-charter.md), [02 §8](../framework/02-architecture.md)).
2. **No configuration is executable, and nothing is waived.** `devai.json` is inert JSON validated
   against a schema ([D-034](../../decisions.md)); there is no `review: off`, no per-packet node list
   and no pilot waiver of any node ([02 §8](../framework/02-architecture.md)).
3. **DEVAI never asks you for permission.** A missing database or model is an `UNKNOWN` with its
   remedy printed, never a request to bypass the framework ([01](../framework/01-charter.md),
   [D-006](../../decisions.md)).

For the command and key details these pages summarise, see the [reference](../reference/index.md)
section.

Source: 01, 02 §8, 08 Part A, 09 §1, decisions D-006, D-034; 12 §4 (bootstrap history).
