---
id: PKT-DEMO-001
title: Write the tenant notes spec SPEC-DEMO-001
kind: spec
spec:
  id: SPEC-DEMO-001
  path: specs/notes/SPEC-DEMO-001.md
base: 21d61edec29f34e42b023ff787610d692c29a6be
paths:
  allowed:
    - specs/notes/**
    - packets/CMP-DEMO-001/PKT-DEMO-001.md
protected: [spec]
observations:
  unimplemented: []
---

## Intent
SPEC-DEMO-001 states the tenant notes capability of RN-DEMO-001, RN-DEMO-002 and
UC-DEMO-001, approved by the pilot.

## Deliverables
- `specs/notes/SPEC-DEMO-001.md`, approved: R-1 to R-6, routes `POST /notes` and
  `GET /notes/:id`, table `note`, queries `demo_notes.note.insert` and `demo_notes.note.get`.
