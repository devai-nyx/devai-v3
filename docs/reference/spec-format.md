---
title: Spec format
sidebar_position: 7
description: The technical spec's required sections, every machine-block field, the use-case artifact, the 12 SL rules and the approval statuses of 06.
---

# Spec format

A technical spec is one Markdown file at `specs/<area>-<capability>/SPEC-<PRODUCT>-<nnn>.md` ([04 §1](../framework/04-layout.md), [D-027](../../decisions.md)). It is the setpoint: a `spec` packet derives it from business rules in `product/`, the pilot approves it, and later packets pin its exact bytes ([06 §1](../framework/06-spec-format.md)). It holds human prose and exactly one machine block.

**Counts:** 5 required prose sections plus `## Contract`; 13 top-level machine-block keys; 72 field rows below (every key path in the 06 §2 notation); 12 SL rules (SL01–SL12); 3 written statuses; 8 top-level use-case artifact keys.

## Required sections

**Purpose**, **Scope**, **Contract** (holding the machine block), **Contract notes**, **Acceptance notes**, **Open questions**. Approval requires `## Open questions` to have no unresolved questions ([06 §1, §5](../framework/06-spec-format.md)). A spec is ≤ 350 lines and kebab-named ([04 §4](../framework/04-layout.md), checked by `layout`).

## Machine block rules

Under `## Contract`, exactly one fenced `yaml` block, YAML 1.2, closed keys at every object level ([06 §2](../framework/06-spec-format.md)):

- Duplicate keys, aliases, custom tags and implicit coercions are rejected; `"yes"`/`"no"` are quoted strings.
- `?` marks an optional field; every other field is required. Lists may be empty unless marked `+` (non-empty).
- No execution status, timestamps, node selection or packet dispositions belong in the block.

Consumer letters: **G** generator, **L** `spec-lint` (validates every field), **C** `route-contract`, **T** `spec-tests`, **V** review phase 1 (receives everything).

## Machine-block fields

### Top level and identity

| Field | Type | Consumers | Notes |
|---|---|---|---|
| `id` | `^SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$` | G, L, C, T, V | |
| `status` | `draft` \| `approved` \| `"superseded-by: <SpecId>"` | G, L, T, V | written status |
| `approved-by` | non-empty string or `null` | L, V | non-null for `approved` and `superseded-by` |
| `supersedes?` | object | L, V | backward reference paired with the forward status |
| `supersedes.id` | SpecId | | |
| `supersedes.path` | RepoPath | | `specs/**`, the exact predecessor file |
| `supersedes.sha256` | Hex64 | | |
| `product` | Slug | G, L, C, T, V | lowercase kebab |
| `module` | object | G, L, C, T, V | |
| `module.name` | PascalCase | | unprefixed; the generator adds the product prefix |
| `module.slug` | Slug | | destination `domain/<slug>` |
| `module.namespace` | SqlIdentifier | | lowercase snake, non-reserved |

### `sources` (+) and `requirements` (+)

| Field | Type | Consumers | Notes |
|---|---|---|---|
| `sources[]` | list, non-empty | L, T, V | |
| `sources[].id` | `RN-<PRODUCT>-nnn` \| `UC-<PRODUCT>-nnn` | | |
| `sources[].path` | RepoPath | | an existing `product/**` rule or use-case artifact |
| `sources[].quote` | non-empty string | | exact substring of the decoded UTF-8 source bytes |
| `requirements[]` | list, non-empty | L, T, V | |
| `requirements[].id` | `^R-[1-9][0-9]*$` | | local to the spec |
| `requirements[].text` | non-empty string | | |
| `requirements[].acceptance` | `"yes"` \| `"no"` | | strings, never booleans |
| `requirements[].observable` | non-empty string or `null` | | non-null when `acceptance` is `"yes"` |
| `requirements[].falsifier` | non-empty string or `null` | | non-null when `acceptance` is `"yes"` |
| `requirements[].sources` | SourceId[], non-empty | | references to `sources[].id` |

### `routes`

| Field | Type | Notes |
|---|---|---|
| `routes[]` | list (G, L, C, T, V) | |
| `routes[].method` | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` \| `HEAD` \| `OPTIONS` | |
| `routes[].path` | AbsoluteRoutePath | includes the mounted prefix; `:name` parameters |
| `routes[].idempotency` | tagged union | |
| `routes[].idempotency.mode` | `none` \| `key` | |
| `routes[].idempotency.reason?` | non-empty string | required for `none`; no other `none` keys |
| `routes[].idempotency.header?` | non-empty string | required for `key` |
| `routes[].idempotency.ttlMs?` | positive integer | required for `key`; `key` has no `reason` |
| `routes[].roles` | Slug[], non-empty | all required: `RequireRoles(roles, 'all')` |
| `routes[].errorContract` | list, non-empty | inline; no unresolved contract names |
| `routes[].errorContract[].status` | integer 400–599 | |
| `routes[].errorContract[].code` | UpperSnakeIdentifier | |
| `routes[].errorContract[].messageKey` | I18nKey | |
| `routes[].useCase` | UseCaseId | |
| `routes[].slo` | object | |
| `routes[].slo.metric` | `http.server.duration` | |
| `routes[].slo.percentile` | integer 1–99 | |
| `routes[].slo.maxMs` | positive integer | |
| `routes[].request` | object | a strict object at each boundary |
| `routes[].request.body` | Map of InputName → InputBinding | |
| `routes[].request.query` | Map of InputName → InputBinding | |
| `routes[].request.params` | Map of InputName → InputBinding | |
| `routes[].response` | object | |
| `routes[].response.status` | integer 200–299 | |
| `routes[].response.columns` | ColumnRef[], non-empty | exact object projection; column names as JSON keys |

### `data`

| Field | Type | Notes |
|---|---|---|
| `data` | object (G, L, T, V) | also read for `sql-typed` limits and `sql-lint` PII |
| `data.tables[]` | list | |
| `data.tables[].name` | SqlIdentifier | |
| `data.tables[].primaryKey` | ColumnName[], non-empty | |
| `data.tables[].columns[]` | list | ≥ 1 column per table |
| `….columns[].name` | SqlIdentifier | |
| `….columns[].type` | `uuid` \| `varchar` \| `integer` \| `boolean` \| `timestamptz` | |
| `….columns[].limits` | Limits | non-empty, discriminated by type (below) |
| `….columns[].nullable` | Boolean | |
| `….columns[].default?` | `generated-uuid` \| `tenant-context` \| `transaction-time` | |
| `….columns[].pii?` | object | positive PII classification |
| `….columns[].pii.basis` | non-empty string | |
| `….columns[].pii.retention` | non-empty string | |

### `queries`, `i18n`, `unimplemented`

| Field | Type | Notes |
|---|---|---|
| `queries[]` | list (G, L, T, V) | `sql-typed` joins code by name |
| `queries[].name` | QualifiedQueryName | `namespace.table.label`; joins `defineQuery.name` |
| `queries[].operation` | `insert` \| `select-one` | no implicit CRUD |
| `queries[].table` | SqlIdentifier | |
| `queries[].params` | ColumnRef[] | ordered `defineQuery` params; tenant is never a parameter |
| `queries[].returns` | ColumnRef[], non-empty | |
| `queries[].expects` | `one` \| `zero-or-one` \| `many` \| `none` | `insert` permits `one`; `select-one` permits `one`\|`zero-or-one` and requires a primary-key predicate; the others are reserved |
| `i18n` | Map of I18nKey → Map of Locale → non-empty string | G, L, T, V; every configured locale must be present |
| `unimplemented[]` | list (L, T, V) | eligibility, not execution state |
| `unimplemented[].requirement` | RequirementId | unique; must reference an `acceptance: "yes"` requirement |
| `unimplemented[].name?` | non-empty string | documentation only; never a lookup key |

### Type definitions

| Type | Definition |
|---|---|
| InputBinding | `{column: ColumnRef, required: Boolean}`; no other keys |
| ColumnRef | `"table.column"`, resolved in `data`; path params always required |
| Limits(uuid) | `{format: uuid}` |
| Limits(varchar) | `{minLength: Integer>=0, maxLength: Integer>=1}` |
| Limits(integer) | `{minimum: Int32, maximum: Int32}` |
| Limits(boolean) | `{values: [false,true]}` |
| Limits(timestamptz) | `{minimum: RFC3339UTC, maximum: RFC3339UTC}` |
| Bounds | inclusive, ordered; lengths count **UTF-16 code units**; no implicit trimming |
| RepoPath | repository-relative POSIX path; no `..`, absolute path, URL or symlink escape |
| Product segment | uppercase(`product`) with hyphens removed (in Spec, Rule and UseCase ids) |
| NonemptyString | excludes whitespace-only strings |
| Hex64 | lowercase hexadecimal |
| Slug | `[a-z][a-z0-9]*(-[a-z0-9]+)*` |
| SqlIdentifier | `[a-z][a-z0-9_]*`, ≤ 48 characters; InputName and ColumnName use it |
| PascalCase | `[A-Z][A-Za-z0-9]*` |
| I18nKey, QualifiedQueryName | dot-separated lowercase identifiers |
| UpperSnakeIdentifier | `[A-Z][A-Z0-9_]*` |
| Locale | a [D-014](../../decisions.md) language tag (`en-US`, `pt-BR`) |
| Table invariants | ≥ 1 column, a non-null primary key and a non-null UUID `tenant_id` |
| Default/type pairs | `generated-uuid`/`uuid`, `tenant-context`/`uuid`, `transaction-time`/`timestamptz` |

Empty `routes`/`data`/`queries` collections describe work without that surface; they are never permission to skip a node. `SKIPPED` comes from `inventory`'s repository populations ([06 §2](../framework/06-spec-format.md), [D-044](../../decisions.md)).

## Use-case artifact

One object per `product/use-cases/UC-*.json`, validated by zod; the JSON Schema in [06 §3](../framework/06-spec-format.md) is emitted from it ([D-056](../../decisions.md)).

| Key | Type |
|---|---|
| `id` | `^UC-[A-Z][A-Z0-9]*-[0-9]{3}$` |
| `product` | `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` |
| `title` | non-empty string |
| `actor` | `{ name: non-empty string, roles: unique non-empty list of ^[a-z][a-z0-9-]*$ }` |
| `preconditions` | non-empty list of non-empty strings |
| `postconditions` | non-empty list of non-empty strings |
| `rules` | unique non-empty list of `^RN-[A-Z][A-Z0-9]*-[0-9]{3}$` |
| `endpoints` | unique non-empty list of `{ method: GET…OPTIONS, path: ^/[A-Za-z0-9/:_-]*$ }` |

A route's `useCase` must resolve to this object's `id`, its method/path must be in `endpoints`, and its roles must equal `actor.roles` (SL07).

## SL rules

Rules run in `spec-lint`, except SL09, SL10 and SL11's packet-membership check, which `packet-scope` runs because only it has `base` ([06 §4](../framework/06-spec-format.md), [D-054](../../decisions.md)). Known missing files or fields are `FAIL`; inability to read the candidate is `UNKNOWN`.

| Rule | Message on violation | Inputs read | → `UNKNOWN` when | Node |
|---|---|---|---|---|
| SL01 | `invalid contract at <pointer>: <reason>` | sole block, closed schema, required prose sections, use-case JSON | spec/schema unreadable or validator crash (malformed readable YAML/JSON is `FAIL`) | `spec-lint` |
| SL02 | `source <id>: missing artifact, id, or verbatim quote at <path>` | sources and referenced bytes; requirements reference declared sources | source read denied or candidate snapshot unavailable | `spec-lint` |
| SL03 | `acceptance <R>: observable and falsifier required` | requirements, non-empty sources | spec parse unavailable | `spec-lint` |
| SL04 | `route <method path>: missing or invalid <contract-field>` | all five fields on every route, request/response bindings, error-key and SLO values | contract parse unavailable | `spec-lint` |
| SL05 | `column <ref>: limits/nullability/PII declaration invalid` | data, defaults, primary keys, privacy configuration | configuration unreadable | `spec-lint` |
| SL06 | `duplicate or malformed <kind> <id>` | document ids globally; requirement/query/table/column ids, `unimplemented` keys and route pairs within the spec | incomplete repository inventory | `spec-lint` |
| SL07 | `useCase <id>: unresolved actor/rule/endpoint claim` | use-case schema, route claims, source ids | use-case file unreadable | `spec-lint` |
| SL08 | `query <name>: invalid binding or cardinality` | query declaration, parameter/return columns, table; no tenant argument | spec parse unavailable | `spec-lint` |
| SL09 | `spec <id>: illegal transition or inconsistent successor pair` | previous blob at `base`, candidate, approval/questions, linked successor/predecessor | base snapshot unreadable | `packet-scope` (= PL-17) |
| SL10 | `spec digest differs from packet: <expected> != <actual>` | sha256 of `git show <base>:<path>` and candidate HEAD bytes | packet/spec unreadable | `packet-scope` (= PL-04 digest) |
| SL11 | `observation <R-n>: unknown, duplicate or non-acceptance requirement` | unique `unimplemented[].requirement`; packet ids belong to that set; non-empty only for `test` | spec/packet unreadable | `spec-lint`; membership in `packet-scope` (= PL-11) |
| SL12 | `i18n <key>: missing locale or unresolved error message` | i18n map, configured locales, error contracts | locale configuration unreadable | `spec-lint` |

`spec-lint` findings print as `<spec path>:<line> SL<nn> <message> [S-25] <hint>` ([08 B.8](../framework/08-cli-and-nodes.md)).

## Statuses, approval and succession

From [06 §6](../framework/06-spec-format.md) and [D-053](../../decisions.md):

| Written status | Meaning |
|---|---|
| `draft` | Editable; initial insertion may be draft |
| `approved` | Written on its own line with a non-empty `approved-by` and no open questions. Approved content is stable |
| `"superseded-by: <SpecId>"` | Terminal. The one permitted post-pin edit: only the status line changes |

- **`frozen` is derived**, never written: a packet pins `base` plus the whole file's sha256, and the summary prints `(frozen)`.
- **A successor** carries `supersedes: {id, path, sha256}` naming the predecessor's approved bytes; SL09 checks both directions together.
- **Legal transitions** (PL-17): added as `draft` or `approved`; `draft → draft`; `draft → approved`; `approved → superseded-by: <X>`.
- **The generator refuses** a spec that is not `approved`, lacks `approved-by`, or has open questions ([06 §5](../framework/06-spec-format.md), [08 A.2](../framework/08-cli-and-nodes.md)).
- `approved-by` records intent, not cryptographic authentication. Agents never write it ([D-016](../../decisions.md), [10 §4](../framework/10-agent-surface.md)).

## Acceptance cases

The acceptance file is `domain/<slug>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`, with exactly one top-level `it('R-n: <name>', …)` per `acceptance: "yes"` requirement. A named expected-red case carries no rail assertion; rail behaviour is its own requirement and stays green ([06 §5](../framework/06-spec-format.md), [D-058](../../decisions.md)).

Source: [06 §1–§6](../framework/06-spec-format.md), [04 §1, §4](../framework/04-layout.md), [05 §5](../framework/05-task-packet.md), [08 A.2, B.8, B.26](../framework/08-cli-and-nodes.md), [D-016](../../decisions.md), [D-027](../../decisions.md), [D-053](../../decisions.md), [D-054](../../decisions.md), [D-056](../../decisions.md).
