---
title: CI
sidebar_position: 4
description: The template's GitHub Action, the required check, digest-verified review evidence, and the runtime cadence.
---

# CI

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

The template ships one GitHub Action, `.github/workflows/devai.yml`, and it is the adopter's
required check ([02 §1](../framework/02-architecture.md), [09 §1.1](../framework/09-rail.md)). CI
re-runs the deterministic checks, labels the PR and verifies the review evidence by digest. It never
calls a model.

## What the workflow does

| Concern | Specified behaviour |
|---|---|
| Deterministic nodes | Run as a job matrix per latency class in the declared runtime ([08 C.1](../framework/08-cli-and-nodes.md), [02 §2](../framework/02-architecture.md)) |
| Runtime cadence | A PR touching `devai.json`, `compose.yaml`, `scripts/ci-local/**`, `tools/**` or the generator runs the `needs: postgres` nodes in both bare and docker; other PRs run the declared mode; a weekly run in both modes is the backstop ([D-039](../../decisions.md), [02 §6](../framework/02-architecture.md)) |
| Docker job | `scripts/ci-local/run.sh`: `compose up`, `DEVAI_RUNTIME=docker devai check --full --format json`, `compose down` ([09 §1.1](../framework/09-rail.md)) |
| Labels | Recomputed from the diff by `protected-paths`; `protected:unplanned` when the packet does not declare a touched class ([02 §5](../framework/02-architecture.md)) |
| PR body | The `devai check --summary` output, ten lines at most ([02 §8](../framework/02-architecture.md)) |
| Review and sensor | Digest-verified from `.devai/review/`, never executed ([08 C.1](../framework/08-cli-and-nodes.md)) |
| Branch-protection context | One aggregating job named `devai` ([09 §1.1](../framework/09-rail.md)) |
| Filtering | No workflow-level `paths` filter: an absent required check blocks merges silently ([09 §1.1](../framework/09-rail.md)) |
| Runner and actions | `ubuntu-24.04`, never `ubuntu-latest`; actions pinned by full sha ([09 §1.1](../framework/09-rail.md); 12 §3) |

CI treats exit 1 and exit 2 alike: both are red ([02 §8](../framework/02-architecture.md)). An
`UNKNOWN` is never a pass; it is a missing observation with its remedy printed
([02 §8](../framework/02-architecture.md)).

## No model keys in CI

The independent reviewer and the `permissions-pattern` sensor run on the pilot's machine, inside
`devai check --packet <p> --full`, with whichever CLI is the other model family
([D-037](../../decisions.md), [02 §9](../framework/02-architecture.md)). Their results travel in the
PR branch as two tracked files:

| File | Bound to | Written by |
|---|---|---|
| `.devai/review/<packet-id>.json` | the candidate digest | `review` |
| `.devai/review/<packet-id>.permissions.json` | the slice digest | `permissions-pattern` |

CI recomputes each digest from the PR head. A match is reported as the recorded verdict; a mismatch
is `review: UNKNOWN (stale)` or `permissions-pattern: UNKNOWN (stale)`
([08 B.24, B.27, C.4](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md)). Both files are
excluded from the candidate digest, so committing them does not invalidate them
([D-054](../../decisions.md), [08 C.6](../framework/08-cli-and-nodes.md)).

The acknowledged weakness is stated in the law: CI trusts a locally produced reviewer result, within
D-002's rule that CI is the only consumer of evidence ([D-037](../../decisions.md),
[D-002](../../decisions.md)). There is no signing or attestation on top.

**When CI says `stale`:** re-run `devai check --packet <p> --full` and commit `.devai/review/`
([10 §4](../framework/10-agent-surface.md)). Never edit those files by hand.

## Whether review gates the PR

`review` runs on every `--full` acceptance. It sets the exit code only when `review.mustRun` is
`true`, or when the PR touches a protected class the packet did not declare
(`protected:unplanned`). Gating is derived each time, never stored
([D-028](../../decisions.md), [08 C.2](../framework/08-cli-and-nodes.md)). During the shadow period
the summary prints `mustRun: false` and `tallied`.

## Branch protection and the required workflow

Require the `devai` job as the status check, **and** require the workflow itself through a
repository ruleset that runs `.github/workflows/devai.yml` from `main` ([D-080](../../decisions.md)).
Without the ruleset, GitHub computes a pull request's checks from the PR's own copy of the workflow,
so a PR could rewrite the check it must pass. The ruleset runs the `main` copy regardless of what the
PR changes under `.github/**`; the PR's own copy still runs and is informational. Required workflows
are available on public repositories and on paid plans; a private repository on a free plan cannot
add the rule and carries the residual risk D-003 states.

```sh
gh api -X POST repos/<owner>/<repo>/rulesets --input - <<'JSON'
{ "name": "devai", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [ { "type": "workflows", "parameters": { "workflows": [
    { "path": ".github/workflows/devai.yml", "repository_id": <id>, "ref": "refs/heads/main" } ] } } ] }
JSON
```

`<id>` is `gh api repos/<owner>/<repo> --jq .id`. `devai init` prints both host lines, protection and
ruleset, at the end of its output ([08 A.1](../framework/08-cli-and-nodes.md)). The succession plan's step for each adopter is
"protection requires the `devai.yml` job" (12 §6, bootstrap history). Required human reviews are not
the control: acceptance authority rests on deterministic checks plus the independent reviewer, and
a pilot reading diffs is not an observation ([D-003](../../decisions.md)). No CODEOWNERS file ships
with the template; a code-owner rule is viable only once agent PRs are opened by an identity that is
not the owner, and the law leaves it to the pilot ([D-080](../../decisions.md)). Merging remains the
pilot's act or branch protection's; a reviewer `PASS` is never authorization
([02 §9](../framework/02-architecture.md)).

## Installing in CI

The install step needs `NODE_AUTH_TOKEN`, because the template `.npmrc` reads it for both
`@devai-nyx` and `@stynx-nyx` on GitHub Packages ([09 §1.1](../framework/09-rail.md)). The
registry requires a token even for public packages (12 §1). The law does not fix which secret your
repository uses for it.

## The hooks are not a substitute

Local hooks run subsets of the same nodes (`pre-commit`, `pre-push`, `commit-msg`), and the agent
guide says it plainly: CI runs the same nodes, so `--no-verify` saves nothing
([08 A.7](../framework/08-cli-and-nodes.md), [10 §1](../framework/10-agent-surface.md)). The
pre-push hook does not run `review`; D-037's "pre-push" is the agent's `--full` run before pushing
([08 A.7](../framework/08-cli-and-nodes.md)). See
[edit loop and hooks](../guides/edit-loop-and-hooks.md).

Source: 02 §1–§2, §5–§9, 08 A.7, B.24, B.27, C.1–C.6, 09 §1.1, 10 §1, §4, decisions D-002, D-003, D-028, D-037, D-039, D-054, D-058; 12 §1, §3, §6 (bootstrap history).
