<!-- Consolidated 2026-10-18 from agents/consolidate-2 (Fable draft, Astra cross-review, D-050–D-054). Spec digest substituted by orchestrator from 06 NOTES: 10035 bytes. -->
# 05 — Task packet

Final · Claude Fable 5.1 · consolidation 2 · 2026-10-18. Fits `02-architecture.md` (§2 DAG, §5
protected paths, §7 generator, §8 acceptance, §9 reviewer, §11 state) under D-001…D-054; D-026
(`kind:` packets) and D-047 are provisional. Node names are exactly the twenty-eight of 02 §2. Tags
`[fact]` / `[inference]` / `[opinion]` appear in the prose only, never inside fixture bytes (D-054).
Every example uses the fictional product `demo`, module `notes` (D-048); the spec it cites is 06's
`specs/notes/SPEC-DEMO-001.md`.

## 1. Purpose

[opinion] The packet is the pilot's statement of *this task's* intent, scope and acceptance, frozen
at `base`: which spec is the setpoint (by path and digest), which paths the change may touch, which
protected classes it plans to touch, and, for a `test` packet only, which acceptance cases are
expected red. It is one Markdown file under `packets/<CMP>/` (D-027, D-050), the only input to
`devai check --packet <p>`, and the only prose the pilot writes per task besides the spec (02 §1). It
carries no execution state: no status, assignee, run id or timestamp (D-018); everything about
*progress* is derived from git (02 §11). [fact] Its lineage is v2's `TASK-*.md` prompt (title,
steps, boundary, deliverables, acceptance command;
`devai:product/campaigns/CMP-0007-gate-throughput/prompts/TASK-0711.md:1-4,12,30,36,42`), minus
role, round, wave, tier, time budget and commit families, which D-003, D-018 and D-019 remove.

## 2. Schema

One YAML front-matter block, closed (unknown keys are rejected), followed by named Markdown sections.
Consumers are 02 §2 nodes; "dashboard" is the `--summary` line and the PR body (02 §8).

| Field | Type | Req. | Consumer | Meaning |
|---|---|---|---|---|
| `id` | `PKT-<PRODUCT>-<nnn>` | yes | all, dashboard | D-050. Equals the file stem; unique under `packets/**`; the `Packet:` commit trailer (02 §5) |
| `title` | string ≤ 80 chars | yes | dashboard, `review` | Imperative, one line |
| `kind` | `spec · generate · test · code · fix · standards` | yes | `accept`, `packet-scope`, `spec-tests` | Selects the required set (§3). D-026 provisional |
| `spec.id` | `SPEC-<PRODUCT>-<nnn>` | yes unless `kind: standards` | `packet-scope`, `spec-tests`, `review`, dashboard | The setpoint; for `kind: spec` the spec this packet writes |
| `spec.path` | repo path | same | `packet-scope`, `review` | `specs/<area>-<capability>/SPEC-*.md` (04 §1, D-054). For `kind: spec` it is the *output* path |
| `spec.sha256` | 64 lowercase hex | yes unless `kind ∈ {spec, standards}` | `packet-scope`, `spec-tests`, `review` (cache key, 02 §9) | `sha256` of the spec file's bytes at `base`. Recording it is the pin; `frozen` is derived from it (D-053) |
| `base` | 40 hex commit | yes | `packet-scope`, `protected-paths`, `accept` | The commit the candidate diff is computed from (D-026). May advance, never move back (§4, PL-05) |
| `after` | list of packet ids | no | `accept` (on `--full`) | Packets whose `Packet:` trailer must be in `base`'s history; makes D-026 sequencing checkable |
| `supersedes` | packet id | no | dashboard, `accept` | The packet this one replaces (§4, PL-16). Not the spec's `supersedes` (06 §6) |
| `paths.allowed` | list of globs, ≥ 1 | yes | `packet-scope` | Everything the candidate may change, including the packet's own path. Globs are gitignore-style, rooted at the repo |
| `paths.forbidden` | list of globs | no | `packet-scope`, agent | Overrides inside `allowed` (D-052): a changed path matching `forbidden` fails even if `allowed` matches it. The explicit "don't" for the paths the agent is most likely to reach for |
| `protected` | subset of `spec product decisions standards infra ci acceptance` | yes, may be `[]` | `protected-paths`, Action, `accept`, dashboard | Classes this packet *plans* to touch (02 §5). A touched class not listed → `protected:unplanned` → `review` gates this PR |
| `context[]` | `{ path, lines: "a-b", why }` | no | agent, `review` | Bounded pointers, not quotes: ≤ 8 entries, ≤ 40 lines each, ≤ 200 lines total, resolved at `base`. The spec is never listed here; it is read whole |
| `observations.unimplemented` | list of `R-n` | yes, may be `[]` | `spec-tests` (`--expect-red`, 02 §8), `accept`, dashboard | Non-empty only for `kind: test` (D-051). Each id is an `acceptance: yes` requirement that appears in the spec's `unimplemented[]` under `requirement:` (06); `spec-tests` applies expected red to exactly these cases |

Markdown sections, in this order; headings are literal:

| Section | Req. | Reader | Content |
|---|---|---|---|
| `## Intent` | yes | agent, `review` | ≤ 5 lines: what is true when the packet is done, in the pilot's words |
| `## Deliverables` | yes | agent, `review` | Bullets naming `R-n` ids, routes and files this packet realises; no node names (the required set is derived, §3) |
| `## Notes` | no | agent, pilot | ≤ 10 lines of task-specific pitfalls; the agent may append findings here (a spec defect, a wrong test) |
| `## Review dispositions` | no | `packet-scope`, `review` | One line per disposition: `RV <fingerprint> · R-n · <locator> · not-a-defect\|accepted-risk · <reason>` (D-035; `fixed` dropped, D-074). `fingerprint` is ≥ 12 leading hex of a finding's `fingerprint` in `.devai/review/<packet-id>.json` (02 §9, §11); never a sequential id; never overrides a deterministic node |

**Who writes what.** The pilot writes `title`, `## Intent`, `protected`, and the dispositions.
`protected` is read at the packet's introducing commit (PL-08, D-078): a class not declared there is
unplanned for every PR of the packet, whoever widens the field later. The
spec agent, when it drafts a campaign, proposes `paths.*`, `context`, `## Deliverables` and, for a
`test` packet, `observations.unimplemented` from the spec's `unimplemented[]`; `devai packet new
--spec <path> --kind <k>` renders `id`, `spec.sha256`, `base`, the packet's own path under `allowed`
and the layout-derived default globs for the kind. The coding agent may amend `paths.allowed`,
`context`, `base` (forward only, §4) and `## Notes` (02 §10) and may write a `not-a-defect`
disposition; `accepted-risk` is the pilot's word (02 §9). [opinion] Nothing in the front matter
needs judgment the pilot would rather not give: every mechanical field is rendered, every judgment
field is short.

**Not fields, and why.** `workerFamily` / `reviewFamily`: v3 never knows who picks up a packet
(D-018); the worker family is read from `Co-Authored-By` trailers at review time, equal or unknown
family is `review: UNKNOWN` (02 §9). `must-run`: derived from `kind` (§3); a per-packet node list is
the "per-packet node allowlist" 02 §8 forbids. `review: off`: there is no such switch (02 §8).
`status`, `assignee`, `started`, `finished`, run ids, worktree path: execution state, which D-018
puts in the harness and D-002 says nobody consumes; "done" is a `Packet:` trailer on `main` (02 §11).
`budget` / `effort` / `model`: the harness's. `acceptance.command`: always
`devai check --packet <this file> --full`; writing it down would invite variants. `depends-on` as a
scheduling list: replaced by `after`, which is a precondition checked at acceptance, not a schedule.
`tests`: the acceptance file is derived from the spec id
(`domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`, 04 §4, D-054), so 02 §2's
"named in the packet" is satisfied by derivation, not by a field.

```yaml
# Skeleton (front matter only; see §7 for a complete packet)
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

## 3. Kind → required set

[opinion] `--full` runs every applicable node (02 §8); `inventory` decides `SKIPPED` with evidence
that is a **repository population predicate** for that node (D-044, D-054): `no mounted routes in
domain/<m>`, `no Angular app`, `no changed *.sql`, `no acceptance file for SPEC-x`. The spec's empty
collections are never that evidence; absence of changed source never proves a global population
irrelevant (02 §2 rule f). The `kind` adds one rule: `accept` derives a **required set** from three
inputs it already has, the `kind`, the spec's machine block and the diff, and a required node that
comes back `SKIPPED` is a `FAIL` (`required node skipped for kind: <kind>: <node> (<inventory
evidence>)`), because for that kind an empty population means the deliverable is missing, not
inapplicable. The conditions below are part of the derivation, so PL-15 never sees a conditional.

Five nodes run for every kind: `inventory`, `packet-scope`, `protected-paths`, `review`, `accept`.
**Running is not gating.** `review` sets the exit code only while `review.mustRun` is `true` in
`devai.json` (02 §6 sample, D-028) or the PR carries `protected:unplanned` (02 §5); otherwise its
verdict is tallied against dispositions and reported, and the required sets below never list it. Its
phase-1 input is the pinned spec and resolved sources for kinds that pin one, the business sources without the candidate spec for `kind: spec`, and
the cited standards without the diff for `kind: standards`; phase 2 opens the candidate (06 §5; 08 B.27).

| `kind` | Deliverable | Required `PASS` (derived; `SKIPPED` ⇒ `accept` FAIL) | `SKIPPED` acceptable when `inventory` reports the empty population |
|---|---|---|---|
| `spec` | `specs/…/SPEC-*.md` at `status: draft` or `approved`; approval is the pilot's annotation (01 Charter), in the same PR or after the merge | `spec-lint` | code, SQL and test nodes (`no changed *.ts`, `no changed *.sql`, `no changed test/**`); `spec-tests` (`no acceptance file for <spec id>`) |
| `generate` | `domain/<m>/**` from the spec's machine block, `generation-manifest.json`, seed-manifest entry (D-023) | `generated`, `layout`, `lint`, `typecheck`, `unit` (seed unit specs), `sql-lint`, `db-apply`; `route-contract` when the spec's `routes[]` is non-empty; `sql-typed` when `queries[]` is non-empty | `spec-tests` (`no acceptance file for <spec id>`; the generator emits `acceptance/.gitkeep` only, 02 §7); `test-integrity` (`no changed test/**`); `i18n` (`no opted-in locale beyond en-US and no Angular app`); `e2e`, `openapi` (`no test/e2e files`, `no app binding changed`) |
| `test` | `domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`, one top-level `it('R-n: …')` per `acceptance: yes` requirement (S-63, 06 §5) | `spec-tests` (expected red on `observations.unimplemented`), `test-integrity`, `lint-tests`, `typecheck`, `db-apply` | `unit`, `route-contract`, `sql-typed`, `generated`, `openapi`, `integration`, `e2e` only when their population is empty (`no affected project`, `no mounted routes in domain/<m>`, …); with a populated module they run and a cached `PASS` from `base` stands |
| `code` | seed files under `domain/<m>/{api,web}/src/**`, new migrations under `domain/<m>/db/` | `spec-tests`, `unit`, `lint`, `typecheck`, `db-apply`, `permissions-pattern` (cached `PASS` counts); `route-contract` when `routes[]` is non-empty; `sql-typed` when `queries[]` is non-empty | `test-integrity` (`no changed test/**`), `i18n`, `sql-lint` (`no changed *.sql`), `generated` (`no changed @generated file or manifest`), `actionlint` (`no changed .github/**`), `e2e` |
| `fix` | a correction against the **unchanged** spec; same shape as `code` | as `code` | as `code` |
| `standards` | `tools/**`, `devai.json`, `eslint.config.*`, `tsconfig*.json`, `.stynxrc.json`, `.agents/**`, `.claude/skills/**`, `AGENTS.md`, `.github/**`, `scripts/**`; an **upgrade** (D-074) also bumps `package.json`, `pnpm-lock.yaml`, `apps/*/package.json` and each module's decorators pin, and runs same-id `--regenerate` on every module | `lint`, `typecheck`, `layout`; `actionlint` when the diff touches `.github/**`; `generated` when it touches `domain/**` or a `package.json`; `unit`, `db-apply`, `integration` when it touches a `package.json` or `pnpm-lock.yaml` | `spec-tests`, `route-contract`, `sql-typed`, `db-apply`, `unit`, `integration` by diff and population |

[inference] No node list is read from the packet, so a packet cannot shrink its own acceptance (02
§8: no per-packet allowlist); and because the spec's `routes[]`/`queries[]` enter the derivation
rather than the `SKIPPED` evidence, a spec that declares routes while `inventory` finds none mounted
in `domain/<m>` is exactly the case PL-15 reports.

**Expected red is for `test` packets only** (02 §8, D-051, S-67). When `kind: test` and
`observations.unimplemented` is non-empty, the runner applies `--expect-red` to exactly those `R-n`
cases of `spec-tests`: collection, imports, start-up and DB setup must succeed; each named case must
reach its behavioural assertion and fail there; every other case, including rail-provided behaviour
(guards, RLS), stays green. The report line reads
`PASS spec-tests expected 6, observed 6, expect-red 3 (R-1, R-2, R-4)`. For every other kind the
list is empty and every case must pass; partial delivery is a smaller spec or a successor packet,
never a red case accepted. The command-line flag is accepted as an explicit statement and must agree
with the packet (PL-11). The fixture's `test` packet:

```yaml
id: PKT-DEMO-003
title: Derive the acceptance tests of SPEC-DEMO-001
kind: test
spec: { id: SPEC-DEMO-001, path: specs/notes/SPEC-DEMO-001.md, sha256: "12e9041f6e1637b7e3a55d7e2626b11725381b40f8d5392e32458f6233f7f30a" }
base: 21d61edec29f34e42b023ff787610d692c29a6be
after: [PKT-DEMO-002]
paths:
  allowed: [domain/notes/api/test/acceptance/**, packets/CMP-DEMO-001/PKT-DEMO-003.md]
  forbidden: [domain/notes/api/src/**]
protected: [acceptance, spec]
observations:
  unimplemented: [R-1, R-2, R-4]     # the spec's unimplemented[]; R-3, R-5, R-6 are rail behaviour and stay green
```

## 4. Lifecycle, as git states only

| State | Evidence in git (nothing else) |
|---|---|
| **drafted** | The file exists in a working tree only. `devai packet new --spec <path> --kind <k>` renders `base`, `spec.sha256` and the defaults; a file with either blank is PL-01 invalid, so it never reaches a commit |
| **frozen** | The file is in a commit, complete, and §5 passes. From here `id`, `kind`, `spec.*` and `supersedes` are immutable (PL-13); `base` may advance (PL-05). [opinion] Commit packets to `main` before work starts (one small pilot PR, label `protected:spec`); in-branch authoring is allowed, carries that label, and puts the packet's own path in the candidate diff, which is why `allowed` always lists it |
| **candidate** | Any commit descending from `base` whose message carries `Packet: <id>` (02 §5). Many candidates per packet are normal |
| **accepted** | `devai check --packet <p> --full` exited 0 at head H; `.devai/review/<id>.json` bound to H's candidate digest is committed in the branch (02 §9, §11). Nothing is written to the packet. CI re-verifies the digest |
| **merged** | A commit on `main` carries `Packet: <id>` (02 §11); `devai packets status` prints the derivation |
| **superseded** | Another packet at HEAD carries `supersedes: <id>` (PL-16). Only this ends a packet: a successor **spec** does not; an old packet keeps hashing `git show <base>:<path>` and still accepts against its pinned setpoint (D-053), while no new packet may pin the superseded spec (PL-04) |

[inference] Acceptance leaves two files behind, neither in the packet: `report.json` in
`.devai/cache/reports/` (ignored) and `.devai/review/<id>.json` in the branch, both keyed to the
candidate digest (02 §8, §9); the review file is excluded from that digest and from `packet-scope`
so writing it cannot invalidate itself (D-054). A later commit changes the digest (except one that only adds or changes `.devai/review/**`, which is excluded from the candidate digest — D-058), the review goes
`UNKNOWN (stale)` in CI, and the agent re-runs `--full`; nothing is repaired by hand (02 §11 item 2).
A packet therefore has no "accepted" bit to flip back; the state is wherever the head is.

**Why `base` advances.** A campaign may land as one branch with `--full` exiting 0 at each packet
head (02 §8). The diff of `PKT-DEMO-004` must then start where `PKT-DEMO-003` was accepted, or the
acceptance tests land inside a `code` packet's diff and fail PL-07. So `devai packet rebase <p> --to
<commit>` rewrites `base` under two conditions PL-05 checks: the new commit descends from the old
`base`, and the spec blob there still hashes to `spec.sha256`. The pin is the digest; `base` is
where it is looked up and where the diff starts. The edit is an amendment, visible as
`protected:spec`.

Edits after the freeze:

| Edit | Handling | Protected class touched |
|---|---|---|
| The spec changes by one byte | Successor spec with `supersedes: {id, path, sha256}`; predecessor's status line becomes `superseded-by: <SpecId>` (D-053); a **new packet** pins the successor. Existing packets are unaffected | `spec` (both specs, the packet) |
| A disposition is added or changed | Amendment of the same packet; the next `--full` re-observes (D-035) | `spec` (`packets/**`, 02 §11 item 1) |
| `paths.*`, `context`, `protected` widened or narrowed | Amendment of the same packet, by pilot or agent (02 §10); the hook line and PR body show it. A widened `protected` does not reach PL-08 until it is on `main`: the rule reads the introducing commit (D-078) | `spec` |
| `base` advanced | `devai packet rebase`; PL-05 and PL-04 re-evaluate | `spec` |
| `observations.unimplemented` grows or shrinks (`test` packets) | Amendment; the summary line reads `spec tests: 6/6 requirements covered, 3 expected red (R-1, R-2, R-4)` so the change is visible | `spec` |
| `id`, `kind`, `spec.*`, `supersedes` | New packet with `supersedes:` the old one | `spec` |
| An acceptance test is wrong | A `test` packet with `// @acceptance-change: approved-by=` (S-63); never the `code` packet | `acceptance` |
| A business rule changes | Pilot edits `product/`, then a `spec` packet, successor spec, new packet (D-008, D-016) | `product`, `spec` |

[opinion] "Amendment" is the only in-place edit v3 recognises, and every amendment is visible as a
`protected:spec` touch, which is the whole audit trail the packet needs (D-002).

## 5. `packet-lint` rules

Not a node (D-045). The rules are the preconditions `packet-scope` and `accept` evaluate before and
after the DAG; each names its node. Exit codes are 02 §8's: `2` when the command could not run
(invalid packet, unresolvable input; `reason` in `report.json`), `1` for a demonstrated violation.
"Introducing commit" is the first commit that added the packet's path (`git log --diff-filter=A`).
"Committed review history" is every version of `.devai/review/<id>.json` in `git log <base>..HEAD`
plus the working-tree copy. `packet-scope` executes 06's SL09 and SL10 here because it alone has
`base` (D-054).

| # | Rule | Message (one line, as printed) | Exit | Node |
|---|---|---|---|---|
| PL-01 | Front matter parses, every field has its §2 type and no field is blank, no unknown keys, sections in order | `packet invalid: <path>:<line> <yaml error \| unknown field 'x' \| blank 'base' \| missing '## Intent'>` | 2 `packet-invalid` | `packet-scope` |
| PL-02 | `id` matches `^PKT-[A-Z0-9]+-\d{3}$` (D-050), equals the file stem, unique under `packets/**` | `packet invalid: id PKT-DEMO-004 is not the file stem / already used by packets/CMP-DEMO-001/…` | 2 `packet-invalid` | `packet-scope` |
| PL-03 | `kind` is one of the six; `spec` absent iff `kind: standards`; `spec.sha256` present iff `kind ∉ {spec, standards}`; `observations.unimplemented` empty unless `kind: test` | `packet invalid: kind 'implement' (expected spec\|generate\|test\|code\|fix\|standards)` · `observations.unimplemented is for kind: test only (D-051)` | 2 `packet-invalid` | `packet-scope` |
| PL-04 | Pin (kinds with `spec.sha256`; SL10): `spec.path` exists at `base`; `sha256(git show <base>:<path>)` = `spec.sha256`; that blob's `status` is `approved`; the candidate's bytes at HEAD hash the same, or, for a packet introduced at or below `base`, differ from the blob only in a status line now reading `superseded-by: <SpecId>` (D-053's one permitted edit, printed as a notice) | `spec specs/notes/SPEC-DEMO-001.md does not exist at base 21d6…` (2) · `spec SPEC-DEMO-001 at base is 7b0c… ≠ packet <sha>: the setpoint moved; write a successor packet` · `spec SPEC-DEMO-001 status draft: the pilot approves it; note it under ## Notes and stop` · `spec SPEC-DEMO-001 is superseded-by SPEC-DEMO-002: pin the successor` · `spec SPEC-DEMO-001 edited in the candidate: a spec is a successor, not an edit` | 2 `packet-invalid` · 1 | `packet-scope` |
| PL-05 | `base` is a commit and an ancestor of HEAD; if it differs from the introducing commit's value, the new `base` descends from the old one | `base 21d6… is not an ancestor of HEAD; rebase onto it or run devai packet rebase` (2) · `base moved backwards (introduced 21d6…, now 0a1f…)` (1) | 2 `base-not-ancestor` · 1 | `packet-scope` |
| PL-06 | `paths.allowed` is non-empty and contains the packet's own path; each glob's literal prefix lies under a 04 §1 root folder or names a root file 04 §1/§4 or a `devai.json` protected class lists (`README.md`, `AGENTS.md`, `CLAUDE.md`, `decisions.md`, `devai.json`, `eslint.config.*`, `tsconfig*.json`, `.stynxrc.json`, `compose.yaml`, `vitest.config.ts`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`) | `paths.allowed 'lib/**' is outside the layout root set (04-layout §1)` · `paths.allowed must include this packet (packets/CMP-DEMO-001/PKT-DEMO-004.md)` | 2 `packet-invalid` | `packet-scope` |
| PL-07 | Every changed path (adds, deletes, renames, untracked; `--no-renames`), except `.devai/review/<id>.json`, matches `allowed`; none matches `forbidden` (`forbidden` wins inside `allowed`, D-052); `generation-manifest.json` changed only when `kind: generate`, or `kind: standards` where every changed `domain/**` path is a module's `api/package.json`, its manifest or a `mode: generated` entry of it (an upgrade, D-074) (02 §7) | `out of scope: apps/api/src/app.module.ts (edit paths.allowed to widen, then re-run)` · `forbidden path touched: domain/notes/api/src/dto/create-note.dto.ts (regenerate or move the logic to a seed)` · `generation-manifest.json changed by a code packet` | 1 | `packet-scope` |
| PL-08 | `protected` **at the introducing commit** ⊇ classes touched (02 §5 globs, old and new paths); an in-branch widening is itself undeclared (D-078) | `protected:acceptance — domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts (packet declares: no)`; the Action adds `protected:unplanned`; `review` gates this PR | none (label) | `protected-paths`, `accept` |
| PL-09 | Each `RV` line parses; its fingerprint prefix resolves to exactly one finding in the committed review history; the line's `R-n` and locator equal that finding's | `RV ac9f878d7da8 not found in .devai/review/PKT-DEMO-004.json or its history since base: dispositions bind to fingerprints; copy one from the report` · `RV ac9f… ambiguous (2 findings); use a longer prefix` | 1 | `packet-scope` |
| PL-10 | `not-a-defect` claims hold against the **current** review: the finding is absent or contradicted by `basis: observed` evidence; `accepted-risk` downgrades that fingerprint only and never a deterministic node (D-035) | `RV ac9f… claimed not-a-defect, finding recurs (basis: observed) → verdict blockers` | 1 when `review` gates; else tallied in `review.json` | `review` |
| PL-11 | Every named `R-n` is an `acceptance: yes` requirement of the spec at `spec.sha256` and appears in its `unimplemented[]` under `requirement:` (06); `--expect-red` given with an empty list, or a non-empty list on a kind other than `test`, is an error | `R-9 is not a requirement of SPEC-DEMO-001` · `R-3 is not in SPEC-DEMO-001 unimplemented[]: a test packet may expect red only for cases the spec declares unimplemented` · `--expect-red given but observations.unimplemented is empty` | 1 · 2 `expect-red-nothing-named` | `packet-scope` |
| PL-12 | Each `after` id appears as a `Packet:` trailer in `git log <base>`; `supersedes` names an existing packet | `after: PKT-DEMO-003 is not merged below base 21d6…; advance base with devai packet rebase` | 1, `--full` only | `accept` |
| PL-13 | `id`, `kind`, `spec.*`, `supersedes` equal their values at the introducing commit | `frozen field 'spec.sha256' changed since 9e41…; write a successor packet` | 1 | `packet-scope` |
| PL-14 | `context` entries resolve at `base`, ranges inside the file, bounds of §2 kept; the packet is ≤ 200 lines | `context[0] product/demo/rules/RN-DEMO-001.md lines 1-40 exceeds the file (5 lines)` · `packet is 231 lines (limit 200): move prose to the spec or the module README` | 2 `packet-invalid` | `packet-scope` |
| PL-15 | No node in the required set (§3) is `SKIPPED` | `required node skipped for kind: code: route-contract (inventory: no mounted routes in domain/notes)` | 1 | `accept` |
| PL-16 | No packet under `packets/**` at HEAD carries `supersedes: <this id>` | `packet PKT-DEMO-004 is superseded by PKT-DEMO-006; work that packet` | 1 | `accept` |
| PL-17 | Spec transitions (SL09, bounded to the blob at `base`): for every `specs/**` file in the candidate diff, the change is one of: added as `draft`, or as `approved` with `approved-by`; `draft → draft`; `draft → approved` with `approved-by`; `approved → superseded-by: <X>` with no other byte changed and `X` present in the candidate carrying `supersedes: {id, path, sha256}` where `sha256` is the blob at `base` | `spec SPEC-DEMO-001: illegal transition approved → draft; write a successor` · `spec SPEC-DEMO-001 superseded-by SPEC-DEMO-002 but SPEC-DEMO-002.supersedes.sha256 ≠ blob at base` | 1 | `packet-scope` |

Every message is a locator plus a remedy, in the style of 02 §8's report: the agent reads the line
and acts; no rule is explained in prose because the rule *is* the line. Messages that end in "write a
successor" are the only ones the agent cannot act on alone; they go to the pilot through `## Notes`.

Rules PL-01…PL-03, PL-06, PL-14, and the "does not exist at base" / "not an ancestor" branches of
PL-04 and PL-05 run before any other node and stop the command (`exit 2`, `accepted: false`,
`reason`); every other rule is a finding like any other node's and coexists with the rest of the
report. A digest mismatch is a violation (`1`), never "could not run".

## 6. Agent-facing surface

`.agents/skills/devai-task/SKILL.md`, loaded on invocation only (02 §10). The shipped text is 10 §2.1 (344 tokens by 08's proxy); the block below is the round-2 source it revises.

```markdown
---
name: devai-task
description: Work one DEVAI task packet (packets/**/PKT-*.md) through the check loop to acceptance.
---
# devai-task

Read, in this order, and nothing else is required: the packet; the spec at `spec.path`
(whole file); each `context` entry at the given lines; `domain/<m>/README.md` if it exists.

## Loop
1. `devai check --packet <packet>` — the edit-loop subset plus packet scope and the
   packet's acceptance tests. Read the report top-down: failing nodes first, each
   finding has a locator, a one-line hint and the standard id. Fix, save, re-run.
2. Stay inside `paths.allowed`; `paths.forbidden` wins inside it. If the task needs a
   path outside, edit `paths.allowed` in the packet and continue; the PR gets
   `protected:spec`, nobody is asked for permission.
3. `devai check --packet <packet> --full` when the subset is green. Exit 0 accepts.
   Exit 1: fix the FAIL lines. Exit 2: something could not be observed; the line
   names the remedy (start Postgres, install tooling, configure a reviewer). Never
   work around a 2 by disabling a node; there is no switch for that.
4. If `after:` is not merged below `base`, run `devai packet rebase <packet> --to
   <commit>`; the digest must not change. Then re-run.
5. Commit with `Packet: <id>` as a trailer; one Conventional Commit scope per commit.

## What you do not do
- Edit `domain/*/api/test/acceptance/**` from a `code` or `fix` packet. A red
  acceptance test you did not write is a result; if it is wrong, say so under
  `## Notes` and stop — a `test` packet fixes it.
- Edit a file with a `@generated` header; regenerate or move the logic to a seed.
- Change the spec, `generation-manifest.json`, `decisions.md`, or another packet.
- In a `test` packet, make an `R-n` under `observations.unimplemented` pass: it is
  expected red and must reach its assertion and fail there. In every other kind the
  list is empty and every case must pass.
- Touch `.devai/review/` or `.devai/cache/`.

## Review findings
`--full` runs an independent reviewer of the other model family. A finding is a
locator plus a counterexample. Fix it, or if it is wrong write one line under
`## Review dispositions` as `RV <fingerprint> · R-n · <locator> · not-a-defect · why`
(fingerprint from `.devai/review/<id>.json`, 12+ hex). `accepted-risk` is the
pilot's word, not yours.

## Runtime
Checks run bare by default; `DEVAI_RUNTIME=docker devai check …` runs them in Docker.
Keep both green. A missing service is `UNKNOWN` with its start command, never a
reason to skip.

## When to stop
Exit 0 on `--full`, or a spec defect you cannot resolve (write it under `## Notes`,
leave the packet unaccepted). Do not edit `observations.unimplemented` to get green
without saying so in `## Notes`.
```

## 7. Example: `packets/CMP-DEMO-001/PKT-DEMO-004.md`

The campaign folder as `devai init` ships it: `campaign.md` (goal, business sources, the four packet
ids in order), `PKT-DEMO-001` (`spec`, wrote `SPEC-DEMO-001`; complete, since the approved spec is in
the template commit, whose message carries `Packet: PKT-DEMO-001`), `PKT-DEMO-002` (`generate`),
`PKT-DEMO-003` (`test`, §3), `PKT-DEMO-004` (`code`, below). `devai init` commits the template first,
then renders the packets with `base` = that commit and commits them (`chore(packets): seed
CMP-DEMO-001`). `spec.sha256` is the digest of the shipped `specs/notes/SPEC-DEMO-001.md` (06 NOTES);
`base` below is an illustrative sha1, not a real commit. The file ships without the
`## Review dispositions` section; the line shown is how a disposition looks after a review round,
with an illustrative fingerprint. Module slug, requirement ids and route table come from 06's
fixture; the packet quotes none of it (D-008, D-048).

```markdown
---
id: PKT-DEMO-004
title: Implement note creation and retrieval (R-1, R-2, R-4)
kind: code
spec:
  id: SPEC-DEMO-001
  path: specs/notes/SPEC-DEMO-001.md
  sha256: "12e9041f6e1637b7e3a55d7e2626b11725381b40f8d5392e32458f6233f7f30a"
base: 21d61edec29f34e42b023ff787610d692c29a6be
after: [PKT-DEMO-002, PKT-DEMO-003]
paths:
  allowed:
    - domain/notes/api/src/**
    - domain/notes/api/test/*.spec.ts
    - packets/CMP-DEMO-001/PKT-DEMO-004.md
  forbidden:
    - domain/notes/api/src/dto/**          # @generated: regenerate, never edit
    - domain/notes/api/src/index.ts
    - domain/notes/api/src/notes.module.ts
    - domain/notes/api/test/acceptance/**
protected: [spec]                      # this file: amendments and dispositions
context:
  - { path: product/demo/rules/RN-DEMO-001.md, lines: "1-5", why: "the limits behind R-2; counted in UTF-16 code units" }
  - { path: domain/notes/api/src/notes.repository.ts, lines: "1-40", why: "defineQuery seeds from PKT-DEMO-002; fill the bodies, keep the names" }
observations:
  unimplemented: []
---

## Intent
A demo member can create a note and read it back by id inside the member's tenant;
another tenant sees a stored note and a missing note as the same 404. Every route
carries its contract; the acceptance tests from PKT-DEMO-003 go from red to green.

## Deliverables
- R-1, R-2, R-4 of SPEC-DEMO-001 implemented in `notes.service.ts`,
  `notes.repository.ts`, `notes.controller.ts` (seed files from PKT-DEMO-002). R-3 is
  rail behaviour from the generated guards and stays green.
- Routes `POST /notes` and `GET /notes/:id` as the spec's route table states; both
  carry `@NoIdempotent()`, `@RequireRoles(['demo-member'], 'all')`, `@ErrorContract`,
  `@UseCase('UC-DEMO-001')`, `@Slo`.
- `demo_notes.note.insert` and `demo_notes.note.get` as `defineQuery` in
  `notes.repository.ts`; argument limits `max(80)` and `max(40)`, equal to the columns'.
- Unit tests in `test/notes.service.spec.ts` for the zero-row → 404 mapping.

## Notes
- String limits are UTF-16 code units: zod `max`, the generated check and `sql-typed`
  all read `.length`. Do not add a code-point refinement.
- A cross-tenant id and an unknown id must produce byte-identical 404 bodies except
  `requestId`; RLS hides the row, the service maps zero rows to `demo.notes.missing`.

## Review dispositions
RV ac9f878d7da8 · R-4 · domain/notes/api/src/notes.service.ts:41 · not-a-defect · the reviewer expected 403 for another tenant's id; R-4's observable requires 404 with the same messageKey as a missing note, which the acceptance case R-4 observes
```

What `--full` prints for it when green, abridged (02 §8 summary form; the digest is shortened):

```
PKT-DEMO-004  Implement note creation and retrieval (R-1, R-2, R-4)   spec SPEC-DEMO-001 @ ‹digest›… (frozen)
acceptance: PASS (28 nodes: 26 pass, 2 skipped: sql-lint[no changed *.sql], actionlint[no changed .github/**])   runtime: bare
protected paths: spec (packets/CMP-DEMO-001/PKT-DEMO-004.md, declared)   packet scope: ok   spec tests: 6/6 requirements covered
review: no blockers (1 disposed: not-a-defect R-4; mustRun: false, tallied)   worker: claude   reviewer: gpt   bound to head 9e41…
```

On a fresh template, `devai check --packet packets/CMP-DEMO-001/PKT-DEMO-002.md --full` reports
`required node skipped for kind: generate: generated (inventory: no generation-manifest.json under
domain/)`, and PKT-DEMO-003 and PKT-DEMO-004 report their `after:` unmet: the correct reading of a
template whose campaign has not started.

## 8. What the packet is not

- Not a prompt: it names no model, role, tier, effort or time (D-018, D-019); the harness's skill
  file says how to work it (§6).
- Not a status record: no field changes as work proceeds except amendments the pilot or agent
  makes deliberately and visibly (§4).
- Not a waiver: it cannot disable a node, lower a threshold, accept a deterministic finding, or
  accept a red case outside a `test` packet (D-051); `accepted-risk` reaches `review` findings only
  (D-035, 02 §8).
- Not a spec: it quotes no business rule and carries no requirement text; `context` points, the spec
  states (D-008, D-048).
- Not a schedule: `after` is checked at acceptance, nothing dispatches on it (D-018).
- Not evidence: `report.json` and `.devai/review/<id>.json` are; the packet is their input (D-002).

## 9. Closed in consolidation 2

The seven round-2 questions are closed: id grammar by D-050; the tracked review path and its
exclusion from the candidate digest by D-054; `frozen` as a derived state by D-053; `forbidden` as an
override by D-052; partial delivery in `code` packets rejected by D-051; the 200-line bound kept
(PL-14) as the only mechanical guard on 02 §10's packet budget; and `devai init` ships all four
packets (§7). Two consolidation rulings made here, reversible by the Owner: `base` advances forward
under PL-05, and `after` is checked against `git log <base>`, which together are what let a campaign
land as one branch (02 §8). Nothing is open.
