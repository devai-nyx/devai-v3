---
title: Configuration
sidebar_position: 3
description: The devai.json file key by key, the DEVAI_RUNTIME override, and the values a repository changes after measuring them.
---

# Configuration

A DEVAI 3 repository has one configuration file, `devai.json` at the root. It is checked in, it is
inert JSON with a `$schema` (no executable configuration), and it belongs to the `standards`
protected class ([D-034](../../decisions.md), [02 §6](../framework/02-architecture.md)). Its shape
is a closed zod definition: unknown keys are rejected
([08 A.8](../framework/08-cli-and-nodes.md), [D-056](../../decisions.md)).

## What the template writes

`devai init` writes this object, filling the first four values from its flags
([09 §1.1](../framework/09-rail.md)). The `protected` block holds all seven classes; two are shown.

```json
{
  "$schema": "https://devai.nyx/schema/devai.json/3",
  "productPrefix": "<from --product>",
  "locales": ["en-US"],
  "lgpd": false,
  "runtime": {
    "mode": "bare",
    "services": { "postgres": { "bare": "env:DATABASE_URL", "docker": "compose:postgres" } }
  },
  "protected": {
    "spec": ["specs/**", "packets/**"],
    "product": ["product/**"]
  },
  "review": {
    "mustRun": false,
    "reviewers": { "claude": "codex exec --model gpt-6-astra", "gpt": "claude -p --model claude-opus-5-5" }
  },
  "agentic": { "permissionsPattern": { "minConfidence": 0.7, "maxInputTokens": 60000 } },
  "check": { "editLoopCeilingMs": 90000 }
}
```

## Key by key

| Key | Rule | What reads it |
|---|---|---|
| `$schema` | The literal `https://devai.nyx/schema/devai.json/3` ([D-034](../../decisions.md)). The URL is not hosted; the committed `devai.schema.json`, emitted from the zod definition, is the artifact (D-056; 12 §8) | editors |
| `productPrefix` | `^[a-z][a-z0-9]*$`; one scalar. D-032 makes the prefix per app; how a repository hosting several apps maps prefixes is left to 02 ([08 A.8](../framework/08-cli-and-nodes.md), [D-032](../../decisions.md)) | generator, `lint` `devai/product-prefix` |
| `locales` | Canonical BCP 47 tags, at least one, `en-US` first, no duplicates ([D-014](../../decisions.md)) | generator, `i18n`, `spec-lint` |
| `lgpd` | Boolean; `true` turns on the `-- @pii` annotation rule LINT012 (S-15) | generator, `sql-lint` |
| `runtime.mode` | `bare` or `docker` ([D-011](../../decisions.md)) | every `needs: postgres` node |
| `runtime.services.postgres.bare` | `env:<VAR>`, normally `env:DATABASE_URL` | `db-apply` in bare mode |
| `runtime.services.postgres.docker` | `compose:<service>`, normally `compose:postgres` | `db-apply` in docker mode |
| `protected` | One entry per class (`spec`, `product`, `decisions`, `standards`, `infra`, `ci`, `acceptance`), each a non-empty list of repo-relative gitignore globs without braces | `protected-paths`, the Action ([Protected paths](protected-paths.md)) |
| `review.mustRun` | Boolean; whether `review` sets the exit code ([D-028](../../decisions.md)) | `review`, `accept` |
| `review.reviewers` | Worker family (`claude`, `gpt`) → reviewer argument-vector prefix. Must start with `claude` or `codex` and name the *other* family (S-66) | `review`, `permissions-pattern` |
| `agentic.permissionsPattern.minConfidence` | 0.7 to 1; the sensor passes only at or above it ([02 §4](../framework/02-architecture.md)) | `permissions-pattern` |
| `agentic.permissionsPattern.maxInputTokens` | Positive integer, at most 60000 | `permissions-pattern` |
| `check.editLoopCeilingMs` | Positive integer; template value 90000, provisional ([D-047](../../decisions.md), [D-058](../../decisions.md)) | `accept` reports `details.editLoopMs` against it |

Reviewer values are argument vectors split on whitespace, never shell strings; DEVAI appends its own
fixed flag list. A model is chosen inside the prefix (`codex exec --model <m>`) or left to the CLI's
default, and `review.json` records the model the CLI reports. The sensor uses the same selection:
there is no separate sensor backend; when no agent family resolves, it runs the first configured
reviewer in `Family` order, `claude` then `gpt` ([D-074](../../decisions.md))
([08 A.8](../framework/08-cli-and-nodes.md), [07 §6](../framework/07-dependencies.md)).

## The runtime override

`DEVAI_RUNTIME=bare|docker` is the single per-invocation override of `runtime.mode`; any other value
fails the command with exit 2 `config-invalid`. A missing prerequisite in the declared mode is
`UNKNOWN` with the start command, never a silent fallback to the other mode
([02 §6](../framework/02-architecture.md), [08 Part A](../framework/08-cli-and-nodes.md)). The
agents' whole contract is one line in `AGENTS.md`: checks run bare by default,
`DEVAI_RUNTIME=docker devai check` runs them in Docker, keep both green
([10 §1](../framework/10-agent-surface.md)).

## When the file is invalid

Every command except `devai init` in a directory without a `devai.json` reads and validates `devai.json` first. An
invalid file stops the command with exit 2 `config-invalid` before anything else runs; the hint is
"fix devai.json at the printed path; the schema is devai.schema.json"
([08 Part A](../framework/08-cli-and-nodes.md), [10 §4](../framework/10-agent-surface.md)).

## Changing it

A change to `devai.json` is a repository-level standards change, never a per-packet option:

- It touches the `standards` class and is labelled `protected:standards`
  ([02 §5](../framework/02-architecture.md)); `devai.json` is in the `standards` packet kind's
  deliverables ([05 §3](../framework/05-task-packet.md)).
- A PR touching `devai.json` runs the `needs: postgres` nodes in both runtimes in CI
  ([D-039](../../decisions.md)).

Two values are expected to change after measurement:

1. **`review.mustRun`.** Each repository starts at `false`: the reviewer runs and its findings are
   tallied against dispositions, but it does not set the exit code, except on a PR with an
   undeclared protected class. After the repository's first campaign the flag flips to `true` and
   stays ([D-028](../../decisions.md), [02 §9](../framework/02-architecture.md); 12 §4).
2. **`check.editLoopCeilingMs`.** 90000 is provisional. The binding value is the measured edit-loop
   p95 on the first STYNX and DETRAN modules in both runtimes, written into each adopter's file
   ([D-047](../../decisions.md), [02 §14](../framework/02-architecture.md)).

What you cannot configure: a node list, a `review: off`, a per-packet allowlist or a waiver
([02 §8](../framework/02-architecture.md), [08 Part D](../framework/08-cli-and-nodes.md)). See the
[`devai.json` reference](../reference/devai-json.md) for the full zod definition.

Source: 02 §4–§9, §14, 05 §3, 07 §6, 08 Part A, A.8, Part D, 09 §1.1, 10 §1, §4, decisions D-011, D-014, D-028, D-032, D-034, D-039, D-047, D-056, D-058; 12 §4, §8 (bootstrap history).
