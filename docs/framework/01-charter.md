# 01 — Charter

Consolidated 2026-10-18 from both round-1 drafts under D-001…D-040; binding on the Owner's review.

## What v3 is

[opinion] DEVAI v3 is a **rail and a harness** for building NestJS / Angular / PostgreSQL applications
in one monorepo with frontier coding agents, to company standards (D-006). The rail is a template, a
module generator and a few helpers that make the standard-conforming change the easiest change to
produce. The harness is one local command, `devai check`, whose report says whether the current
change is inside the standards and meets its spec, fast enough to sit in the agent's edit–check loop
(D-005). v3 defines two file formats, the **task packet** and the **technical spec**, and **one
acceptance rule: a packet is accepted when `devai check --packet <p> --full` exits 0**; the
independent review is a node inside that command, not a second condition. Everything else belongs to
the harness or to git.

## What v3 is not

Not a scheduler, dispatcher, journal, lock or round controller (D-018). Not an evidence chain or
attestation system (D-002). Not a constitution agents must read, nor roles that refuse writes by
identity (D-003, D-019). Not an auditor: it never asks the pilot for permission to bypass itself,
because it has no bypass to grant (adjudication 11). Not a replacement for STYNX tooling: where a
STYNX lint, tsconfig or linter enforces a standard, v3 invokes the published package (D-029,
03-standards Part C). STYNX is governed by v3, not governing (D-007).

## The loop

```
        business spec + rules (product/)          pilot: intent, rules, approval
                     │
            spec agent derives
                     ▼
   ┌──────── technical spec (frozen) ────────┐        setpoint
   │                                         │
   │ test agent derives                      │ code agent reads
   ▼                                         ▼
acceptance tests ──┐                 ┌──── code (plant) ◄── agent edits (actuator)
(sensor, spec-     │                 │          ▲
 derived)          ▼                 ▼          │ fix
             devai check --packet  ──────────► error report (per node, locators)
             (deterministic checks + spec tests + review)   controller = the agent
                     │ exit 0
                     ▼
        PR: labels, ten-line summary, review.json
                     │
                     ▼
        pilot reads the dashboard; merge
```

[opinion] The loop is at task level. The setpoint is a technical spec derived from the business spec
and rules, frozen for the task by digest. The sensors are tests derived from the spec by an agent that
did not write the code, deterministic standards checks, and an independent reviewer of a different
model family that derives its expectations from the spec before it opens the candidate. The plant is
the code; the controller is the coding agent in its own edit–check–fix loop; the actuator is its
edits; the error is what `devai check` reports for the current change. A zero residual means the
declared observations succeeded, not that correctness has been proved. Above the loop there is a
dashboard, not another loop. Independence comes from derivation source and sequencing, not from role
identities (D-003, D-019, D-035; packet granularity per D-026, provisional).

## What the pilot does

1. **States intent and business rules**, in `product/` (D-008), and answers the spec agent's open
   questions.
2. **Approves the technical spec** by annotation in the artifact (`status: approved`,
   `approved-by:`), which freezes the setpoint for every packet that cites it (D-016). A changed
   setpoint is a successor spec and a new packet.
3. **Reads the error state**: PR summary, labels, reviewer findings; decides the rare dispositions on
   reviewer findings (D-035); records binding choices in `decisions.md` (D-031).

**Approval records intent; it does not turn a failing check green.** A missing database or an
unavailable model is an explicit incomplete observation with its remedy printed, never a request to
waive DEVAI (D-003, D-006).

## What the pilot is never asked

Permission to run a check, to commit, to push, to widen a boundary, to bypass a hook, to re-pin a
digest, to repair a signature mismatch, to ratify a diff as a substitute for observation, to pick a
role, or to confirm a mechanically derivable fact. If v3 ever asks one of these, that is a defect in
v3 (adjudication 11).

## Delegated to the harnesses, by name

Claude Code and Codex CLI own: **subagents** (spec agent, test agent, code agent and reviewer are
agent definitions, not v3 processes), **worktrees** (one per packet; the sparse worktree for test
re-derivation, D-035), **sandboxes**, **compaction**, **native memory** (v3 neither reads nor writes
it), **skills** (four `SKILL.md` files under `.agents/skills/`), **scheduled and cloud runs** (a packet
is a file; anything may pick it up), **model execution** for the reviewer and the S-12 sensor on the
pilot's machine (D-037), and **MCP** (v3 ships no server). v3 ships pointers and configuration, never
implementations (D-018).

## Success criterion

In the author's terms: a comfortable way to implement features, modules and apps with the standards
built in, where active human attention goes to intent, business rules, specs and error state, not to
administration. Measurably, on the first DETRAN module built with `kind:` packets (D-026): approved
spec to merged PR with the agent's mandatory reading under 3k tokens beyond spec and packet; an
edit-loop check cheap enough to run after every edit (service level measured on that module, then
fixed; 02 §14); zero permission prompts from v3; zero diffs the pilot must read to trust the merge;
and the generator's own output passing the full check DAG in both runtimes before the generator
ships (03b §3, D-039).
