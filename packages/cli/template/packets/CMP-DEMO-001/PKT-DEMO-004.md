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
  - { path: domain/notes/api/src/notes.repository.ts, why: "defineQuery seeds from PKT-DEMO-002; fill the bodies, keep the names" }
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
  rail behaviour from the shell's guards and stays green (D-123).
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
