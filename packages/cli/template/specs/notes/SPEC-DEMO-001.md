# SPEC-DEMO-001 — Tenant notes

## Purpose

Implement the fictional notebook's create-and-retrieve use case, UC-DEMO-001.

## Scope

Two API routes and one table. No update, deletion endpoint, listing, UI,
external integration or background job. Workspace destruction ends data retention.

## Contract

```yaml
id: SPEC-DEMO-001
status: approved
approved-by: DemoPilot
product: demo
module: {name: Notes, slug: notes, namespace: demo_notes}
sources:
  - id: RN-DEMO-001
    path: product/demo/rules/RN-DEMO-001.md
    quote: |-
      A demo member may create a note with a title of 1 to 80 UTF-16 code units and an author alias of 1 to 40 UTF-16 code units.
      Each successful submission creates a distinct note; its identifier retrieves the unchanged title and alias within the same tenant.
      Unknown input fields, null values and values outside these limits are rejected without creating a note.
  - id: RN-DEMO-002
    path: product/demo/rules/RN-DEMO-002.md
    quote: |-
      Only a demo-member with a verified tenant may create or read notes; another tenant's note is indistinguishable from a missing note.
      The author alias is fictional personal data supplied with demo consent and retained only until the disposable workspace is destroyed.
  - id: UC-DEMO-001
    path: product/use-cases/UC-DEMO-001.json
    quote: A valid submission creates one note retrievable only in its tenant.
requirements:
  - id: R-1
    text: Create distinct notes and retrieve their exact contents within the tenant.
    acceptance: "yes"
    observable: >-
      POST the same valid body twice as tenant A: two 201 responses contain different UUIDs,
      each with the submitted title and author_alias. GET each id as A returns 200 and that
      exact object; an application-role query counts exactly two new rows.
    falsifier: A submission is lost or deduplicated, contents change, or GET cannot retrieve either note.
    sources: [RN-DEMO-001, UC-DEMO-001]
  - id: R-2
    text: Accept and persist inputs at the inclusive UTF-16 code-unit bounds.
    acceptance: "yes"
    observable: >-
      Titles of 1 and 80 UTF-16 code units and aliases of 1 and 40 return 201 and persist
      exactly. Include a title of 78 ASCII characters plus one astral character (80 units), and
      an alias of 38 ASCII characters plus one astral character (40 units).
    falsifier: Any boundary-valid body is rejected or stored altered.
    sources: [RN-DEMO-001]
  - id: R-3
    text: Both routes require a verified tenant and demo-member role.
    acceptance: "yes"
    observable: >-
      On both routes, missing or invalid bearer tokens return 401 UNAUTHENTICATED;
      a valid token without demo-member or without verified tenant context returns 403 FORBIDDEN.
      Denied POST requests leave row counts unchanged.
    falsifier: A denied principal reads or creates a note, or denial changes stored data.
    sources: [RN-DEMO-002]
  - id: R-4
    text: A different tenant cannot distinguish a stored note from a missing note.
    acceptance: "yes"
    observable: >-
      Seed one note for A and one for B. As B, GET A's UUID and a fresh missing UUID:
      both return 404 NOT_FOUND with the same messageKey and no note fields.
      As A, GET A's UUID returns 200.
    falsifier: B observes A's contents or existence.
    sources: [RN-DEMO-002, UC-DEMO-001]
  - id: R-5
    text: Reject strict-input violations before persistence.
    acceptance: "yes"
    observable: >-
      A title of 79 ASCII characters plus one astral character (81 units), missing fields,
      null, wrong scalar types, extra fields, empty strings, title length 81, alias length 41,
      malformed path UUID and any query parameter return 400 VALIDATION.
      Rejected submissions leave the row count unchanged.
    falsifier: Any invalid input creates a row or is not answered 400 VALIDATION.
    sources: [RN-DEMO-001]
  - id: R-6
    text: Row-level security isolates tenants for the application role.
    acceptance: "yes"
    observable: >-
      With one seeded note per tenant, querying as demo_app with B context sees only B's row,
      and with A context only A's row.
    falsifier: The application role sees another tenant's row, or isolation is claimed from an empty fixture.
    sources: [RN-DEMO-002, UC-DEMO-001]
routes:
  - method: POST
    path: /notes
    idempotency: {mode: none, reason: Each successful submission creates a distinct note.}
    roles: [demo-member]
    errorContract:
      - {status: 400, code: VALIDATION, messageKey: demo.notes.invalid}
      - {status: 401, code: UNAUTHENTICATED, messageKey: demo.notes.unauthenticated}
      - {status: 403, code: FORBIDDEN, messageKey: demo.notes.forbidden}
      - {status: 503, code: UNAVAILABLE, messageKey: demo.notes.unavailable}
    useCase: UC-DEMO-001
    slo: {metric: http.server.duration, percentile: 95, maxMs: 500}
    request:
      body:
        title: {column: note.title, required: true}
        author_alias: {column: note.author_alias, required: true}
      query: {}
      params: {}
    response: {status: 201, columns: [note.id, note.title, note.author_alias]}
  - method: GET
    path: /notes/:id
    idempotency: {mode: none, reason: Read-only lookup needs no replay cache.}
    roles: [demo-member]
    errorContract:
      - {status: 400, code: VALIDATION, messageKey: demo.notes.invalid}
      - {status: 401, code: UNAUTHENTICATED, messageKey: demo.notes.unauthenticated}
      - {status: 403, code: FORBIDDEN, messageKey: demo.notes.forbidden}
      - {status: 404, code: NOT_FOUND, messageKey: demo.notes.missing}
      - {status: 503, code: UNAVAILABLE, messageKey: demo.notes.unavailable}
    useCase: UC-DEMO-001
    slo: {metric: http.server.duration, percentile: 95, maxMs: 250}
    request:
      body: {}
      query: {}
      params: {id: {column: note.id, required: true}}
    response: {status: 200, columns: [note.id, note.title, note.author_alias]}
data:
  tables:
    - name: note
      primaryKey: [id]
      columns:
        - {name: id, type: uuid, limits: {format: uuid}, nullable: false, default: generated-uuid}
        - {name: tenant_id, type: uuid, limits: {format: uuid}, nullable: false, default: tenant-context}
        - {name: title, type: varchar, limits: {minLength: 1, maxLength: 80}, nullable: false}
        - name: author_alias
          type: varchar
          limits: {minLength: 1, maxLength: 40}
          nullable: false
          pii:
            basis: RN-DEMO-002/demo-consent
            retention: RN-DEMO-002/until-workspace-destruction
queries:
  - name: demo_notes.note.insert
    operation: insert
    table: note
    params: [note.title, note.author_alias]
    returns: [note.id, note.title, note.author_alias]
    expects: one
  - name: demo_notes.note.get
    operation: select-one
    table: note
    params: [note.id]
    returns: [note.id, note.title, note.author_alias]
    expects: zero-or-one
i18n:
  demo.notes.invalid: {en-US: Invalid note request., pt-BR: Pedido de nota inválido.}
  demo.notes.unauthenticated: {en-US: Sign in to use notes., pt-BR: Entre para usar as notas.}
  demo.notes.forbidden: {en-US: You cannot access these notes., pt-BR: Você não pode acessar estas notas.}
  demo.notes.missing: {en-US: Note not found., pt-BR: Nota não encontrada.}
  demo.notes.unavailable: {en-US: Notes are temporarily unavailable., pt-BR: As notas estão temporariamente indisponíveis.}
unimplemented:
  - {requirement: R-1, name: create-and-read}
  - {requirement: R-2, name: strict-inputs}
  - {requirement: R-4, name: tenant-isolation}
```

## Contract notes

POST generates id and takes tenant_id only from verified transaction context.
Inputs are not trimmed or normalized. Successful response objects contain exactly the
declared columns; tenant_id is never exposed. GET has no body and accepts no query fields.
Use demo_app for requests, demo_reader for read-only access, demo_owner only for migrations.
ENABLE and FORCE RLS use app.tenant_id for both visibility and insert checks.

Validate request ID, then bearer authentication, role/tenant, input shape and resource,
in that order. Every request needs a valid
UUIDv7 X-Request-Id; missing/invalid IDs return 400 VALIDATION without persistence.
Errors contain exactly code, messageKey and requestId (null only when the supplied ID is
invalid or absent). Compare cross-tenant errors ignoring their different valid requestIds.
An unavailable database returns 503 UNAVAILABLE, without SQL text or personal data.
Logs redact author_alias and Authorization; errors expose no note contents.
The SLO values are fictional release targets; acceptance checks declarations only.

The two query names bind to defineQuery.name in
domain/notes/api/src/notes.repository.ts. Insert uses the declared parameter order and
returns one row. Lookup binds id, returns zero-or-one, and maps no row to 404 NOT_FOUND.
Both run inside Database.tx(); tenant context is never caller-supplied SQL input.
PII basis and retention identify the exact RN-DEMO-002 sentence; no legal claim is made.

## Acceptance notes

Derive six cases in
domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts:
R-1: create-and-read; R-2: strict-inputs; R-3: role-boundary; R-4: tenant-isolation;
R-5: input-rejection; R-6: rls-visibility.
Use synthetic aliases, two populated tenants, a member in each, and a role-less principal.
Use application-role observations, not owner bypass, to establish isolation.
Reset fixture rows between cases; use valid fresh request IDs except in request-ID tests.
The runtime resolver supplies PostgreSQL in bare or Docker mode; no test chooses Docker.
Only test packets may select R-1, R-2 and R-4 as expected red; R-3, R-5 and R-6 must
stay green. R-3, R-5 and R-6 carry the rail assertions; R-1, R-2 and R-4 contain only
assertions that depend on missing business behavior. Imports, startup and DB setup must succeed.
Code and fix packets select no expected-red cases and require all six cases green.

## Open questions

None.
