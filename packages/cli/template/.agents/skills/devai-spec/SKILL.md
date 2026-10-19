---
name: devai-spec
description: Derive or revise a DEVAI technical spec (specs/**/SPEC-*.md) from business rules and use cases in product/. Use for kind: spec packets.
---
# devai-spec

Write the file at the packet's `spec.path`. Copy the shape of
`specs/notes/SPEC-DEMO-001.md`. `devai check --packet <packet>` runs `spec-lint`;
each SL line names the field to fix.

## Sources
- `quote` is copied byte for byte from the file at `path`: never paraphrase, never
  cite an id you have not opened. Quote the obligation, not the document.
- Behaviour no source states is an open question, not a requirement. `product/` is
  the pilot's; do not edit it.

## Requirements
- One `R-n` per testable obligation. `acceptance: "yes"` needs an `observable`
  (concrete inputs, exact expected response or row count) and a `falsifier`.
- Rail behaviour (401/403, tenant isolation, DTO validation) is its own `R-n`,
  never mixed into a business requirement.
- `unimplemented[]` lists the acceptance requirements whose observable needs code
  the generator does not write; rail requirements are never listed.
- Every route has all five contract fields. You propose SLO, error codes and
  idempotency; the pilot approves them with the spec.

## Approval
Write `status: draft` and `approved-by: null`. Approval is the pilot's edit; never
write `approved` or a name. An approved spec never changes: write a successor with
a new id and `supersedes: {id, path, sha256}`; the predecessor's one permitted edit
is `status: "superseded-by: <new id>"`.
