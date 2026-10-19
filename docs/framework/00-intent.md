# 00 — Intent (author's own words, 2026-10-17)

Verbatim from Antonio, lightly formatted. This is the setpoint for every other document in
`foundation/`. Drafts that contradict it are wrong; this file is only changed by Antonio.

## Intentions

DEVAI was conceived to help vibe coding our kind of products (web apps: NestJS backend over
PostgreSQL DB behind Angular web apps, and eventually mobile apps) by frontier agents (Codex and
Claude). DEVAI should also provide a company-standard scaffolding along utilities and helpers to
enforce correction, safety and other {code, engineering, product} quality properties.

Its inspiration was modern control theory, where the codebase is the plant to be controlled,
until error is zeroed (output === setpoint; code <== specs).

I feel most of the ceremony and bureaucracy built up in the last weeks are indeed useless, since
new models, like Fable and Astra, are far more capable than their antecessors, and your knowledge
already keeps work on rails, safe and fast. Current DEVAI is broken and stiff: most PRs fail due
to signature mismatches, and corrections that cause further mismatches, like a donkey running to
a tied carrot on a stick.

DEVAI has 2 consumers so far: STYNX, which is a quite large framework library for common
components, actions and behaviors related to our case; and DETRAN, our main product line, which
is being rewritten to attend to the newer, highest security and privacy standards required by our
government.

DEVAI must provide the end user (application architect or engineer) a comfortable way to
implement features, modules, apps, assuring company-standard adherence, with best practices built
in (like: all routes must be secure, token based, ...). DEVAI SHOULD be something between a rail
and a harness. More a helpful hand than a strict auditor.

v3 must allow the 'pilot' to be guided to build specs from intentions and business rules, build
code from specs, build tests from intentions and business rules, and assure, MOST LOCALLY, that
the resultant code matches project standards.

## Adjudications of the assessment's open questions (2026-10-17)

1. **External consumer of the evidence chain / signed RC receipts?** None. Only CI itself
   consumes them.
2. **Of the 319 merged PRs, how many diffs were read rather than ratified?** A few percent.
3. **Headless multi-task rounds under DEVAI vs. under the harnesses?** Undecided; to be discussed.
4. **What did STYNX round R-0001 teach?** It gave the main idea of the plan/campaign/round/task
   hierarchy. It was never repeated.
5. **Defects DEVAI caught that CI + reviewer would have missed?** None; the learning value of the
   adventure is acknowledged instead.
6. **Which failures must v3 withstand?** Reframed by the author as a capability, not a threat
   model: the pilot must be guided from intentions and business rules to specs, from specs to
   code, from intentions and business rules to tests, with local assurance that code matches
   project standards.
7. **CMP-0007's objective?** Keep the write-build-correct cycle at a reasonable pace (a service
   level, not a latency reduction target).
8. **Is Bedel real; does it own mutation testing?** Bedel was spun off from devai/stynx to satisfy
   (7). The author is not sure mutation testing belongs to the development cycle at all.
9. **One agent git identity + path admission table?** Question not understood; to be re-explained.
10. **What does a scorecard change in behavior?** It was intended as both a dashboard and a state
    proxy guiding agents to act on code to reduce error.
11. **What reduction in human attention would justify the change?** On this dimension DEVAI was a
    redundant failure: it consumed all of the author's attention asking for ad-hoc permissions to
    circumvent harnesses it had put in place itself.

## Standing instruction

v3 is a ground-up build from a new spec. v2 is reference material, not a codebase to prune. Do not
frame v3 work as deletion from v2.
