---
title: Rail and harness
sidebar_position: 2
description: What DEVAI 3 owns (packets, specs, acceptance, the rail) and what the agent harnesses own (execution, worktrees, memory, models).
---

# Rail and harness

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

## Two words, two meanings

The author asked for "something between a rail and a harness" ([00](../framework/00-intent.md)), and the
charter makes both words concrete ([01](../framework/01-charter.md), [D-006](../../decisions.md)):

- **The rail** is company-standard scaffolding: the template, the module generator and a few helpers.
  It makes the conforming change the *easiest* change to produce.
- **The harness** is the local check, `devai check`, that keeps the agent's work inside the standards
  and says whether it meets its spec.

The documentation also says "the harnesses" in a second sense: the agent runtimes **Claude Code** and
**Codex CLI**. This page is mostly about the boundary between DEVAI and those.

## The boundary: harnesses execute, DEVAI judges

[D-018](../../decisions.md) chose one execution model out of three: the harnesses execute; DEVAI defines
the packet format and the local acceptance check. DEVAI "never knows a task is running; it knows whether a
result passes" ([D-018](../../decisions.md)). Claude Code, Codex, a subagent, a scheduled or cloud run, or
the pilot may pick up a packet; a packet is just a file ([01](../framework/01-charter.md)).

| DEVAI owns | The harnesses own |
|---|---|
| The task packet format ([05](../framework/05-task-packet.md)) and the technical spec format ([06](../framework/06-spec-format.md)) | Subagents: spec, test and code agents and the reviewer are agent definitions, not DEVAI processes |
| One acceptance rule: `devai check --packet <p> --full` exits 0 ([02 §8](../framework/02-architecture.md)) | Worktrees (one per packet; the sparse worktree for test re-derivation) |
| The 28-node check graph and its report ([02 §2](../framework/02-architecture.md), [08](../framework/08-cli-and-nodes.md)) | Sandboxes and compaction |
| Template, generator, decorators, typed-query contract ([02 §1](../framework/02-architecture.md)) | Native memory: DEVAI neither reads nor writes it ([02 §11](../framework/02-architecture.md)) |
| Four skill texts and `AGENTS.md`, as files ([10](../framework/10-agent-surface.md)) | Loading and running skills; scheduled and cloud runs; MCP (DEVAI ships no server) |
| Choosing which reviewer command to call ([08 A.8](../framework/08-cli-and-nodes.md)) | Model execution for the reviewer and the sensor, on the pilot's machine ([D-037](../../decisions.md)) |

The rule for the right column is: DEVAI ships pointers and configuration, never implementations
([01](../framework/01-charter.md)).

## Why this boundary

v2 carried its own rounds, journal and role identities. By the author's account it consumed all of his
attention "asking for ad-hoc permissions to circumvent harnesses it had put in place itself"
([00](../framework/00-intent.md), adjudication 11). The agent harnesses already provide subagents,
worktrees, sandboxes and memory. So v3 keeps only what it alone defines: the task and a deterministic
answer to "does this result pass?" ([D-018](../../decisions.md), [01](../framework/01-charter.md)).

Consequences you will notice:

- **No scheduler, dispatcher, lock or journal.** If a cross-repository or shared-resource need appears,
  it is a separate small tool built then ([D-018](../../decisions.md)). Two packets worked in parallel
  against one module are not prevented by DEVAI; the harness or the pilot serialises them
  ([02 §11](../framework/02-architecture.md)).
- **Progress lives in git.** A packet is "done" when a merged commit on `main` carries its `Packet:`
  trailer; `devai packets status` prints the derivation ([02 §11](../framework/02-architecture.md),
  [08 A.5](../framework/08-cli-and-nodes.md)). A fresh session rebuilds context from git and the packet;
  losing the cache loses speed only ([02 §11](../framework/02-architecture.md)).
- **One agent identity, no roles.** Agents commit as `<product>-agent` with `Co-Authored-By` and
  `Packet:` trailers; the pilot commits as themself. No check reads the identity to refuse anything
  ([02 §5](../framework/02-architecture.md), [D-019](../../decisions.md)).
- **Nothing binding in memory.** Anything that must bind goes to the packet, the spec or
  `decisions.md` ([02 §11](../framework/02-architecture.md)).
- **Skills once, pointed to.** Skill prose lives in `.agents/skills/`; Claude Code gets symlinks under
  `.claude/skills/`, and there is no `.codex/` folder ([10 §2](../framework/10-agent-surface.md),
  [04 §1](../framework/04-layout.md)).

## A helpful hand, not an auditor

The harness half of DEVAI is also designed not to become a gatekeeper:

- It never asks the pilot for permission to bypass itself, because there is no bypass to grant
  ([01](../framework/01-charter.md)).
- Protected paths label a PR; they never refuse a commit or a push ([D-019](../../decisions.md),
  [02 §5](../framework/02-architecture.md)).
- A missing database or model is an explicit incomplete observation (`UNKNOWN`) with its remedy
  printed, never a request to waive a check ([01](../framework/01-charter.md)).
- The agent's prose budget is small on purpose: every agent-facing file is an executable entry point or
  a repo-specific pitfall, none a reading obligation about governance ([02 §10](../framework/02-architecture.md)).

The rail half does the rest. A generator whose output already passes the whole check graph in both
runtimes means most standards are satisfied by construction before any check runs
([02 §7](../framework/02-architecture.md), [03](../framework/03-standards.md) tags `rail` and `both`).

Source: [00](../framework/00-intent.md), [01](../framework/01-charter.md), [02](../framework/02-architecture.md),
[10](../framework/10-agent-surface.md), [D-006](../../decisions.md), [D-018](../../decisions.md), [D-019](../../decisions.md).
