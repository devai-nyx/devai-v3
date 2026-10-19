# CMP-DEMO-001 — Tenant notes

Goal: a demo member creates a note and reads it back by id inside the member's tenant
(SPEC-DEMO-001, module `domain/notes`).

Business sources: `product/demo/rules/RN-DEMO-001.md`, `product/demo/rules/RN-DEMO-002.md`,
`product/use-cases/UC-DEMO-001.json`.

Packets, in order:
1. PKT-DEMO-001 — spec: write SPEC-DEMO-001
2. PKT-DEMO-002 — generate: `domain/notes` from SPEC-DEMO-001
3. PKT-DEMO-003 — test: the acceptance tests of SPEC-DEMO-001
4. PKT-DEMO-004 — code: note creation and retrieval
