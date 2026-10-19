---
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
---

## Intent
The six acceptance requirements of SPEC-DEMO-001 have one case each, derived from the spec
alone; R-1, R-2 and R-4 fail at their behavioural assertion, R-3, R-5 and R-6 pass.

## Deliverables
- `domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts`: one top-level
  `it('R-n: …')` for each of R-1 to R-6.
