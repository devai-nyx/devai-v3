---
title: Glossary
sidebar_position: 11
description: Short definitions of the terms DEVAI 3's law uses, each with the document that defines it.
---

# Glossary

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

One or two lines per term, each pointing at the document that defines it. Where a term has a reference page, the page is linked too. 53 terms.

| Term | Meaning | Source |
|---|---|---|
| **accept** | The last node. It derives the required set from the packet `kind`, applies PL-12, PL-15, PL-16, and aggregates every other node's result. Always runs; never cached | [08 B.28](../framework/08-cli-and-nodes.md) |
| **accepted** | A packet state: `devai check --packet <p> --full` exited 0 at head H and `.devai/review/<id>.json` bound to H's candidate digest is committed. Only this run sets `accepted: true` | [05 §4](../framework/05-task-packet.md), [08 A.3](../framework/08-cli-and-nodes.md) |
| **acceptance file** | `domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`, one top-level `it('R-n: …')` per `acceptance: "yes"` requirement. Derived from the spec id, never named in the packet | [04 §4](../framework/04-layout.md), [06 §5](../framework/06-spec-format.md) |
| **after** | Packet field: packets whose `Packet:` trailer must be in `base`'s history. A precondition checked at acceptance (PL-12), not a schedule | [05 §2](../framework/05-task-packet.md) |
| **attach mode** | `devai init` in a directory that already has `devai.json`: writes only the hook scripts and the worktree git config | [08 A.1](../framework/08-cli-and-nodes.md) |
| **bare / docker** | The two runtime modes. Declared in `devai.json` `runtime.mode`; overridden per invocation by `DEVAI_RUNTIME`. A missing service is `UNKNOWN`, never a fallback to the other mode | [02 §6](../framework/02-architecture.md), [D-011](../../decisions.md), [D-034](../../decisions.md) |
| **base** | Packet field: the commit the candidate diff starts from. May advance (`devai packet rebase`), never move back | [05 §2, §4](../framework/05-task-packet.md) |
| **campaign** | A folder `packets/<CMP>/` holding `campaign.md` and the packets of one piece of work, in order | [05 §7](../framework/05-task-packet.md), [D-050](../../decisions.md) |
| **candidate** | The working state being checked; as a packet state, any commit descending from `base` whose message carries `Packet: <id>` | [05 §4](../framework/05-task-packet.md) |
| **candidate digest** | sha256 over the candidate's tracked and untracked entries (excluding `.devai/review/**` and `.devai/cache/**`) and the `base`. Binds the review evidence to the tree | [08 C.6](../framework/08-cli-and-nodes.md), [report.json](./report-json.md) |
| **class A / B / C** | Latency classes: A sub-second, B ≤ 30 s, C minutes. A and B form the edit loop (provisional) | [02 §2](../framework/02-architecture.md), [D-047](../../decisions.md) |
| **deferred** | A node not planned for this invocation. It has no row; `accept` lists it without a status. Not the same as `SKIPPED` | [08 §0](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md) |
| **disposition** | A line under `## Review dispositions`: `RV <fingerprint> · R-n · <locator> · not-a-defect\|accepted-risk · <reason>`. Reaches `review` findings only, never a deterministic node | [05 §2](../framework/05-task-packet.md), [D-035](../../decisions.md) |
| **edit loop** | Running `devai check` without `--full` while editing: the class A/B subset. Placement letter **E** | [08 A.3](../framework/08-cli-and-nodes.md), [02 §2](../framework/02-architecture.md) |
| **expected / observed / evaluated** | The three counts every node reports. `PASS` needs all three equal and greater than 0; `observed < expected` against a complete inventory is `FAIL` | [02 §2](../framework/02-architecture.md), S-65 |
| **expected red** | In a `test` packet only, the named `R-n` cases in `observations.unimplemented` must reach their behavioural assertion and fail there; all other cases stay green | [05 §3](../framework/05-task-packet.md), [D-051](../../decisions.md), S-67 |
| **fingerprint** | `sha256(requirement ‖ locator path ‖ normalised statement)` of a review finding; dispositions cite ≥ 12 leading hex of it | [08 B.27](../framework/08-cli-and-nodes.md), [05 §2](../framework/05-task-packet.md) |
| **frozen** | A derived spec/packet state: a packet pins `base` plus the spec's sha256. Never written into the spec | [D-053](../../decisions.md), [06 §6](../framework/06-spec-format.md) |
| **gating** | Whether a node's status sets the exit code. Every planned node gates except `review` while `review.mustRun` is false and no undeclared protected class is touched. Derived, never stored | [08 A.3, C.2](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md) |
| **generated / seed** | The two ownership modes of generator output. `generated` files are byte-verified and never hand-edited; `seed` files are emitted once and then hand-owned | [02 §7](../framework/02-architecture.md), [D-033](../../decisions.md), S-45 |
| **generation manifest** | `domain/<m>/generation-manifest.json`: the record of a module's generated files, spec digest, options and generator version. Changed only by `generate` packets and by a `standards` upgrade's same-id `--regenerate` ([D-074](../../decisions.md)) | [02 §7](../framework/02-architecture.md), [09 §3](../framework/09-rail.md) |
| **harness** | Two senses. DEVAI is "a rail and a harness": local checks keep the agent inside the standards ([D-006](../../decisions.md)). Agent harnesses (Claude Code, Codex, …) execute tasks; DEVAI defines packets and acceptance ([D-018](../../decisions.md)) | [D-006](../../decisions.md), [D-018](../../decisions.md) |
| **hook stage** | `devai check --hook pre-commit\|pre-push\|commit-msg`, called from the scripts in `scripts/hooks/`. Not a command of its own | [08 A.7](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md) |
| **inventory** | The first node. Builds every population and decides `SKIPPED` for every other node, with evidence | [08 B.1](../framework/08-cli-and-nodes.md), [D-044](../../decisions.md) |
| **kind** | Packet field: `spec`, `generate`, `test`, `code`, `fix` or `standards`. Selects the required set | [05 §2, §3](../framework/05-task-packet.md), [D-026](../../decisions.md) |
| **machine block** | The one fenced `yaml` block under a spec's `## Contract`; closed keys, consumed by the generator and the nodes | [06 §2](../framework/06-spec-format.md), [Spec format](./spec-format.md) |
| **materialise mode** | `devai init` in a directory with no `devai.json`: emits the template and makes two commits | [08 A.1](../framework/08-cli-and-nodes.md), [09 §1](../framework/09-rail.md) |
| **mounted route** | A route reachable from an app's root module through static `imports`/`controllers` arrays, as `inventory` computes it. A dynamic module factory is `UNKNOWN: mount-unresolved` | [08 Part B, B.1](../framework/08-cli-and-nodes.md), [D-058](../../decisions.md) |
| **node** | One check in the fixed graph of 28. Each has a contract in 08 Part B | [02 §2](../framework/02-architecture.md), [Check nodes](./nodes.md) |
| **packet** | One Markdown file `packets/<CMP>/PKT-<PRODUCT>-<nnn>.md`: the pilot's statement of a task's intent, scope and acceptance, frozen at `base` | [05 §1](../framework/05-task-packet.md), [Packet format](./packet-format.md) |
| **`Packet:` trailer** | The commit trailer `Packet: PKT-<PRODUCT>-nnn` linking commits to a packet; "done" is a trailer on `main` | [02 §5, §11](../framework/02-architecture.md) |
| **pilot** | The person who states intent and business rules, approves specs, reads the error state and decides rare dispositions. Never asked to waive a check | [01](../framework/01-charter.md) |
| **pinning kinds** | `generate`, `test`, `code`, `fix`: the kinds whose packet carries `spec.sha256` | [08 A.4](../framework/08-cli-and-nodes.md), [05 §2](../framework/05-task-packet.md) |
| **PL rule** | One of the 17 packet rules PL-01…PL-17, evaluated by `packet-scope`, `accept`, `review` and `protected-paths` | [05 §5](../framework/05-task-packet.md) |
| **placement** | Where a node runs: **E** edit loop, **C1** pre-commit (staged), **P** pre-push, **R** PR, **F** full acceptance | [02 §2](../framework/02-architecture.md) |
| **population** | The repository set a node applies to, computed globally by `inventory`. An empty population is the only evidence for `SKIPPED` | [02 §2](../framework/02-architecture.md), [08 Part B](../framework/08-cli-and-nodes.md) |
| **preflight** | The first phase of every `devai check` and the last step of `devai init`: resolving every tool a node needs. A missing tool is `UNKNOWN: tooling-missing`. There is no `devai doctor` | [08 A.6](../framework/08-cli-and-nodes.md), [D-029](../../decisions.md) |
| **protected class** | One of seven path classes (`spec`, `product`, `decisions`, `standards`, `infra`, `ci`, `acceptance`). Touching one labels the PR; it never refuses | [02 §5](../framework/02-architecture.md), [D-019](../../decisions.md), [D-046](../../decisions.md) |
| **`protected:unplanned`** | The PR label added when a touched class is not in the packet's `protected` list. It makes `review` gating for that PR | [02 §5](../framework/02-architecture.md), [05 §5](../framework/05-task-packet.md) PL-08 |
| **rail** | Company-standard scaffolding, helpers and practice built in: the template, the generator, the decorators. A rail-tagged standard is satisfied by construction | [D-006](../../decisions.md), [03](../framework/03-standards.md), [09](../framework/09-rail.md) |
| **reason code** | One of 54 closed values saying why something could not run or could not be observed | [08 C.2](../framework/08-cli-and-nodes.md), [Reason codes](./reason-codes.md) |
| **required set** | The nodes that must `PASS` for a packet's `kind`; a required node `SKIPPED` is an `accept` `FAIL` (PL-15) | [05 §3](../framework/05-task-packet.md) |
| **review** | The independent-reviewer node: a model of the other family, two phases (blind, then candidate), run on the pilot's machine and digest-verified in CI | [02 §9](../framework/02-architecture.md), [08 B.27](../framework/08-cli-and-nodes.md), [D-028](../../decisions.md), [D-037](../../decisions.md) |
| **scratch database** | `devai_<digest12>`, created by `db-apply` for one run and dropped after its last consumer (kept in the edit loop); named by a descriptor under `.devai/cache/scratch/` | [08 B.20](../framework/08-cli-and-nodes.md) |
| **sensor** | `permissions-pattern`: a model used as a narrow, no-tools check of the S-12 permission slice; its verdict is cached and travels as tracked evidence | [02 §4](../framework/02-architecture.md), [08 B.24](../framework/08-cli-and-nodes.md), [D-009](../../decisions.md) |
| **setpoint** | The approved technical spec a packet pins by path and digest | [06 §1](../framework/06-spec-format.md), [05 §1](../framework/05-task-packet.md) |
| **SKIPPED** | A status decided only by `inventory`, when a node's population is empty, printed with the predicate as evidence | [D-044](../../decisions.md), [08 §0](../framework/08-cli-and-nodes.md) |
| **SL rule** | One of the 12 spec rules SL01…SL12, run by `spec-lint` (SL09, SL10 and SL11 membership by `packet-scope`) | [06 §4](../framework/06-spec-format.md) |
| **spec** | A technical specification `specs/<area>-<capability>/SPEC-*.md`: prose plus one machine block. Distinct from business specs in `product/` | [06](../framework/06-spec-format.md), [D-008](../../decisions.md), [D-027](../../decisions.md) |
| **status** | One of `PASS`, `FAIL`, `UNKNOWN`, `SKIPPED`. Exit codes: FAIL → 1; UNKNOWN without FAIL → 2 | [02 §8](../framework/02-architecture.md) |
| **successor spec** | A new spec with `supersedes: {id, path, sha256}`; the predecessor's status line becomes `superseded-by: <SpecId>`. Old packets keep their pin | [D-053](../../decisions.md), [06 §6](../framework/06-spec-format.md) |
| **tallied** | `review`'s verdict when it does not gate: counted against dispositions and reported, exit code untouched | [08 B.27](../framework/08-cli-and-nodes.md), [D-028](../../decisions.md) |
| **worker family** | `claude` or `gpt`, read from the `Co-Authored-By` trailers of `base..HEAD`. The reviewer must be the other family; equal or unknown is `UNKNOWN: family` | [08 B.27](../framework/08-cli-and-nodes.md), [02 §9](../framework/02-architecture.md) |

Source: [01](../framework/01-charter.md), [02](../framework/02-architecture.md), [03](../framework/03-standards.md), [04](../framework/04-layout.md), [05](../framework/05-task-packet.md), [06](../framework/06-spec-format.md), [08](../framework/08-cli-and-nodes.md), [09](../framework/09-rail.md), [decisions.md](../../decisions.md).
