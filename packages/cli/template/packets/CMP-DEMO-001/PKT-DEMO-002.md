---
id: PKT-DEMO-002
title: Generate the notes module from SPEC-DEMO-001
kind: generate
spec:
  id: SPEC-DEMO-001
  path: specs/notes/SPEC-DEMO-001.md
  sha256: "12e9041f6e1637b7e3a55d7e2626b11725381b40f8d5392e32458f6233f7f30a"
base: 21d61edec29f34e42b023ff787610d692c29a6be
after: [PKT-DEMO-001]
paths:
  allowed:
    - domain/notes/**
    - database/seed/**
    - apps/api/package.json
    - apps/api/src/app.module.ts
    - apps/api/tsconfig.json
    - apps/web/package.json
    - apps/web/src/app/app.routes.ts
    - apps/web/tsconfig.json
    - .stynxrc.json
    - pnpm-lock.yaml
    - docs/framework/contracts/**
    - packets/CMP-DEMO-001/PKT-DEMO-002.md
protected: [spec, standards, acceptance]
observations:
  unimplemented: []
---

## Intent
`domain/notes` exists as `devai new module --spec specs/notes/SPEC-DEMO-001.md` writes it,
mounted in `apps/api`, with its SQL listed in `database/seed/modules.txt`.

## Deliverables
- `domain/notes/**` and `generation-manifest.json` from the generator, unedited.
- Routes `POST /notes` and `GET /notes/:id` mounted: `@demo/notes-api` in
  `apps/api/package.json`, `DemoNotesModule` in `apps/api/src/app.module.ts` imports,
  `{ "path": "../../domain/notes/api" }` in `apps/api/tsconfig.json` `references`.
- `.stynxrc.json`: `domain/notes/api/src` in `apiCoverage.sourceRoots`, `domain/notes` in
  `publicApi.packageRoots`.
- `pnpm-lock.yaml` and `docs/framework/contracts/**` from `pnpm install` and the write pairs.
