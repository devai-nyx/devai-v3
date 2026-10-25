---
title: Writing a spec
sidebar_position: 2
description: How a spec agent derives a technical spec from business rules, and how the pilot approves, freezes and succeeds it.
---

# Writing a spec

The technical spec is the **setpoint**: the one file every later packet is checked against. A `spec`
packet derives it from the business rules and use cases in `product/`; you approve it; every packet
that pins it freezes its exact bytes ([06 §1](../framework/06-spec-format.md)).

## Who does what

| You (pilot) | The spec agent |
|---|---|
| Write business rules and use cases in `product/` ([D-008](../../decisions.md)) | Reads them; never edits `product/` ([10 §2.2](../framework/10-agent-surface.md)) |
| Answer open questions | Lists behaviour no source states as an open question, not a requirement |
| Approve: `status: approved`, `approved-by: <you>` ([01 Charter](../framework/01-charter.md)) | Writes `status: draft` and `approved-by: null`; never writes `approved` or a name |

Approval is an annotation in the artifact, checked mechanically ([D-016](../../decisions.md)).
The transition rule PL-17 accepts a `draft → approved` edit mechanically, whoever makes it, so
only the skill's instruction keeps approval yours ([10 §2.2](../framework/10-agent-surface.md)).

## Where it lives and what it contains

One Markdown file, `specs/<slug>/SPEC-<PRODUCT>-<nnn>.md`; the fixture is
`specs/notes/SPEC-DEMO-001.md` ([04 §1](../framework/04-layout.md), [D-054](../../decisions.md)). It
has five required human sections — **Purpose**, **Scope**, **Contract notes**, **Acceptance notes**,
**Open questions** — and exactly one fenced `yaml` block under `## Contract`
([06 §1–§2](../framework/06-spec-format.md)). Approval requires no unresolved open questions.

The machine block is closed YAML 1.2: unknown keys, duplicate keys, aliases and custom tags are
rejected, and `"yes"`/`"no"` are quoted strings, never booleans
([06 §2](../framework/06-spec-format.md)). Its top-level keys:

| Key | What you declare |
|---|---|
| `id`, `status`, `approved-by`, `supersedes?` | Identity and lifecycle |
| `product`, `module` | `module.name`, `module.slug` (the `domain/<slug>` folder), `module.namespace` (the SQL schema) |
| `sources` | Each rule or use case cited, with an exact `quote` |
| `requirements` | `R-n` entries with `text`, `acceptance`, `observable`, `falsifier`, `sources` |
| `routes` | Method, path and the five contract fields: `idempotency`, `roles`, `errorContract`, `useCase`, `slo` |
| `data`, `queries` | Tables with typed, bounded columns; named queries (`insert` or `select-one`) |
| `i18n` | Every message key, in every configured locale |
| `unimplemented` | Acceptance requirements whose observable needs code the generator does not write |

Do not put execution status, timestamps, node selections or dispositions in the block
([06 §2](../framework/06-spec-format.md)). Copy the shape of the shipped fixture rather than writing
from the schema ([10 §2.2](../framework/10-agent-surface.md)).

## Sources: quote, never paraphrase

Each `quote` is an exact substring of the source file's bytes. `spec-lint` rule SL02 fails a missing
artifact, id or verbatim quote ([06 §4](../framework/06-spec-format.md)). Quote the obligation, not
the whole document, and never cite an id you have not opened. This rule exists because an early draft
invented a rule under a real id ([D-048](../../decisions.md)).

Quoting proves provenance, not that the requirement follows from the quote. That judgment belongs to
the independent reviewer ([06 §4](../framework/06-spec-format.md)).

## Requirements: one testable obligation each

An `acceptance: "yes"` requirement needs an `observable` (concrete inputs, exact expected response
or row count) and a `falsifier` (SL03). From the fixture:

```yaml
  - id: R-4
    text: A different tenant cannot distinguish a stored note from a missing note.
    acceptance: "yes"
```

Its observable names the seeding, the two GETs and the matching 404 bodies; its falsifier is
"B observes A's contents or existence" ([06 §7](../framework/06-spec-format.md)).

**Keep rail behaviour in its own requirement.** Authentication and role denials, tenant isolation
and DTO validation are what the generated code already provides. Give them their own `R-n` and
never mix them into a business requirement ([10 §2.2](../framework/10-agent-surface.md),
[D-058](../../decisions.md)). In the fixture, R-3 (401/403), R-5 (input rejection) and R-6 (RLS)
are rail; R-1, R-2 and R-4 are business ([D-064](../../decisions.md)).

**List `unimplemented[]` carefully.** It names the acceptance requirements a `test` packet may
expect red: the ones whose observable needs code the generator does not write. Rail requirements
are never listed. The fixture lists R-1, R-2 and R-4
([06 §5, §7](../framework/06-spec-format.md)). The list is a frozen vocabulary of eligible
behaviour, not a progress tracker.

**Routes.** Every route carries all five contract fields (SL04). The agent proposes the SLO, error
codes and idempotency; you approve them with the spec ([10 §2.2](../framework/10-agent-surface.md)).
String limits count UTF-16 code units ([D-054](../../decisions.md)).

## Checking a spec

The spec is delivered by a `kind: spec` packet whose `spec.path` is the output path
([05 §2](../framework/05-task-packet.md)). Run:

```sh
devai check --packet packets/<CMP>/<PKT>.md
```

It runs `spec-lint`, which is the required node for `kind: spec`
([05 §3](../framework/05-task-packet.md)). Each finding is an `SL` line naming the field to fix, for
example `acceptance <R>: observable and falsifier required`
([06 §4](../framework/06-spec-format.md)). SL09–SL11 (status transitions, digest pin,
`unimplemented` membership) run in `packet-scope`, because only it knows `base`
([D-054](../../decisions.md)).

## After approval: frozen, then succeeded

Approved content never changes. `frozen` is never written in the file: a spec is frozen because a
packet pins its `base` commit and its SHA-256 ([D-053](../../decisions.md)).

To change an approved spec, write a **successor**:

1. A new spec with a new id and `supersedes: {id, path, sha256}` naming the predecessor's approved
   bytes.
2. The predecessor's one permitted edit: its status line becomes
   `status: "superseded-by: <new id>"`. Every other byte stays identical.
3. A new packet pins the successor.

`packet-scope` checks both directions of the pair (PL-17, SL09). Old packets keep accepting against
their pinned bytes; no new packet may pin a superseded spec
([05 §4–§5](../framework/05-task-packet.md), [06 §6](../framework/06-spec-format.md)). A business
rule change starts in `product/`, then a `spec` packet and a successor
([05 §4](../framework/05-task-packet.md)).

Source: [05](../framework/05-task-packet.md), [06](../framework/06-spec-format.md),
[10 §2.2](../framework/10-agent-surface.md), [D-008, D-016, D-048, D-053, D-054, D-058, D-064](../../decisions.md).
