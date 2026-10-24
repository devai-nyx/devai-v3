---
title: Packet format
sidebar_position: 6
description: The task packet's front-matter fields, Markdown sections, kind-to-required-set table, lifecycle states and the 17 PL rules of 05.
---

# Packet format

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

A task packet is one Markdown file at `packets/<CMP>/PKT-<PRODUCT>-<nnn>.md`: one closed YAML front-matter block followed by named sections ([05 §2](../framework/05-task-packet.md), [D-027](../../decisions.md), [D-050](../../decisions.md)). It is the only input to `devai check --packet <p>` and carries no execution state ([D-018](../../decisions.md)).

**Counts:** 14 front-matter fields, 4 Markdown sections, 6 kinds, 6 lifecycle states, **17 PL rules** (PL-01…PL-17).

## Front-matter fields

The block is closed: unknown keys are rejected (PL-01).

| Field | Type | Required | Consumers | Meaning |
|---|---|---|---|---|
| `id` | `PKT-<PRODUCT>-<nnn>` | yes | all, dashboard | Equals the file stem; unique under `packets/**`; the `Packet:` commit trailer ([D-050](../../decisions.md)) |
| `title` | string ≤ 80 chars | yes | dashboard, `review` | Imperative, one line |
| `kind` | `spec` · `generate` · `test` · `code` · `fix` · `standards` | yes | `accept`, `packet-scope`, `spec-tests` | Selects the required set (below). [D-026](../../decisions.md) provisional |
| `spec.id` | `SPEC-<PRODUCT>-<nnn>` | yes unless `kind: standards` | `packet-scope`, `spec-tests`, `review`, dashboard | The setpoint; for `kind: spec` the spec this packet writes |
| `spec.path` | repo path | same | `packet-scope`, `review` | `specs/<area>-<capability>/SPEC-*.md`; for `kind: spec` the *output* path |
| `spec.sha256` | 64 lowercase hex | yes unless `kind` ∈ `{spec, standards}` | `packet-scope`, `spec-tests`, `review` | sha256 of the spec file's bytes at `base`. Recording it is the pin; `frozen` is derived from it ([D-053](../../decisions.md)) |
| `base` | 40-hex commit | yes | `packet-scope`, `protected-paths`, `accept` | Where the candidate diff starts. May advance, never move back (PL-05) |
| `after` | list of packet ids | no | `accept` (on `--full`) | Packets whose `Packet:` trailer must be in `base`'s history |
| `supersedes` | packet id | no | dashboard, `accept` | The packet this one replaces (PL-16). Not the spec's `supersedes` |
| `paths.allowed` | list of globs, ≥ 1 | yes | `packet-scope` | Everything the candidate may change, including the packet's own path; gitignore-style, rooted at the repo |
| `paths.forbidden` | list of globs | no | `packet-scope`, agent | Overrides inside `allowed`: a match fails even if `allowed` matches ([D-052](../../decisions.md)) |
| `protected` | subset of `spec product decisions standards infra ci acceptance` | yes, may be `[]` | `protected-paths`, Action, `accept`, dashboard | Classes this packet *plans* to touch. A touched class not listed → `protected:unplanned` → `review` gates the PR |
| `context[]` | `{ path, lines: "a-b", why }` | no | agent, `review` | Pointers, not quotes: ≤ 8 entries, ≤ 40 lines each, ≤ 200 lines total, resolved at `base`. Never the spec |
| `observations.unimplemented` | list of `R-n` | yes, may be `[]` | `spec-tests`, `accept`, dashboard | Non-empty only for `kind: test` ([D-051](../../decisions.md)). Each id is an `acceptance: yes` requirement listed in the spec's `unimplemented[]` |

**Not fields** ([05 §2](../framework/05-task-packet.md)): `workerFamily`/`reviewFamily`, `must-run`, `review: off`, `status`, `assignee`, `started`, `finished`, run ids, worktree path, `budget`/`effort`/`model`, `acceptance.command`, `depends-on`, `tests`. The acceptance file is derived: `domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`.

## Sections

In this order; headings are literal.

| Section | Required | Reader | Content |
|---|---|---|---|
| `## Intent` | yes | agent, `review` | ≤ 5 lines: what is true when the packet is done |
| `## Deliverables` | yes | agent, `review` | Bullets naming `R-n` ids, routes and files; no node names |
| `## Notes` | no | agent, pilot | ≤ 10 lines of task-specific pitfalls; the agent may append findings |
| `## Review dispositions` | no | `packet-scope`, `review` | One line each: `RV <fingerprint> · R-n · <locator> · not-a-defect\|accepted-risk · <reason>` ([D-035](../../decisions.md)). `fingerprint` = ≥ 12 leading hex of a finding's fingerprint in `.devai/review/<packet-id>.json`. `accepted-risk` is the pilot's word |

**Who writes what.** The pilot writes `title`, `## Intent`, `protected` and the dispositions. `devai packet new` renders `id`, `spec.sha256`, `base`, the packet's own path and the default globs. The coding agent may amend `paths.allowed`, `context`, `base` (forward only) and `## Notes`, and may write a `not-a-defect` disposition ([05 §2](../framework/05-task-packet.md)).

## Skeleton

```yaml
id: PKT-DEMO-004
title: <imperative, one line>
kind: code
spec: { id: SPEC-DEMO-001, path: specs/notes/SPEC-DEMO-001.md, sha256: <64 hex at base> }
base: <40 hex>
after: [PKT-DEMO-003]                       # optional
supersedes: PKT-DEMO-00x                    # optional
paths:
  allowed: [ <glob>, ..., packets/CMP-DEMO-001/PKT-DEMO-004.md ]
  forbidden: [ <glob>, ... ]                # optional; wins inside allowed (D-052)
protected: []                               # classes planned, may be empty
context:                                    # optional, ≤ 8 × ≤ 40 lines, ≤ 200 lines
  - { path: <repo path>, lines: "1-12", why: <one line> }
observations:
  unimplemented: []                         # R-n ids; non-empty only for kind: test
```

## Kind → required set

Five nodes run for every kind: `inventory`, `packet-scope`, `protected-paths`, `review`, `accept`. `review` gates only while `review.mustRun` is true or the PR carries `protected:unplanned`, so the required sets never list it. A required node that comes back `SKIPPED` makes `accept` `FAIL` (PL-15) ([05 §3](../framework/05-task-packet.md)).

| `kind` | Deliverable | Required `PASS` | `SKIPPED` acceptable when `inventory` reports the empty population |
|---|---|---|---|
| `spec` | `specs/…/SPEC-*.md` at `status: draft` or `approved` | `spec-lint` | code, SQL and test nodes; `spec-tests` |
| `generate` | `domain/<m>/**` from the machine block, `generation-manifest.json`, seed-manifest entry | `generated`, `layout`, `lint`, `typecheck`, `unit`, `sql-lint`, `db-apply`; `route-contract` when `routes[]` is non-empty; `sql-typed` when `queries[]` is non-empty | `spec-tests`, `test-integrity`, `i18n`, `e2e`, `openapi` |
| `test` | the acceptance file, one top-level `it('R-n: …')` per `acceptance: yes` requirement | `spec-tests` (expected red on `observations.unimplemented`), `test-integrity`, `lint-tests`, `typecheck`, `db-apply` | `unit`, `route-contract`, `sql-typed`, `generated`, `openapi`, `integration`, `e2e` only when their population is empty |
| `code` | seed files under `domain/<m>/{api,web}/src/**`, new migrations under `domain/<m>/db/` | `spec-tests`, `unit`, `lint`, `typecheck`, `db-apply`, `permissions-pattern` (cached `PASS` counts); `route-contract` when `routes[]` is non-empty; `sql-typed` when `queries[]` is non-empty | `test-integrity`, `i18n`, `sql-lint`, `generated`, `actionlint`, `e2e` |
| `fix` | a correction against the **unchanged** spec; same shape as `code` | as `code` | as `code` |
| `standards` | `tools/**`, `devai.json`, `eslint.config.*`, `tsconfig*.json`, `.stynxrc.json`, `.agents/**`, `.claude/skills/**`, `AGENTS.md`, `.github/**`, `scripts/**` | `lint`, `typecheck`, `layout`; `actionlint` when the diff touches `.github/**` | `spec-tests`, `route-contract`, `sql-typed`, `db-apply`, `unit`, `integration` by diff and population |

Expected red applies only to `kind: test` with a non-empty `observations.unimplemented` ([D-051](../../decisions.md), S-67). For every other kind, every case must pass.

## Lifecycle (git states only)

| State | Evidence in git |
|---|---|
| `drafted` | The file exists in a working tree only |
| `frozen` | The file is in a commit, complete, and the PL rules pass. `id`, `kind`, `spec.*`, `supersedes` are now immutable (PL-13); `base` may advance (PL-05) |
| `candidate` | Any commit descending from `base` whose message carries `Packet: <id>` |
| `accepted` | `devai check --packet <p> --full` exited 0 at head H, and `.devai/review/<id>.json` bound to H's candidate digest is committed. Nothing is written to the packet |
| `merged` | A commit on `main` carries `Packet: <id>` |
| `superseded` | Another packet at HEAD carries `supersedes: <id>` (PL-16). A successor *spec* does not end a packet ([D-053](../../decisions.md)) |

`devai packets status` prints the derivation ([CLI](./cli.md)).

## PL rules

"Introducing commit" = the first commit that added the packet's path (`git log --diff-filter=A`). "Committed review history" = every version of `.devai/review/<id>.json` in `git log <base>..HEAD` plus the working copy. Messages are printed exactly as below ([05 §5](../framework/05-task-packet.md)). PL-01…03, PL-06, PL-14 and the "does not exist at base" / "not an ancestor" branches of PL-04 and PL-05 run before any other node and stop the command with exit 2.

| # | Rule | Message | Exit | Node |
|---|---|---|---|---|
| PL-01 | Front matter parses; every field has its type and none is blank; no unknown keys; sections in order | `packet invalid: <path>:<line> <yaml error \| unknown field 'x' \| blank 'base' \| missing '## Intent'>` | 2 `packet-invalid` | `packet-scope` |
| PL-02 | `id` matches `^PKT-[A-Z0-9]+-\d{3}$`, equals the file stem, unique under `packets/**` | `packet invalid: id PKT-DEMO-004 is not the file stem / already used by packets/CMP-DEMO-001/…` | 2 `packet-invalid` | `packet-scope` |
| PL-03 | `kind` is one of six; `spec` absent iff `kind: standards`; `spec.sha256` present iff `kind ∉ {spec, standards}`; `observations.unimplemented` empty unless `kind: test` | `packet invalid: kind 'implement' (expected spec\|generate\|test\|code\|fix\|standards)` · `observations.unimplemented is for kind: test only (D-051)` | 2 `packet-invalid` | `packet-scope` |
| PL-04 | Pin (SL10): `spec.path` exists at `base`; `sha256(git show <base>:<path>)` = `spec.sha256`; that blob's `status` is `approved`; the candidate's HEAD bytes hash the same, or (packet introduced at or below `base`) differ only in a status line now reading `superseded-by: <SpecId>` | `spec specs/notes/SPEC-DEMO-001.md does not exist at base 21d6…` (2) · `spec SPEC-DEMO-001 at base is 7b0c… ≠ packet <sha>: the setpoint moved; write a successor packet` · `spec SPEC-DEMO-001 status draft: the pilot approves it; note it under ## Notes and stop` · `spec SPEC-DEMO-001 is superseded-by SPEC-DEMO-002: pin the successor` · `spec SPEC-DEMO-001 edited in the candidate: a spec is a successor, not an edit` | 2 `packet-invalid` · 1 | `packet-scope` |
| PL-05 | `base` is a commit and an ancestor of HEAD; if it differs from the introducing commit's value, the new `base` descends from the old one | `base 21d6… is not an ancestor of HEAD; rebase onto it or run devai packet rebase` (2) · `base moved backwards (introduced 21d6…, now 0a1f…)` (1) | 2 `base-not-ancestor` · 1 | `packet-scope` |
| PL-06 | `paths.allowed` is non-empty and contains the packet's own path; each glob's literal prefix lies under a 04 §1 root folder or names a listed root file | `paths.allowed 'lib/**' is outside the layout root set (04-layout §1)` · `paths.allowed must include this packet (packets/CMP-DEMO-001/PKT-DEMO-004.md)` | 2 `packet-invalid` | `packet-scope` |
| PL-07 | Every changed path (adds, deletes, renames, untracked; `--no-renames`), except `.devai/review/<id>.json`, matches `allowed`; none matches `forbidden`; `generation-manifest.json` changed only when `kind: generate` | `out of scope: apps/api/src/app.module.ts (edit paths.allowed to widen, then re-run)` · `forbidden path touched: domain/notes/api/src/dto/create-note.dto.ts (regenerate or move the logic to a seed)` · `generation-manifest.json changed by a code packet` | 1 | `packet-scope` |
| PL-08 | `protected` ⊇ classes touched (old and new paths) | `protected:acceptance — domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts (packet declares: no)`; the Action adds `protected:unplanned`; `review` gates this PR | none (label) | `protected-paths`, `accept` |
| PL-09 | Each `RV` line parses; its fingerprint prefix resolves to exactly one finding in the committed review history; its `R-n` and locator equal that finding's | `RV ac9f878d7da8 not found in .devai/review/PKT-DEMO-004.json or its history since base: dispositions bind to fingerprints; copy one from the report` · `RV ac9f… ambiguous (2 findings); use a longer prefix` | 1 | `packet-scope` |
| PL-10 | `not-a-defect` claims hold against the **current** review; `accepted-risk` downgrades that fingerprint only, never a deterministic node | `RV ac9f… claimed not-a-defect, finding recurs (basis: observed) → verdict blockers` | 1 when `review` gates; else tallied | `review` |
| PL-11 | Every named `R-n` is an `acceptance: yes` requirement of the pinned spec and appears in its `unimplemented[]`; `--expect-red` with an empty list, or a non-empty list on a kind other than `test`, is an error | `R-9 is not a requirement of SPEC-DEMO-001` · `R-3 is not in SPEC-DEMO-001 unimplemented[]: a test packet may expect red only for cases the spec declares unimplemented` · `--expect-red given but observations.unimplemented is empty` | 1 · 2 `expect-red-nothing-named` | `packet-scope` |
| PL-12 | Each `after` id appears as a `Packet:` trailer in `git log <base>`; `supersedes` names an existing packet | `after: PKT-DEMO-003 is not merged below base 21d6…; advance base with devai packet rebase` | 1, `--full` only | `accept` |
| PL-13 | `id`, `kind`, `spec.*`, `supersedes` equal their values at the introducing commit | `frozen field 'spec.sha256' changed since 9e41…; write a successor packet` | 1 | `packet-scope` |
| PL-14 | `context` entries resolve at `base`, ranges inside the file, bounds kept; the packet is ≤ 200 lines | `context[0] product/demo/rules/RN-DEMO-001.md lines 1-40 exceeds the file (5 lines)` · `packet is 231 lines (limit 200): move prose to the spec or the module README` | 2 `packet-invalid` | `packet-scope` |
| PL-15 | No node in the required set is `SKIPPED` | `required node skipped for kind: code: route-contract (inventory: no mounted routes in domain/notes)`; hint `deliver what the kind requires (05 §3); an empty population means the deliverable is missing` ([D-084](../../decisions.md)) | 1 | `accept` |
| PL-16 | No packet under `packets/**` at HEAD carries `supersedes: <this id>` | `packet PKT-DEMO-004 is superseded by PKT-DEMO-006; work that packet` | 1 | `accept` |
| PL-17 | Spec transitions (SL09, against the blob at `base`): added as `draft`, or `approved` with `approved-by`; `draft → draft`; `draft → approved` with `approved-by`; `approved → superseded-by: <X>` with no other byte changed and `X` in the candidate carrying `supersedes: {id, path, sha256}` where `sha256` is the blob at `base` | `spec SPEC-DEMO-001: illegal transition approved → draft; write a successor` · `spec SPEC-DEMO-001 superseded-by SPEC-DEMO-002 but SPEC-DEMO-002.supersedes.sha256 ≠ blob at base` | 1 | `packet-scope` |

PL-06's root files: `README.md`, `AGENTS.md`, `CLAUDE.md`, `decisions.md`, `devai.json`, `eslint.config.*`, `tsconfig*.json`, `.stynxrc.json`, `compose.yaml`, `vitest.config.ts`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.

By node: `packet-scope` owns 12 (PL-01–07, 09, 11, 13, 14, 17), `accept` 3 (PL-12, 15, 16), `review` 1 (PL-10), `protected-paths`/`accept` 1 (PL-08). `devai packet lint` evaluates all but PL-10, PL-12, PL-15, PL-16, which it prints as `deferred` ([08 A.4](../framework/08-cli-and-nodes.md)). Messages ending in "write a successor" are the only ones the agent cannot act on alone; they go to the pilot through `## Notes`.

## Edits after the freeze

| Edit | Handling | Class touched |
|---|---|---|
| The spec changes by one byte | Successor spec with `supersedes: {id, path, sha256}`; a new packet pins it | `spec` |
| A disposition is added or changed | Amendment of the same packet | `spec` |
| `paths.*`, `context`, `protected` widened or narrowed | Amendment, by pilot or agent | `spec` |
| `base` advanced | `devai packet rebase`; PL-05 and PL-04 re-evaluate | `spec` |
| `observations.unimplemented` changes (`test` packets) | Amendment; visible in the summary line | `spec` |
| `id`, `kind`, `spec.*`, `supersedes` | New packet with `supersedes:` the old one | `spec` |
| An acceptance test is wrong | A `test` packet with `// @acceptance-change: approved-by=` | `acceptance` |
| A business rule changes | Pilot edits `product/`, then a `spec` packet, successor spec, new packet | `product`, `spec` |

Source: [05 §2–§5, §8](../framework/05-task-packet.md), [08 A.4, A.5, B.26, B.28](../framework/08-cli-and-nodes.md), [D-026](../../decisions.md), [D-035](../../decisions.md), [D-050](../../decisions.md)–[D-053](../../decisions.md).
