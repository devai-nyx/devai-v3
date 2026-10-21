<!-- Consolidated 2026-10-18 from agents/consolidate-2 (Astra draft, Fable cross-review, D-050–D-054). Embedded SPEC-DEMO-001 body: 10035 bytes, sha256 12e9041f6e1637b7e3a55d7e2626b11725381b40f8d5392e32458f6233f7f30a (verified by orchestrator). -->
# 06 — Technical specification format

Final consolidation 2 · GPT-6 Astra · 2026-10-18 · aligned with D-001–D-054 and amended 02/04.

Citation prefix `stynx:` means `/Volumes/Development/projects/stech/stynx/`; other source paths are workspace-relative.

## 1. Purpose and reading boundary

[inference] The technical spec is the **setpoint**: a `spec` packet derives it from business rules and use cases in `product/`; the pilot approves it, and subsequent packets freeze its complete bytes. One Markdown file under `specs/<module.slug>/` (the module slug is 04 §1's `<area>-<capability>`, the same folder name as `domain/<slug>/`) carries human explanation and one machine block, consumed by the module generator (rail), `spec-lint`, `route-contract`, `spec-tests`, and the independent reviewer in phase 1. This realizes `foundation/00-intent.md:13–14,32–34`, `foundation/01-charter.md:50–66`, D-008/D-027 and `foundation/02-architecture.md:319–325,463–469`.

[opinion] Sections 2–6 are the implementer's contract; agents normally read only the instantiated spec in §7. Inherited obligations are cited; proposed details are tagged. The specimen is fictional design data, not a deployed product. Required human sections are **Purpose**, **Scope**, **Contract notes**, **Acceptance notes**, **Open questions**. They explain choices and boundary cases. Approval requires no unresolved questions. Contradictory prose is a reviewer finding, not something a parser can reliably settle.

## 2. Machine block

[opinion] Under `## Contract`, exactly one fenced `yaml` block, YAML 1.2, closed keys at every object level. Reject duplicate keys, aliases, custom tags and implicit coercions; quote `"yes"`/`"no"`. The following is typed schema notation, not a second blueprint or a sample spec. `?` marks optional; every other field is required. `T[]` permits empty lists unless marked `+`; maps have unique keys. All consumers use the same validated parse. No execution status, timestamps, node selection or packet dispositions belong here.

<!-- schema-example:start -->
```yaml
# Contract schema notation; G=generator, L=spec-lint, C=route-contract,
# T=spec-tests, V=review phase 1. L validates every field; V receives all.
id: SpecId                              # string /^SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$/; G,L,C,T,V
status: WrittenStatus                  # draft | approved | "superseded-by: <SpecId>"; G,L,T,V
approved-by: NonemptyString|null        # non-null for approved/superseded-by; L,V
supersedes?:                           # backward reference paired with forward status; L,V
  id: SpecId
  path: RepoPath                       # specs/**, exact predecessor file
  sha256: Hex64
product: Slug                          # lowercase kebab; G,L,C,T,V
module:                                # G,L,C,T,V
  name: PascalCase                     # unprefixed name; generator adds product prefix
  slug: Slug                           # destination domain/<slug>
  namespace: SqlIdentifier              # lowercase snake, non-reserved
sources:                               # +; L,T,V
  - id: RuleId|UseCaseId                # RN-<PRODUCT>-nnn | UC-<PRODUCT>-nnn
    path: RepoPath                     # existing product/** rule or use-case artifact
    quote: NonemptyString              # exact substring of decoded UTF-8 source bytes
requirements:                          # +; L,T,V
  - id: RequirementId                  # string /^R-[1-9][0-9]*$/; local to spec
    text: NonemptyString
    acceptance: "yes|no"               # enum of strings "yes", "no", never booleans
    observable: NonemptyString|null     # non-null when acceptance=yes
    falsifier: NonemptyString|null      # non-null when acceptance=yes
    sources: SourceId[]+                # references to sources[].id
routes:                                # G,L,C,T,V
  - method: GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS
    path: AbsoluteRoutePath            # includes mounted prefix; :name parameters
    idempotency:                       # one tagged union
      mode: none|key
      reason?: NonemptyString          # required for none; no other none keys
      header?: NonemptyString          # required for key
      ttlMs?: PositiveInteger          # required for key; key has no reason
    roles: Slug[]+                     # all required; RequireRoles(roles, 'all')
    errorContract:                     # +; inline, no unresolved contract names
      - status: Integer400To599
        code: UpperSnakeIdentifier
        messageKey: I18nKey
    useCase: UseCaseId
    slo:
      metric: http.server.duration
      percentile: Integer1To99
      maxMs: PositiveInteger
    request:                           # strict object at each boundary
      body: Map<InputName,InputBinding>
      query: Map<InputName,InputBinding>
      params: Map<InputName,InputBinding>
    response:
      status: Integer200To299
      columns: ColumnRef[]+             # exact object projection; column names as JSON keys
data:                                  # G,L,T,V; also sql-typed limits, sql-lint PII
  tables:
    - name: SqlIdentifier
      primaryKey: ColumnName[]+
      columns:
        - name: SqlIdentifier
          type: uuid|varchar|integer|boolean|timestamptz
          limits: Limits               # nonempty, discriminated by type below
          nullable: Boolean
          default?: generated-uuid|tenant-context|transaction-time
          pii?: { basis: NonemptyString, retention: NonemptyString }
queries:                               # G,L,T,V; sql-typed joins code by name
  - name: QualifiedQueryName            # namespace.table.label; joins defineQuery.name
    operation: insert|select-one        # constrained rail surface; no implicit CRUD
    table: SqlIdentifier
    params: ColumnRef[]                 # ordered defineQuery params; tenant never a parameter
    returns: ColumnRef[]+
    expects: one|zero-or-one|many|none   # matches defineQuery.expects; restrictions below
i18n: Map<I18nKey,Map<Locale,NonemptyString>> # G,L,T,V; i18n compares emitted catalogs
unimplemented:                         # eligibility, not current execution state; L,T,V
  - requirement: RequirementId          # unique R-n key; must reference acceptance=yes
    name?: NonemptyString               # optional documentation; never a packet lookup key
# InputBinding = {column: ColumnRef, required: Boolean}; no additional keys.
# ColumnRef = "table.column", resolved in data; path params always required.
# Limits(uuid) = {format: uuid}; Limits(varchar) = {minLength: Integer>=0, maxLength: Integer>=1}.
# Limits(integer) = {minimum: Int32, maximum: Int32}; Limits(boolean) = {values: [false,true]}.
# Limits(timestamptz) = {minimum: RFC3339UTC, maximum: RFC3339UTC}.
# Bounds inclusive, ordered; lengths count UTF-16 code units; no implicit trimming.
# RepoPath: repository-relative POSIX path, no .., absolute path, URL or symlink escape.
# Spec/Rule/UseCase product segment = uppercase(product) with hyphens removed.
# NonemptyString excludes whitespace-only strings; Hex64 is lowercase hexadecimal.
# Slug = [a-z][a-z0-9]*(-[a-z0-9]+)*; SqlIdentifier = [a-z][a-z0-9_]*, <=48 characters.
# PascalCase = [A-Z][A-Za-z0-9]*; InputName/ColumnName use SqlIdentifier.
# I18nKey and QualifiedQueryName are dot-separated lowercase identifiers.
# UpperSnakeIdentifier = [A-Z][A-Z0-9_]*; Locale is a canonical BCP 47 tag (08 A.8; D-014 names en-US, the default, and pt-BR; D-073); every configured locale must be present.
# Each table has >=1 column, a non-null primary key and non-null UUID tenant_id.
# Default/type pairs: generated-uuid/uuid, tenant-context/uuid, transaction-time/timestamptz.
```
<!-- schema-example:end -->

[opinion] Empty route/data/query collections represent work without those surfaces, not permission to skip a node. `inventory` decides `SKIPPED` from complete repository populations (D-044/D-054), for example no mounted routes in `domain/<m>`, cross-checked against the spec. Evidence is a predicate and its measured population, not a closed list of prose strings. Apply conditional applicability before deriving 05’s required set; no required node may then be skipped. The public route surface here is deliberately small: strict objects, column-bound scalar inputs and object responses. Unsupported unions, joins or unbounded types require a format revision; accepting arbitrary YAML would defeat the fixed-key contract. `insert` permits `expects: one`; `select-one` permits `one|zero-or-one` and requires a primary-key predicate. The other cardinalities remain reserved until their operation forms are specified. No SQL expression is accepted as a default.

[opinion] A `pii` object positively classifies a column; when `lgpd: true`, both declarations must be meaningful. Detecting falsely omitted PII classification is semantic review, not a schema proof. Configuration supplies locales, privacy opt-in and product prefix (`foundation/02-architecture.md:281–299,321–334`). Keys must contain every configured locale, including `en-US`; the spec cannot opt a locale out. Source quotes preserve exact obligations, not entire source documents. Resolution is against the checked candidate; changing a quoted source makes the discrepancy visible rather than silently importing a new obligation.

## 3. Use-case artifact

[opinion] One object per `product/use-cases/UC-*.json`. The schema below is JSON Schema; it is emitted from the validator's zod definition (D-056) — documentation here, regenerated at build, never written to the product repository; uniqueness constraints are refinements in the validator and do not appear in the emitted schema. Identity, source resolution and route joins are additional semantic checks. IDs are repository-unique; rule and endpoint arrays are sets. A route's `useCase` must resolve to this object's `id`, its method/path must appear in `endpoints`, and its roles must equal `actor.roles`. Each use-case rule must resolve through the spec's source table. This checks the claim's identity and declared scope; the reviewer judges whether the behavior actually realizes the use case (`foundation/02-architecture.md:69–70,463–469`).

<!-- schema-example:start -->
```json
{
  "type": "object", "additionalProperties": false,
  "required": ["id", "product", "title", "actor", "preconditions", "postconditions", "rules", "endpoints"],
  "properties": {
    "id": {"type": "string", "pattern": "^UC-[A-Z][A-Z0-9]*-[0-9]{3}$"},
    "product": {"type": "string", "pattern": "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$"},
    "title": {"$ref": "#/$defs/text"},
    "actor": {
      "type": "object", "additionalProperties": false, "required": ["name", "roles"],
      "properties": {
        "name": {"$ref": "#/$defs/text"},
        "roles": {"type": "array", "minItems": 1, "uniqueItems": true,
          "items": {"type": "string", "pattern": "^[a-z][a-z0-9-]*$"}}
      }
    },
    "preconditions": {"$ref": "#/$defs/texts"},
    "postconditions": {"$ref": "#/$defs/texts"},
    "rules": {"type": "array", "minItems": 1, "uniqueItems": true,
      "items": {"type": "string", "pattern": "^RN-[A-Z][A-Z0-9]*-[0-9]{3}$"}},
    "endpoints": {
      "type": "array", "minItems": 1, "uniqueItems": true,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["method", "path"],
        "properties": {
          "method": {"enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]},
          "path": {"type": "string", "pattern": "^/[A-Za-z0-9/:_-]*$"}
        }
      }
    }
  },
  "$defs": {
    "text": {"type": "string", "minLength": 1},
    "texts": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/text"}}
  }
}
```
<!-- schema-example:end -->

## 4. Diagnostics, not reading obligations

[opinion] Each row defines a diagnostic family with concrete member locators. Known missing files/fields are violations; inability to read the candidate is incomplete observation. `UNKNOWN` never repairs invalid input. Rules execute in `spec-lint` except SL09, SL10 and SL11’s packet-membership check, executed by `packet-scope` with `base` (D-054). These rules do not add a DAG node. The cache inputs include the base commit/blob, candidate bytes, resolved sources/links, configuration and packet as appropriate; a changed source invalidates its dependent specs. Every prerequisite failure retains its own locator. Exit aggregation remains 02 §8: FAIL → 1; UNKNOWN without FAIL → 2; only full acceptance can exit 0.

| Rule | Message on violation; inputs read | Input preventing observation → UNKNOWN |
|---|---|---|
| SL01 | `invalid contract at <pointer>: <reason>`; sole block, closed schema, required prose sections, use-case JSON | Unreadable spec/schema or validator crash; malformed readable YAML/JSON is FAIL |
| SL02 | `source <id>: missing artifact, id, or verbatim quote at <path>`; sources and referenced bytes; requirements reference declared sources | Source read denied or candidate snapshot unavailable; confirmed absence is FAIL |
| SL03 | `acceptance <R>: observable and falsifier required`; requirements, nonempty sources | Spec parse unavailable; no UNKNOWN for an empty field |
| SL04 | `route <method path>: missing or invalid <contract-field>`; all five fields on every route, request/response bindings, error-key and SLO values | Contract parse unavailable; absent decorator is checked later by route-contract |
| SL05 | `column <ref>: limits/nullability/PII declaration invalid`; data, defaults, primary keys and privacy configuration | Configuration unreadable; missing bounds or incomplete declared PII is FAIL |
| SL06 | `duplicate or malformed <kind> <id>`; document IDs globally; requirement/query/table/column IDs and unimplemented requirement keys and route pairs within the spec | Incomplete repository inventory; equal parameterized route patterns also collide |
| SL07 | `useCase <id>: unresolved actor/rule/endpoint claim`; use-case schema, route claims and source IDs; endpoint sets agree for this spec | Use-case file unreadable; known absent ID or mismatched role is FAIL |
| SL08 | `query <name>: invalid binding or cardinality`; query declaration, parameter/return columns and table; no tenant argument | Spec parse unavailable; runtime schema is not an input here |
| SL09 | `spec <id>: illegal transition or inconsistent successor pair`; previous blob at `base`, candidate, approval/questions and linked successor/predecessor (§6); executed by `packet-scope` | Base snapshot unreadable; confirmed absence at base is a new document, not missing history |
| SL10 | `spec digest differs from packet: <expected> != <actual>`; pin = SHA-256 of `git show <base>:<path>` AND candidate HEAD bytes; same predicate as 05 PL-04 | Packet/spec unreadable; authoring output without an input pin has no digest predicate |
| SL11 | `observation <R-n>: unknown, duplicate or non-acceptance requirement`; unique `unimplemented[].requirement`; packet IDs must belong to that set, nonempty only for `test` | Spec/packet unreadable; unknown ID or nonempty code/fix selection is FAIL |
| SL12 | `i18n <key>: missing locale or unresolved error message`; i18n map, configured locales, error contracts | Locale configuration unreadable; absent translation is FAIL |

[inference] Valid quoting establishes provenance, not entailment. SL02 cannot establish that an implementation choice follows from its quotation; SL03 cannot prove an observable is discriminating. Those are exactly the independent expectations and counterexamples requested in `foundation/02-architecture.md:463–469`. No model judgment is smuggled into a deterministic PASS.

## 5. Consumer derivations

[opinion] **Generator.** Refuse input whose written status is not `approved`, lacks `approved-by`, or has open questions; `frozen` is never written. Derive `domain/<module.slug>/` with flat, role-suffixed `api/src`, `dto/`, `api/test/acceptance/`, `db/`, README and generation manifest; add `web/` only with `--web` (`foundation/04-layout.md:41–79`; 02 §7). Columns yield DDL and boundary validators; query names yield `defineQuery` bindings in `<slug>.repository.ts`. Namespace and slug determine module SQL, applied through the root seed manifest. Root DDL bands remain `00–08` tables, `11–14` functions, `21–24` RLS, `80–89` views/materialized views, `90` assertions, `91–94` comments, `98` seed (D-017/D-040). Module tables and their ENABLE/FORCE RLS policies stay together; do not split them across bands.

[fact] The reference generator already rejects unsupported keys, emits separate TS/SQL headers and compares regenerated bytes and file sets, but its input is a different JSON blueprint (`stynx:packages/cli/src/generate-module.ts:54–56,108–119,430–442,474–489`). [opinion] Adapt its validator deliberately; do not claim this YAML works with today's CLI. Preserve generated/seed ownership, generate typed skeletons without inventing business behavior, and never rewrite applied SQL. D-043 assigns immutability to `sql-lint` LINT013, not `generated` (`foundation/decisions.md:292–296`).

[opinion] **Route contract.** Match normalized mounted `(method,path)` pairs bidirectionally within the module inventory, then compare all five values: `mode:key` → `@Idempotent({headerName,ttlMs})`; `mode:none` → `@NoIdempotent()`; `roles` → `@RequireRoles(roles, 'all')` on both emitter and checker; inline errors → `@ErrorContract`; use-case ID → `@UseCase`; inline metric/percentile/bound → `@Slo`. The `none` reason explains intent; it is not decorator metadata. GET carries the same explicit fields, even though S-25's mandatory code-decorator coverage starts with writes. Check request validation and request-ID middleware through the existing node. Metadata equality does not prove error behavior or idempotency; SLO measurement remains release-only (02 §2, D-038).

[opinion] **Query boundary.** String bounds count UTF-16 code units, matching zod `max` and generated `value.length`; the bound is conservative against PostgreSQL character capacity (D-054). Resolve each ordered parameter and returned column to its type, limits and nullability; compare the resulting schemas with the named `defineQuery` in code. `sql-typed` owns implementation-wide name uniqueness and applied-schema comparison; `spec-lint` checks only the declaration's internal consistency. `run` validates arguments before binding and every returned row; `expects` determines `ResultOf` (`foundation/02-architecture.md:144–189`). A missing DB makes that observation UNKNOWN, not the spec invalid. Query bodies remain seed code; a declared binding alone never establishes correct SQL.

[opinion] **Spec tests.** An independent agent derives fixtures, boundary values and assertions from `observable`/`falsifier` before implementation, or re-derives in the D-035 sparse worktree. Shared DTOs describe interfaces; generated validators must not supply expected answers. Write `domain/<slug>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`. Use exactly one top-level `it('R-n: <name>', ...)` per acceptance requirement, with multiple assertions inside when needed. This preserves 02's collected-block count while preventing duplicate tags from covering a missing requirement. `expected` counts `acceptance: "yes"`; `observed` counts valid collected requirement cases; `evaluated` counts those reaching their behavioral assertions. Missing known cases FAIL; failed collection is UNKNOWN; a zero-observation success is rewritten UNKNOWN (02 §8, S-61/S-65).

[opinion] A named expected-red case carries no rail assertion: rail-provided behaviour (guards, RLS isolation, validation of generated DTOs) is its own `R-n` requirement and stays green, so the only assertion a selected case may fail is the one about the missing business behaviour (D-058). [opinion] `unimplemented` is a frozen vocabulary of eligible missing behaviors, not a progress list. Only a `test` packet selects `R-n` IDs from `unimplemented[].requirement`; optional `name` text never controls membership. `code`/`fix` must use an empty selection and pass all cases (D-051). Spec eligibility alone never enables expected-red; the runner applies it only to a test packet’s selected IDs. Each selected case must reach and fail its behavioral assertion after successful imports, startup and DB setup; all others must pass, including rail behavior. A passing selected case also invalidates the expected-red claim. Ordinary code acceptance requires every case green, without editing the frozen list. The runner excludes `*.acceptance.spec.ts` from the unit glob and other generic tier execution (04 §4, D-054). Rail and missing-business observations are separate requirements; a selected expected-red case contains no rail assertion (D-058).

[opinion] **Reviewer phase 1.** For implementation packets, supply the whole pinned spec, resolved business sources and public contracts; withhold candidate implementation, dispositions and worker rationale. For `spec`, derive expectations from business sources before opening the candidate spec; for `standards`, use cited standards before the configuration/tooling diff. Phase 2 evaluates the kind’s deliverables and may confirm counterexamples in scratch. Input/time exhaustion before examining every requirement yields UNKNOWN; exhaustion of counterexample execution alone leaves findings `derived` (02 §9). Review runs for every kind, gates according to repository `review.mustRun`, and gates `protected:unplanned` even during shadow (D-028).

## 6. Approval, pins and succession

[opinion] Written statuses are `draft`, `approved`, and the single scalar `"superseded-by: <SpecId>"`. Use `status: approved` on its own line; the forward form is `status: "superseded-by: SPEC-DEMO-002"`, quoted for valid YAML. `approved-by` records intent, not cryptographic authentication. Initial insertion may be draft or approved; draft edits and draft → approved are legal, with nonempty approval and no open questions for approval. Approved content is stable; changed acceptance needs a new ID and fresh approval. `frozen` is derived when a packet pins `base` plus the complete file’s SHA-256, and the summary prints `(frozen)` without editing the spec.

[opinion] D-053 permits exactly one post-pin edit: replace the predecessor’s status line with the forward successor reference. Every other byte, including approval and prose, stays identical. The approved successor carries `supersedes: {id, path, sha256}` identifying the predecessor’s approved bytes. SL09 checks both directions together: successor ID equals the forward reference; its backward ID/path identify that predecessor; its hash equals the predecessor blob at `base`; replacing only the status line produces the candidate predecessor exactly. A missing/mismatched pair, approval regression, changed content or second retargeting is FAIL. Superseded is terminal; unchanged retired files remain legal repository content.

[opinion] SL09 runs in `packet-scope`, comparing the changed spec with its previous blob at the packet’s `base` and resolving linked files in that base/candidate pair. It never searches all prior commits or reconstructs pin history. Confirmed absence at base permits initial insertion; an unavailable base yields UNKNOWN. Unchanged transitions need no historical rescan. Source/link dependencies participate in invalidation. Historical replay checks out the original candidate and source snapshot, preserving old packets even after a later supersession.

[opinion] For input-pinning kinds, SL10/05 PL-04 hashes `git show <base>:<path>` **and compares the candidate’s HEAD bytes** with the pin. The base input must be approved, and a new packet cannot pin a spec whose HEAD carries `superseded-by`. A later status-only edit is permitted for the successor-authoring packet by SL09; it does not excuse a mismatch for an implementation packet. `kind: spec` validates its output, without requiring that output to exist or have a hash at base; `standards` without an input spec has no pin check. Known mismatch is FAIL/1; inability to read required input is UNKNOWN/2. Spec edits label `protected:spec`; business-source edits label `protected:product`.

## 7. Complete fictional init fixture

[opinion] The five bodies below assume template configuration `productPrefix: demo`, `lgpd: true`, locales `[en-US]`. `DemoPilot` is fictional. The nested spec path follows 04 §1/D-054. They are source/spec inputs, not an application acceptance result; the generator-release fixture must implement the approved behavior before its all-green matrix. The scaffold test packet selects `[R-1, R-2, R-4]`; R-3 checks rail denials. NOTES records each dependency and the exact spec digest.

<!-- schema-example:start -->
### `product/demo/README.md`

```markdown
# demo

A fictional tenant-scoped notebook used only to exercise DEVAI's template.
Members create notes and retrieve them by identifier.
All names, aliases and tenants in this fixture are synthetic.
Use en-US, product prefix demo and the privacy-declaration option enabled.
Destroy the disposable workspace and its database after the demonstration.
There is no external integration, notification, search or retention service.
```

### `product/demo/rules/RN-DEMO-001.md`

```markdown
# RN-DEMO-001 — Create and retrieve a note

A demo member may create a note with a title of 1 to 80 UTF-16 code units and an author alias of 1 to 40 UTF-16 code units.
Each successful submission creates a distinct note; its identifier retrieves the unchanged title and alias within the same tenant.
Unknown input fields, null values and values outside these limits are rejected without creating a note.
```

### `product/demo/rules/RN-DEMO-002.md`

```markdown
# RN-DEMO-002 — Access and disposable personal data

Only a demo-member with a verified tenant may create or read notes; another tenant's note is indistinguishable from a missing note.
The author alias is fictional personal data supplied with demo consent and retained only until the disposable workspace is destroyed.
```

### `product/use-cases/UC-DEMO-001.json`

```json
{
  "id": "UC-DEMO-001",
  "product": "demo",
  "title": "Create and retrieve a tenant note",
  "actor": {"name": "Demo member", "roles": ["demo-member"]},
  "preconditions": ["A verified bearer token identifies a tenant and the demo-member role."],
  "postconditions": ["A valid submission creates one note retrievable only in its tenant."],
  "rules": ["RN-DEMO-001", "RN-DEMO-002"],
  "endpoints": [
    {"method": "POST", "path": "/notes"},
    {"method": "GET", "path": "/notes/:id"}
  ]
}
```

### `specs/notes/SPEC-DEMO-001.md`

````markdown
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
````
<!-- schema-example:end -->

## 8. Shared packet interface

[opinion] The campaign is `packets/CMP-DEMO-001/`: `PKT-DEMO-001` authors the spec, `PKT-DEMO-002` generates, `PKT-DEMO-003` derives six tests with `observations.unimplemented: [R-1, R-2, R-4]`, and `PKT-DEMO-004` implements with `observations.unimplemented: []`. The code trailer is `Packet: PKT-DEMO-004`. All pinning packets cite `specs/notes/SPEC-DEMO-001.md`; derive the acceptance filename from its ID and module, never a second packet field. Expected coverage is six regardless of the selection length. 05’s complete example is the code packet; its spec hash placeholder is replaced with NOTES’ digest at copy time. Base SHA-1 and review fingerprint examples remain explicitly illustrative.

[opinion] Tracked evidence lives at `.devai/review/<packet-id>.json`, excluded from both candidate digest and `packet-scope` (D-054); the packet itself is not excluded and its amendments need its exact allowed path. `forbidden` overrides `allowed`: changed ⊆ allowed and changed ∩ forbidden = ∅ (D-052). Dispositions resolve their originating finding against committed review history, then re-observe the current candidate; a replaced review or pruned cache cannot erase the binding. None changes the spec’s acceptance contract.

[opinion] No Owner decision remains open for this format. D-026 and D-047 retain their existing provisional status. The scalar schema and decorator lowering are implementation contracts, not claims that the present reference CLI accepts this YAML or that the v3 DAG has run.
