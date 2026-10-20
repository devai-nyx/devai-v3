---
title: CLI
sidebar_position: 2
description: Every devai command, flag, mode, exit code and reason code, as 08 Part A specifies them.
---

# CLI reference

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

This page lists the whole command surface of [08 Part A](../framework/08-cli-and-nodes.md): **7 invocations** under 5 command words (`init`, `new module`, `check`, `packet new|lint|rebase`, `packets status`), **20 distinct flags** (28 flag uses across the 7 invocations), and **3 hook scripts**. `devai doctor` is specified as *not built* ([08 A.6](../framework/08-cli-and-nodes.md)).

> 08 §0 says "v3 has six commands and one flag family". Part A specifies the seven invocations listed below; this page lists all of them and does not settle how the six are counted.

## Rules for every command

These hold for every command and are not repeated per command ([08 Part A](../framework/08-cli-and-nodes.md)):

- **Config first.** Every command reads `devai.json` and validates it against the [08 A.8](../framework/08-cli-and-nodes.md) zod definition (see [devai.json](./devai-json.md)). An invalid file is exit 2 `config-invalid` before anything else runs. The one exception is `devai init` in a directory with no `devai.json`.
- **Runtime once.** The runtime is resolved once per command (`resolveRuntime()`, [02 §6](../framework/02-architecture.md)). `DEVAI_RUNTIME=bare|docker` overrides it; any other value is exit 2 `config-invalid`.
- **Output.** Plain text goes to stdout. With `--format json`, stdout carries exactly one JSON document ([07 §3](../framework/07-dependencies.md)). Diagnostics about the command itself go to stderr.
- **Exit codes** are the three of [02 §8](../framework/02-architecture.md), everywhere ([D-058](../../decisions.md)):

| Exit | Meaning |
|---|---|
| `0` | The command did what it says and no gating node is `FAIL` or `UNKNOWN` |
| `1` | A demonstrated violation |
| `2` | Could not run or could not observe; the JSON output carries a `reason` code |

- **`accepted: true`** appears only when `devai check --packet <p> --full` exits 0. Every other exit 0 carries `accepted: false`.

## Flag index

| Flag | Command(s) | Values / default |
|---|---|---|
| `--product <slug>` | `init` | `^[a-z][a-z0-9]*$`; required in materialise mode, rejected in attach mode |
| `--locales <tag,…>` | `init` | default `en-US`; must start with `en-US` ([D-014](../../decisions.md)) |
| `--lgpd` | `init` | default off ([D-014](../../decisions.md)) |
| `--runtime bare\|docker` | `init` | default `bare` |
| `--dir <path>` | `init` | default `.`; must be empty or absent in materialise mode |
| `--spec <path>` | `new module`, `packet new` | approved spec (module); see per-kind rules (packet) |
| `--web` | `new module` | adds `web/**` |
| `--out <dir>` | `new module` | default `domain/<module.slug>` |
| `--regenerate` | `new module` | rewrites `mode: generated` files of an existing module |
| `--packet <path>` | `check` | the packet to check |
| `--full` | `check` | every applicable node |
| `--only <node>` | `check` | repeatable; named nodes plus prerequisites, feedback only |
| `--hook pre-commit\|pre-push\|commit-msg <msgfile>` | `check` | hook subsets (A.7); `<msgfile>` for `commit-msg` |
| `--expect-red` | `check` | only with a `kind: test` packet naming `observations.unimplemented` |
| `--summary` | `check` | requires `--packet` |
| `--prune` | `check` | combines with nothing else |
| `--kind <k>` | `packet new` | `spec\|generate\|test\|code\|fix\|standards` |
| `--campaign <CMP-id>` | `packet new`, `packets status` | default for `new`: the single campaign folder when exactly one exists |
| `<path>` (positional) | `packet lint`, `packet rebase` | the packet file |
| `--to <commit>` | `packet rebase` | the new `base` |
| `--format text\|json` | every command | default `text` |

The index has 21 rows: the 20 flags plus the positional packet `<path>`. Per invocation: `init` 6, `new module` 5, `check` 8, `packet new` 4, `packet lint` 1, `packet rebase` 2, `packets status` 2 (each count includes `--format`), 28 in all.

## `devai init`

Source: [08 A.1](../framework/08-cli-and-nodes.md), [09 §1](../framework/09-rail.md).

```text
devai init [--product <slug>] [--locales <tag,…>] [--lgpd] [--runtime bare|docker] [--dir <path>] [--format text|json]
```

| Field | Contract |
|---|---|
| Arguments | `--product` slug `^[a-z][a-z0-9]*$`, required when no `devai.json` exists (materialise mode), rejected when one exists (attach mode); `--locales` default `en-US`, must start with `en-US`; `--lgpd` default off; `--runtime` default `bare`; `--dir` default `.`, must be empty or absent in materialise mode |
| Materialise mode | No `devai.json` in `--dir`: emits the 09 template (`devai.json`, `compose.yaml`, `database/README.md`, `AGENTS.md`, `decisions.md`, `specs/`, `packets/`, `product/` fixture, `scripts/hooks/`, Action), runs `git init` if needed, commits `chore(template): devai init <product>` with trailer `Packet: PKT-DEMO-001`, renders the four `CMP-DEMO-001` packets with `base` = that commit and commits `chore(packets): seed CMP-DEMO-001` |
| Attach mode | `devai.json` exists: writes no files except the hook scripts |
| Reads | `devai.json` (attach), host `git`, `node --version`, `pnpm --version`, `corepack --version` |
| Writes | Template files and two commits (materialise). In both modes, in the current worktree's config: `git config core.hooksPath scripts/hooks`, `git config user.name <product>-agent`, `git config user.email agent@<product>.local`. Nothing under `.devai/cache/` |
| Preflight (last step) | Resolves every binary and library Part B names for every node whose population could be non-empty on this template; prints one line per missing item: `UNKNOWN: tooling-missing — <node>: install with <command>` |
| Exit | `0` written and every tool resolved; `2` written but ≥ 1 tool missing (`tooling-missing`), or `--dir` not empty (`dir-not-empty`), or `--product` missing in materialise mode (`usage`); never `1` |
| JSON output | `{ mode, product, written: string[], gitConfig: {…}, preflight: [{ node, binary, status, remedy? }], accepted: false, exitCode, reason? }` |
| Reason codes | `config-invalid` (attach, bad file), `not-a-repository` (attach, outside git), `tooling-missing`, `dir-not-empty`, `usage` |

## `devai new module`

Source: [08 A.2](../framework/08-cli-and-nodes.md), [02 §7](../framework/02-architecture.md), [09 §3](../framework/09-rail.md).

```text
devai new module --spec <path> [--web] [--out <dir>] [--regenerate] [--format text|json]
```

| Field | Contract |
|---|---|
| Arguments | `--spec` repo path of an approved spec ([06 §6](../framework/06-spec-format.md)); `--web` adds `web/**`; `--out` default `domain/<module.slug>`; `--regenerate` rewrites `mode: generated` TypeScript files of an existing module from the same spec id |
| Reads | The spec's machine block through the same zod parse `spec-lint` uses; `devai.json` `locales`, `lgpd`, `productPrefix`; `generation-manifest.json` (regenerate); `git show <merge-base>:<db path>` to detect base-present SQL |
| Writes | `domain/<slug>/**` exactly as [04 §2](../framework/04-layout.md), with `@generated` headers; `generation-manifest.json` (no timestamp); one entry in the `database/seed/` manifest ([D-023](../../decisions.md)). Nothing else; no commit |
| Refuses | Spec `status` ≠ `approved`, `approved-by` null, `## Open questions` non-empty, machine block invalid → exit 2 `spec-not-approved` / `spec-invalid` with the SL locator. `--out` exists without `--regenerate` → exit 1 `output-exists`. `--regenerate` where the manifest `specId` ≠ the spec's id and ≠ its `supersedes.id` ([D-053](../../decisions.md)) → exit 1 `spec-mismatch`. A successor is admitted only inside a `generate` packet |
| Regenerate | Per manifest entry: `generated` → rewritten; `seed` → compared with the manifest's initial digest and printed as `seed unchanged, safe to overwrite` or `seed edited, left alone`, never written; `db/*.sql` present at the merge base → never rewritten ([D-033](../../decisions.md), LINT013) |
| Exit | `0` written; `1` `output-exists`, `spec-mismatch`; `2` `spec-not-approved`, `spec-invalid`, `config-invalid` |
| Text output | one line per file: `<mode> <path>` |
| JSON output | `{ specId, specSha256, machineBlockSha256, out, files: [{ path, mode, sha256, action: written\|unchanged\|left-alone }], accepted: false, exitCode, reason? }` |
| Verified later by | The `generated` node: every `mode: generated` entry byte-equals a fresh render from the generator version in the manifest over the recorded inputs; seeds excluded |

## `devai check`

Source: [08 A.3](../framework/08-cli-and-nodes.md), [08 C.1](../framework/08-cli-and-nodes.md), [02 §2, §8](../framework/02-architecture.md).

```text
devai check [--packet <path>] [--full] [--only <node>]… [--hook pre-commit|pre-push|commit-msg <msgfile>] [--expect-red] [--summary] [--format text|json] [--prune]
```

### Subset selection

Every selection includes `inventory` and `accept`.

| Flags | Nodes planned |
|---|---|
| none | Edit-loop subset: `format lint lint-tests typecheck layout sql-lint spec-lint route-contract sql-typed` (static), `unit test-integrity i18n`; plus `sql-typed` DB when `provide('postgres')` succeeds without starting anything |
| `--packet <p>` | Adds `packet-scope` and `spec-tests` over the packet's derived acceptance file, with their prerequisite closure (`db-apply`, `sql-typed` DB) |
| `--packet <p> --full` | Every applicable node, including `permissions-pattern`, `review`, `accept`, over `base..candidate`. The only run that can set `accepted: true` |
| `--full` (no packet) | Feedback over every applicable node except the packet-bound ones (`packet-scope`, `spec-tests`, `review` deferred); `accepted: false` |
| `--only <node>` (repeatable) | The named nodes and their prerequisites; feedback only. Also the way to see one node's preflight ([08 A.6](../framework/08-cli-and-nodes.md)) |
| `--hook <stage>` | The hook subsets of [08 A.7](../framework/08-cli-and-nodes.md) (below) |

Nodes outside the plan are **deferred**: they get no row, and `accept` lists them ([D-058](../../decisions.md)).

### Other flags

| Flag | Contract |
|---|---|
| `--expect-red` | Accepted only with `--packet` whose `kind: test` and whose `observations.unimplemented` is non-empty (PL-11, [D-051](../../decisions.md)). It restates what the packet already selects and must agree; otherwise exit 2 `expect-red-nothing-named` |
| `--summary` | Requires `--packet`. After a `--full` run, prints the [08 C.3](../framework/08-cli-and-nodes.md) summary. Without `--full`, prints the summary of the latest report in `.devai/cache/reports/` whose `candidateDigest` equals the current candidate's; else `no acceptance report for head <sha>; run --full` (exit 2 `no-report`) |
| `--prune` | Keeps the newest 200 entries per node under `.devai/cache/`; drops the scratch databases named in `.devai/cache/scratch/*.json` descriptors (only those); deletes the descriptors; exits 0; combines with nothing else |
| `--format` | `text` (default): the [02 §8](../framework/02-architecture.md) report, failing nodes first, ≤ 40 lines, grammar in [08 C.3](../framework/08-cli-and-nodes.md). `json`: the [report.json](./report-json.md) document on stdout |

### Reads, writes, exit

| Field | Contract |
|---|---|
| Reads | `devai.json`, the packet, the pinned spec via `git show <base>:<path>`, the candidate (tracked + untracked; the index under `--hook pre-commit`), `.devai/cache/**`, `.devai/review/**`, host tools per Part B |
| Writes | `.devai/cache/{nodes,results}/` (PASS only); `.devai/cache/reports/<candidateDigest>.json` (every `--full` run and every `--format json` run); `.devai/cache/agentic/<node>/<digest>.json`; `.devai/cache/scratch/`; `.devai/review/<packet-id>.json` (by `review`) and `.devai/review/<packet-id>.permissions.json` (by `permissions-pattern`), both `--packet --full` only. Never the packet, the spec or the candidate |
| Exit | `0` no gating node `FAIL` or `UNKNOWN` (under `--packet --full` this includes `accept` `PASS` and sets `accepted: true`); `1` ≥ 1 gating `FAIL`; `2` ≥ 1 gating `UNKNOWN` and no `FAIL`, or could not run. `FAIL` + `UNKNOWN` → `1`, both preserved |
| Gating | Every planned node is gating except `review` while `review.mustRun` is false and the candidate touches no undeclared protected class ([D-028](../../decisions.md), [D-058](../../decisions.md)) |
| Reason codes | `config-invalid`, `not-a-repository`, `packet-invalid`, `base-not-ancestor`, `expect-red-nothing-named`, `no-report`, `candidate-changed` (digest differs before/after the run; result discarded), `io` (candidate unreadable while framing), `tooling-missing` (only when `inventory` itself cannot run) |

### Hook stages

`devai init` writes three tracked scripts under `scripts/hooks/` (class `protected:ci`) and sets `core.hooksPath` to that folder; there is no husky ([D-057](../../decisions.md), [D-058](../../decisions.md)). Each is one line after the shebang ([08 A.7](../framework/08-cli-and-nodes.md)):

```sh
#!/bin/sh
exec pnpm exec devai check --hook pre-commit
```

```sh
#!/bin/sh
exec pnpm exec devai check --hook pre-push "$@"
```

```sh
#!/bin/sh
exec pnpm exec devai check --hook commit-msg "$1"
```

| Stage | Nodes | Over |
|---|---|---|
| `pre-commit` | `format lint lint-tests sql-lint` | The **staged snapshot** (index bytes and modes), materialised under `.devai/cache/scratch/staged-<digest>/`; a partially staged file is checked as staged |
| `pre-push` | The pre-commit set plus `generated boundary deadcode openapi actionlint`; `db-apply`, `sql-typed` DB and `integration` when `database/**`, `domain/*/db/**` or `*.repository.ts` changed since the fetched base; the `protected-paths` notice lines | The fetched base from the stdin ref lines: `<remote sha>` when non-zero and an ancestor of `<local sha>`, else `git merge-base <local sha> refs/remotes/origin/HEAD`; unresolvable → `protected-paths` `UNKNOWN: base-unreadable` (a notice) |
| `commit-msg` | `commitlint` | The message file |

The pre-push hook never exits non-zero for a protected-path notice, and it does not invoke `review` ([08 A.7](../framework/08-cli-and-nodes.md)). Under `--hook`, one stage line is printed immediately before `exit <code>` ([10 §4](../framework/10-agent-surface.md)):

```text
devai pre-commit PASS — format lint lint-tests sql-lint on the staged snapshot
devai pre-commit FAIL — fix the lines above, git add, commit again; CI runs the same nodes
devai pre-commit UNKNOWN — <node>: <reason>; do the remedy above, then commit again
devai pre-push PASS — <n> nodes over <base>..<head>
devai pre-push FAIL — fix the lines above, commit, push again; CI runs the same nodes
devai pre-push UNKNOWN — <node>: <reason>; do the remedy above, then push again
devai commit-msg PASS
devai commit-msg FAIL — write type(scope): subject, scope = package or module slug; keep the trailers
devai commit-msg UNKNOWN — commitlint: <reason>; do the remedy above, then commit again
```

## `devai packet new` · `lint` · `rebase`

Source: [08 A.4](../framework/08-cli-and-nodes.md), [05 §2, §4, §5](../framework/05-task-packet.md).

```text
devai packet new --kind <spec|generate|test|code|fix|standards> [--spec <path>] [--campaign <CMP-id>] [--format text|json]
devai packet lint <path> [--format text|json]
devai packet rebase <path> --to <commit> [--format text|json]
```

### `packet new`

| Field | Contract |
|---|---|
| Renders | `id` = next `PKT-<PRODUCT>-nnn` over `packets/**` at HEAD plus untracked ([D-050](../../decisions.md); `PRODUCT` = uppercase `productPrefix`; 999 exhausted → exit 2 `usage`); `base` = `HEAD`; `protected: []`; `## Intent` and `## Deliverables` as empty headings; `title` as the placeholder `<title>` (visible to PL-01). Written to `packets/<CMP>/<id>.md` |
| `--campaign` | Default = the single campaign folder when exactly one exists; else required (`usage`) |
| Pinning kinds (`generate`, `test`, `code`, `fix`) | `--spec` required; `spec.{id,path}` from the file; `spec.sha256` = sha256 of `git show HEAD:<path>`; `observations.unimplemented` = the spec's `unimplemented[]` requirement ids for `test`, else `[]` |
| `kind: spec` | `--spec` required and is the *output* path; it need not exist; `spec.id` = its `SPEC-*` stem; no `sha256`; no approval check |
| `kind: standards` | `--spec` rejected (PL-03; `usage`); no `spec` block |
| Default globs | Always plus the packet's own path. `code`/`fix`: `domain/<slug>/api/src/**`, `domain/<slug>/web/src/**`, `domain/<slug>/api/test/*.spec.ts`, `domain/<slug>/db/**`. `test`: `domain/<slug>/api/test/acceptance/**`. `generate`: `domain/<slug>/**`, `database/seed/**`, `apps/api/package.json`, `apps/api/src/app.module.ts`, `apps/web/package.json`, `apps/web/src/app.routes.ts`, `pnpm-lock.yaml`, `docs/framework/contracts/**`. `spec`: `specs/<area>-<capability>/**`. `standards`: `tools/**`, `devai.json`, `eslint.config.*`, `tsconfig*.json`, `.stynxrc.json`, `.agents/**`, `.claude/skills/**`, `AGENTS.md`, `.github/**`, `scripts/**` |
| Refuses | Pinning kinds: spec at HEAD not `approved`, or carrying `superseded-by` → exit 2 `spec-not-approved` / `spec-superseded`; machine block invalid → `spec-invalid`; `HEAD` has no commit → exit 2 `not-a-repository` |
| Exit | `0` / `2` |

### `packet lint`

| Field | Contract |
|---|---|
| Evaluates | Over HEAD and the working tree, every [05 §5](../framework/05-task-packet.md) rule that needs no DAG run: PL-01, 02, 03, 04, 05, 06, 07, 09, 11, 13, 14, 17, and PL-08 as a notice. PL-10 (needs `review`) and PL-12, PL-15, PL-16 (`accept`, `--full`) print as `deferred`. Messages verbatim from 05 §5; never prints "accepted" |
| Exit | `0` clean; `2` `packet-invalid` / `base-not-ancestor` (PL-01–03, 06, 14, pin absent, base not ancestor); `1` any other violated rule |

### `packet rebase`

| Field | Contract |
|---|---|
| Effect | Rewrites `base` to `--to` iff `--to` descends from the current `base` and, for pinning kinds, `sha256(git show <to>:<spec.path>)` = `spec.sha256` (PL-05); otherwise exit 1 with PL-05's message. No other byte changes |
| Exit | `0` / `1` / `2` |

### Shared by the three

| Field | Contract |
|---|---|
| Reads | `devai.json`, `packets/**`, the spec blob, `git rev-parse`, `git merge-base --is-ancestor`, `git log --diff-filter=A` (introducing commit, PL-13), `.devai/review/<id>.json` history (PL-09) |
| Writes | The packet file only; no commit (the pilot commits, [05 §4](../framework/05-task-packet.md)) |
| Text output | the rendered path, or PL lines |
| JSON output | `{ path, id?, rules: [{ id, status: pass\|fail\|deferred, message? }], accepted: false, exitCode, reason? }` |

## `devai packets status`

Source: [08 A.5](../framework/08-cli-and-nodes.md), [05 §4](../framework/05-task-packet.md).

```text
devai packets status [--campaign <CMP-id>] [--format text|json]
```

| State | Evidence (for each `packets/**/PKT-*.md` at HEAD plus untracked) |
|---|---|
| `drafted` | Untracked |
| `frozen` | In a commit; `devai packet lint` clean |
| `candidate` | ≥ 1 commit in `git log --all --grep '^Packet: <id>$'` descending from `base`, not reachable from `main` |
| `accepted` | Printed only when **both** exist: a committed `.devai/review/<id>.json` whose `candidateDigest` equals the digest recomputed from the tree of a commit carrying the trailer, **and** a report in `.devai/cache/reports/<candidateDigest>.json` with `accepted: true`. Review evidence alone, or a pruned report, prints `candidate (review bound to <sha>, no accepted report)` |
| `merged` | A commit reachable from `main` carries the trailer |
| `superseded` | Another packet at HEAD carries `supersedes: <id>` (PL-16) |

The highest state whose evidence exists is printed with its evidence.

| Field | Contract |
|---|---|
| Reads | `git log`, `git ls-files`, `git ls-tree`, packets, `.devai/review/*.json`, `.devai/cache/reports/` (read-only) |
| Writes | Nothing |
| Exit | `0`; `2` `not-a-repository` / `config-invalid` |
| Text output | one line per packet: `<id>  <kind>  <state>  <evidence>`, in campaign order |
| JSON output | `{ campaigns: [{ id, packets: [{ id, kind, state, evidence, after: string[], supersedes? }] }], accepted: false, exitCode }` |

## Not built

From [08 Part D](../framework/08-cli-and-nodes.md): no `devai doctor` (preflight is the first phase of every `devai check` and the last of `devai init`), no `devai new app` (the template is `devai init`), no `--staged`, no `--since-ref`, no `--strict`. There is no interactive prompt in `devai check`, no colour and no TTY detection.

Source: [08 Part A, Part D](../framework/08-cli-and-nodes.md), [02 §2, §6, §8](../framework/02-architecture.md), [05](../framework/05-task-packet.md), [09](../framework/09-rail.md), [10 §4](../framework/10-agent-surface.md), [D-050](../../decisions.md), [D-051](../../decisions.md), [D-057](../../decisions.md), [D-058](../../decisions.md).
