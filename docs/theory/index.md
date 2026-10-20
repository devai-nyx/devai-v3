---
title: Theory
sidebar_position: 1
description: Why DEVAI 3 is shaped the way it is — the control loop, the division of labour with the harnesses, and the restraint behind it.
---

# Theory

DEVAI's inspiration is control theory: the codebase is the plant, the technical spec is the setpoint,
and the work is done when the error is zero ([00](../framework/00-intent.md), [01](../framework/01-charter.md)).
These pages explain the design choices that follow from that frame and from the lessons of v2. They
are explanation, not law; every claim links to the document that binds it.

| Page | Question it answers |
|---|---|
| [Rail and harness](rail-and-harness.md) | What does DEVAI own, and what do Claude Code and Codex own? |
| [The loop](the-loop.md) | How does intent become an accepted, merged change? |
| [The check graph](check-graph.md) | What runs when, and why is `UNKNOWN` never `PASS`? |
| [Review and sensor](review-and-sensor.md) | How can a model check a model's work without becoming a rubber stamp? |
| [Restraint](restraint.md) | What does DEVAI deliberately not build, and why? |
| [DEVAI and STYNX](stynx.md) | How does DEVAI relate to the STYNX framework library? |

## The frame in one table

| Control term | DEVAI 3 | Source |
|---|---|---|
| Setpoint | The approved technical spec, frozen for the task by digest | [01](../framework/01-charter.md), [D-053](../../decisions.md) |
| Plant | The code | [01](../framework/01-charter.md) |
| Controller | The coding agent, in its own edit–check–fix loop | [01](../framework/01-charter.md) |
| Actuator | The agent's edits | [01](../framework/01-charter.md) |
| Sensors | Spec-derived acceptance tests, deterministic standards checks, the independent reviewer | [01](../framework/01-charter.md) |
| Error | What `devai check` reports for the current change | [01](../framework/01-charter.md), [D-005](../../decisions.md) |
| Above the loop | A dashboard (PR labels, summary, review), not another loop | [01](../framework/01-charter.md), [02 §5](../framework/02-architecture.md) |

A zero residual means the declared observations succeeded, not that correctness has been proved
([01](../framework/01-charter.md)).

Source: [00](../framework/00-intent.md), [01](../framework/01-charter.md), [decisions.md](../../decisions.md).
