# Decisions — DEVAI v3 foundation

One entry per decision. Dated, numbered, with the options considered and what was chosen.
A draft document is not a decision; only entries here bind later drafts. Superseded entries stay,
marked `superseded by D-nnn`. "Owner" = Antonio.

## D-001 · 2026-10-17 · v3 is a ground-up build, v2 is reference only
Options: (a) prune v2 toward a smaller kernel; (b) new spec, new codebase, v2 read for lessons.
Chosen: (b). Source: Owner, `00-intent.md` standing instruction.

## D-002 · 2026-10-17 · No external evidence consumer; evidence exists for CI and the pilot only
Options: (a) evidence custody as product core (auditor/customer-grade); (b) evidence sufficient
for CI to trust local results and for the pilot to see error state.
Chosen: (b). Source: adjudication 1. Consequence: no signing/attestation infrastructure beyond
what CI needs to accept a locally produced result.

## D-003 · 2026-10-17 · Human ratification of diffs is not a control
Fact: a few percent of 319 merged PR diffs were read. Consequence for v3: acceptance authority
rests on deterministic checks plus an independent reviewer with repository access; the pilot's
attention is reserved for intentions, business rules, specs and the error state, not for diffs.
Source: adjudications 2, 11.

## D-004 · 2026-10-17 · Mutation testing is outside the development cycle
Options: (a) delivery gate; (b) periodic hardening outside the cycle (Bedel); (c) not used.
Chosen: (b) or (c), decided later; never (a). Source: adjudications 7, 8.

## D-005 · 2026-10-17 · Error state must be local, per task, and actionable by the agent
The scorecard's intended role (dashboard + state proxy that drives the agent to reduce error) is
kept as intent; its v2 realization (45 cells, read once per campaign) is not. In v3 the error
state is whatever a single local command reports for the current change, fast enough to sit in
the agent's edit-check loop. Source: adjudication 10, intent "MOST LOCALLY".

## D-006 · 2026-10-17 · The product is a rail and a harness, not an auditor
Rail: company-standard scaffolding, helpers, best practices built in. Harness: local checks that
keep the agent's work inside the standards. The pilot is guided; the pilot is not asked for
permissions to bypass the framework. Source: intent, adjudication 11.

## D-007 · 2026-10-17 · STYNX is a DEVAI consumer, not the rail · preliminary
STYNX is a library/framework and must follow every rule and guideline DEVAI enforces, exactly
as DETRAN does. v3's scaffolding may generate code that uses STYNX, but STYNX is governed, not
governing. Source: Owner.

## D-008 · 2026-10-17 · Business specs live in the product repo; technical specs come from DEVAI · preliminary
DETRAN's business specifications live under `product/` in the DETRAN repository (use cases,
stories, rules). Technical specifications (how a feature is realized on the NestJS / Angular /
PostgreSQL stack to company standards) are DEVAI's to provide. Consequence: `05-spec-format.md`
is a format for the technical spec and an interface to the existing business spec, not a
migration of `product/`. Source: Owner.

## D-009 · 2026-10-17 · S-12 (permissions from token, no SQL per request) is a pattern guideline
Options: (a) runtime assertion; (b) lint; (c) narrow agentic check.
Chosen: (c). No runtime enforcement. A simple agentic check runs over the narrow slice of code
that performs permission checks and verifies compliance with the pattern. "Keep it simple."
Source: Owner.

## D-010 · 2026-10-17 · S-21 (raw SQL) means type-safe queries with validated arguments
Clarified intent: every raw SQL query is type-safe or type-enforced, and its arguments are
checked and validated against known limits and schemas before execution. Shared location is a
means to that end, not the end. Mechanism to be designed in `02-architecture.md`.
Source: Owner.

## D-011 · 2026-10-17 · S-08 (Docker-or-bare) becomes a declared contract that agents read
Docker-or-bare is current practice with no written home. v3 must state it somewhere coding
agents read (root guide and/or scaffold output) so that every pertinent concern (local CI,
checks, dev env, remote CI) is built and kept runnable both bare and in Docker. Source: Owner.

## D-012 · 2026-10-17 · S-31: v3 enforces ESM only · Owner determination
Options: (a) scaffold ESM, STYNX migrates; (b) amend S-31 to "ESM for new packages".
Chosen: (a). v3 enforces ESM only. STYNX's CommonJS backend output is a migration item for
STYNX, not a tolerance in the standard. Source: Owner.

## D-013 · 2026-10-17 · S-33: `no-explicit-any` and all `no-unsafe-*` on from day 0 · Owner decision
No grace period. v3's lint profiles ship with these rules at `error`. Source: Owner.

## D-014 · 2026-10-17 · Adopted additional standards (from STYNX extraction §5)
- Postgres-only async: outbox/jobs/notifications via `FOR UPDATE SKIP LOCKED`; no SQS, no BullMQ.
- LGPD legal basis and retention declared per PII column; **opt-in at project bootstrap**.
- i18n / multi-language / multi-locale is mandatory. Default language **en-US**; pt-BR
  **opted in at project bootstrap**.
- The write-route contract: every write route declares idempotency, role binding, error
  contract, use-case claim and SLO; coverage check closes the loop.
- Naming: no `enum`; named exports only; `<product>` prefix (not `Stynx`) on public
  modules/services/components/tokens.
- UUIDv7 request IDs, required on every request.
Source: Owner. Entered in `03-standards.md` as S-14, S-15, S-16, S-25, S-36, S-70.

## D-015 · 2026-10-17 · Held for later decision
Not adopted, not rejected: byte-verified generated artifacts; 100% coverage default; test
taxonomy (unit/wiring/integration/db/e2e); pino + Prometheus without OpenTelemetry.
Listed in `03-standards.md` under "Held". Source: Owner.

## D-016 · 2026-10-17 · Two design patterns adopted for v3
1. **Intent as annotation in the artifact, checked mechanically** (model: migration linter's
   `-- @destructive: approved-by=`; route decorators `@Idempotent()`/`@NoIdempotent()`). This is
   how pilot approval is expressed in v3; no receipts in a ledger.
2. **Every write route carries its contract in code, and a coverage check closes the loop.**
   This is `code <== spec` at route granularity.
Source: Owner ("strongly agree").

## D-017 · 2026-10-17 · DDL band convention adopted
`database/ddl/NN-<schema>-<topic>.sql` with tens digit = object kind; the band table lives in
the template's `database/README.md`. The strongest cross-repo agreement in the layout report.
Source: Owner.

## D-018 · 2026-10-17 · Execution model: harnesses execute; v3 defines packets and acceptance (closes O-001)
Options: (a) harnesses execute, v3 owns packet format + local acceptance check; (b) v3 ships a
thin dispatcher; (c) no multi-task scope in v3.
Chosen: (a). v3 never knows a task is running; it knows whether a result passes. Claude Code,
Codex, a subagent, a scheduled/cloud run or the pilot picks up packets. No scheduler, journal,
lock or round controller in v3. If a cross-repo or shared-resource need appears, it is a separate
small tool built then. Source: Owner (recommended option).

## D-019 · 2026-10-17 · One agent git identity; protected paths are a labelling hook (closes O-002)
Options: (a) one identity, protected-path touches label the PR; (b) one identity + path admission
as a hard refusal; (c) v2 role identities.
Chosen: (a). Agent commits under a single identity (`<product>-agent` or the pilot with a
Co-Authored-By trailer; exact form in `02-architecture.md`). A hook detects touches to protected
paths (specs, standards, infra, CI) and labels the PR; it never refuses by signature.
Source: Owner (recommended option).

## D-020 · 2026-10-17 · Standards list stays open until `02-architecture.md` is drafted (O-003 remains open)
Options: (a) close as v3.0 baseline now; (b) keep open, let the architecture draft propose
standards back, close after cross-review.
Chosen: (b). Source: Owner.

## D-021 · 2026-10-17 · No feature folder inside `domain/<m>/api/src/` (closes O-004)
Files flat in `api/src/`, role-suffixed; subfolders only `dto/` and `adapter/`. Generator form.
Source: Owner (recommended option).

## D-022 · 2026-10-17 · Unit tests in separate `test/` folders, not colocated (closes O-005)
`domain/<m>/api/test/`, `domain/<m>/web/test/`, `apps/<app>/test/`. Reason that survives D-003:
spec-derived tests live where the code agent does not write (derivation-source independence).
Source: Owner (recommended option).

## D-023 · 2026-10-17 · Module SQL per-module `db/` applied via a root manifest (closes O-006)
`domain/<m>/db/<ns>_<slug>.sql`; `database/seed/` manifest fixes apply order. Generated modules
are self-contained; LINT001 (RLS in the same migration) is checkable per module. Generator
renames its output `database/` → `db/`. Framework-package migrations stay where they are.
Source: Owner (recommended option).

## D-024 · 2026-10-17 · Root higher-tier test folder is `test/`, singular (closes O-007)
Options: (a) `tests/` (both adopters, v2 constitution table); (b) `test/` (Node core, Mocha,
NestJS CLI; and the module shape already uses `api/test/`).
Chosen: (b). Owner asked which option a from-scratch design would take; orchestrator's answer
was `test/`: Node convention is stronger than local precedent, and one spelling everywhere is
what a layout checker should enforce. Orchestrator's earlier `tests/` recommendation was wrong
on D-006 grounds (installed base is not the rail). Cost: PEC and TEAT rename on migration.
Source: Owner.

## D-025 · 2026-10-18 · S-12 stands as written; STYNX auth is a migration item
Fact (cross-review, verified): `StynxAuthGuard` resolves permissions per request via
`PermissionCache` (memory → Redis → SQL). The token carries claims + session id, not permissions.
`03-standards.md` Part B had S-12 as "Observed"; that was wrong. Options: (a) keep S-12, STYNX
migrates; (b) reword to session-keyed cache with DB on miss; (c) grandfather the STYNX guard.
Chosen: (a). Consequences: token carries permissions; short TTL + session-id revocation list are
STYNX design items; the S-12 sensor question stays "is authorization decided from the verified
token only, with no DB/cache/network call on the request path". Source: Owner.

## D-026 · 2026-10-18 · Packet granularity: `kind:` packets; packet = unit of acceptance, PR = unit of merge · **PROVISIONAL**
Options: (a) one packet per feature with worker/test-agent views; (b) `kind:` per packet
(spec · generate · test · code · fix · standards), feature = 4–5 packets in dependency order,
`test` packets accepted via `--expect-red`. Owner: **no preference**; orchestrator's recommendation
(b) adopted. Reason: independence by sequencing (tests derived before implementation exists) and a
mechanical red-first record; (a)'s two-agent protocol must be executed identically by every harness
and v3 cannot verify it was. Adopt from (a): `base` (explicit merge-base commit), `context` (named
excerpts), `scope` vocabulary into `paths.allowed/forbidden`. A campaign may land as one branch
with `Packet:` trailers per packet head. **Owner (2026-10-18, re-asked): leave provisional; build the
first DETRAN module with `kind:` packets, measure packets / PRs / pilot touches, then decide.**

## D-027 · 2026-10-18 · Specs and packets live at root: `specs/`, `packets/`; both protected (closes V2; L-01)
Options: (a) `docs/meta/specs/`, `docs/meta/tasks/`; (b) root folders. Chosen: (b). Reason: a
setpoint is not documentation; keeps them out of the docs-IA checker and site renderer; `law/` and
`product/` set the precedent. Amends `04-layout.md` §1. Source: Owner.

## D-028 · 2026-10-18 · Independent review: node from day 0, `must-run` after one campaign in shadow (closes V7)
Both drafts: `review` is a DAG node inside the single exit code; reviewer PASS is never
authorization. Options: (a) `must-run` from the first merge, calibrate beforehand on sandbox
candidates; (b) shadow for the first campaign, then flip `must-run` in `devai.json` using measured
false-positive and miss counts. Chosen: (b). Source: Owner.

## D-029 · 2026-10-18 · STYNX publishes `@stynx-nyx/{eslint-config,tsconfig,migration-linter}` before v3.0
Fact: today `private: true`, 0.2.0, workspace-local. Options: (a) STYNX publishes as versioned ESM
packages in the fixed group; (b) v3 vendors copies; (c) ship v3 reporting UNKNOWN until published.
Chosen: (a). v3 never vendors; `devai check` preflight reports `UNKNOWN: tooling missing` with the
install command. This is a STYNX deliverable and a v3.0 prerequisite. Source: Owner.

## D-030 · 2026-10-18 · Typed-query helper lives inside `@stynx-nyx/data`
Both drafts converged on `defineQuery` + DB-backed PREPARE/describe check; only the home was open.
Options: (a) new `@devai-nyx/sql` that STYNX adopts; (b) inside `@stynx-nyx/data`, next to
`Database.tx()` and the GUC setup it needs. Chosen: (b). Consequence: DEVAI's `sql-typed` check
reads a STYNX-owned API; the contract (`defineQuery`, `run`, `ResultOf`, no-interpolation `sql`
tag, argument parse before bind, row validation after) is specified in `02-architecture.md` and
STYNX implements it. `Transaction.query` becomes `@internal`. Source: Owner.

## D-031 · 2026-10-18 · Root `decisions.md`, protected; amends `04-layout.md` §1
Options: (a) root, in the root-guide allowlist, protected class `decisions` with `law/**`;
(b) `docs/meta/eng/decisions.md`. Chosen: (a). Reason: the pilot's one binding memory; pilot-authored
intent (specs, packets, decisions) has one home style. Source: Owner.

## D-032 · 2026-10-18 · Product prefix is per app: `boat-`, `pec-`, `teat-`, `rait-`; shared code `detran-`
Selectors `boat-*`, DI tokens `BOAT_*`, classes `Boat*`. `domain/shared` uses `detran-`.
Source: Owner.

## D-033 · 2026-10-18 · Converged in cross-review, adopted: generated vs seed (V3)
`mode: generated | seed` in `generation-manifest.json`. Generated files carry a header in the
language's comment syntax (`// @generated` TS, `-- @generated` SQL), are wholly owned by
deterministic regeneration and byte-verified against the **pinned generator and inputs**, not a
manifest hash. Seed files are emitted once and then hand-owned. **Applied migrations are immutable
inputs; a schema change is a new migration**, never a rewrite of `db/` initial DDL. No three-way
merge assistant in v3.0. Source: both reviews (Codex moved).

## D-034 · 2026-10-18 · Converged, adopted: `devai.json` with `$schema`; `DEVAI_RUNTIME=bare|docker` override (V4)
No executable config. Source: both reviews (Codex moved).

## D-035 · 2026-10-18 · Converged, adopted: review dispositions and test-agent isolation (V5, V6)
Dispositions: a small block in the packet, bound to requirement + locator (never a sequential
finding id), applying to `review` findings only; `fixed` and `not-a-defect` require re-observation;
`accepted-risk` never overrides a deterministic node; a business decision that changes acceptance
is a successor spec. Isolation: test derivation happens before the implementation exists
(sequencing, D-026) and, for re-derivation, in a **sparse worktree** excluding the module's
`mode: seed` files so the implementation is physically absent; no self-reported UNKNOWN.
Source: both reviews (Fable moved on V6, Codex on V5).

## Corrections accepted from cross-review (no new decision needed)
- Acceptance is **one** rule: `devai check --packet <p> --full` exit 0; `review` is a node inside
  it. Three exit codes: 0 accepted, 1 violation, 2 incomplete/could-not-run (reason code in report).
  No `review: off`, no `--only` acceptance.
- `spec-tests` shortfall with a known expected count is FAIL, not UNKNOWN; UNKNOWN is "could not
  observe". Runner rewrites any success with zero observations to UNKNOWN.
- `--expect-red` applies only to named **unimplemented** observations; collection, imports, app
  startup and DB setup must succeed first; rail-provided behaviour stays green.
- S-25 contract fields are decorators in code; v3 ships `@ErrorContract`, `@UseCase`, `@Slo`
  (STYNX has only `@Idempotent/@NoIdempotent`, `@Permission`, `@RequireRoles`); sidecar JSON forms
  are not accepted as declarations.
- SLO **measurement** runs outside packet acceptance (release/nightly); acceptance verifies the
  declaration (D-005 locality).
- `workerFamily` is not a packet field; worker family is derived from `Co-Authored-By` trailers at
  review time; equal or unknown family → review UNKNOWN.
- `generation-manifest.json` is writable only by `generate` packets.
- S-12 slice bound ≥ 60k tokens; slice = mounted routes → guards → transitive calls through DI,
  including STYNX package sources; above bound → UNKNOWN with the file list.
- Protected-path hook compares old **and** new paths (`--no-renames`); classes include
  `decisions` (`decisions.md`, `law/**`).
- Every `source:` in a spec must resolve to an existing rule/use-case artifact and the quoted
  obligation must appear in it (lesson of the RN-BOAT-119 fabrication, Codex F-1).
- Use cases are JSON (`product/use-cases/*.json`), not Markdown with anchors.
- `execute()/run()` return type follows cardinality (`ResultOf`).
- DB-backed results are keyed by schema digest from `db-apply` (reproducible in both modes); bare
  mode is not penalised.

## D-036 · 2026-10-18 · No universal coverage percentage; coverage = acceptance requirements covered (closes O-009)
Options: (a) reject the universal percentage, `spec-tests` reports expected/observed requirement
coverage, per-package thresholds only by declaration if a case appears; (b) keep STYNX's 100% as
template default until one module ships. Chosen: (a). Source: Owner.

## D-037 · 2026-10-18 · Independent reviewer executes on the pilot's machine, pre-push (closes O-011)
Options: (a) pilot's machine pre-push + CI re-run on PR; (b) CI only; (c) pilot's machine only.
Chosen: (c). No model keys in CI. `devai check --full` runs `review` locally with whichever CLI is
the other family; the PR carries `review.json` as evidence; CI verifies the candidate digest the
review was bound to matches the PR head, and otherwise reports `review: UNKNOWN (stale)`.
Acknowledged weakness: CI trusts a locally produced reviewer result (within D-002: CI is the only
consumer). Source: Owner.

## D-038 · 2026-10-18 · SLO measurement is a release gate only (closes O-012)
Options: (a) nightly + release gate; (b) release gate only (STYNX INV-PERF-001 practice); (c) per
campaign close. Chosen: (b). Packet acceptance verifies SLO declaration (D-005); measurement runs
in the release lane. Source: Owner.

## D-039 · 2026-10-18 · CI runtime modes: both modes on wiring changes and generator releases; declared mode otherwise (closes O-010)
A PR touching `devai.json`, `compose.yaml`, `scripts/ci-local/**`, `tools/**` or the generator runs
`needs: postgres` nodes in both bare and docker; other PRs run the declared mode; weekly full run
as backstop. Source: Owner.

## D-040 · 2026-10-18 · DDL band 80–89 = views and materialized views (closes O-008)
Band axis becomes: `00–08` tables · `11–14` functions · `21–24` RLS · `80–89` views and
materialized views · `90` assertions · `91–94` comments · `98` seed. Source: Owner.

## D-041 · 2026-10-18 · 02-architecture accepted at its consolidated length
`wc -w` 7,696 against a 4,000–6,500 brief; narrative prose 4,703 is inside the band; the overage is
the DAG table, the O-003 standards table and the state/budget tables, which are the specification.
Options: (a) accept as is; (b) drop the Standards column of the DAG table and shorten §12 (−450).
Chosen: (a). Source: Owner.

## D-042 · 2026-10-18 · Reviewer is read-only on the repository and may execute bounded counterexamples
Options: (a) read-only, no execution (Fable draft); (b) read-only plus bounded counterexample
execution in scratch storage (Codex draft). Chosen: (b). Repository access stays Read/Grep/Glob and
`git log/diff`; execution only against `.devai/cache/scratch/` (worktree copy, scratch DB from the
`db-apply` digest in the declared runtime); shares the node budget (≤ 20 tool calls, ≤ 5 min in
total); every finding carries `basis: observed|derived`; exhaustion degrades to `derived`, never to
`UNKNOWN`. The reviewer still never re-runs the DAG or the suite and never edits. Source: Owner.

## D-043 · 2026-10-18 · Applied-migration immutability is migration-linter rule LINT013 (S-24)
Options: (a) LINT013 in `tools/migration-linter`, next to LINT010 (unique prefix), LINT011
(`app.*` GUC only), LINT012 (`@pii` annotation); (b) a check in the `generated` node against the
pinned initial DDL. Chosen: (a): one tool owns every SQL rule; libpg_query already parses the files;
the rule compares each applied migration's hash with the committed manifest. Source: Owner.

## D-044 · 2026-10-18 · Status name `SKIPPED`, decided by `inventory` with evidence
A node whose inventory is empty by evidence (no Angular app, no `database/`) reports `SKIPPED`
(Fable's name) and the decision is `inventory`'s, never the node runtime's (Codex's semantics).
`N/A` is not a status. A node that *could not observe* is `UNKNOWN`, not `SKIPPED`. Source: Owner.

## D-045 · 2026-10-18 · S-31 and S-70 are enforced inside existing nodes
No `esm` or `request-id` node. S-31 (ESM only, D-012): `inventory` (package `type`, tsconfig
`module`), `lint` (no `require`, no CJS interop), `typecheck`. S-70 (UUIDv7 request id):
`route-contract` (middleware present) and `integration` (header observed). Node set stays at 28.
Source: Owner.

## D-046 · 2026-10-18 · `database/migrations/**` belongs to the `infra` protected class
Options: (a) fold into `infra`; (b) a seventh class `database`. Chosen: (a); the label set stays
at six (`spec`, `product`, `standards`, `infra`, `ci`, `acceptance`, `decisions` — six plus
`unplanned`). A schema change is visible through the migration linter report, not through a label.
Source: Owner.

## D-047 · 2026-10-18 · Edit-loop service level: measure first, provisional 90 s warm ceiling
Options: (a) provisional 90 s shaping the A/B partition, replaced by measured p95; (b) bind 90 s
now; (c) no target in the foundation. Chosen: (a). The binding value is the measured p95 on the
first STYNX and DETRAN modules in both runtimes, written into `devai.json`. **Provisional.**
Source: Owner.

## D-048 · 2026-10-18 · Example fixture uses fictional ids under a fictional product
Options: (a) real DETRAN rules verified against `product/`; (b) fictional ids (`RN-DEMO-nnn`,
`UC-DEMO-nnn`) in a `product/` fixture shipped with DEVAI; (c) both. Chosen: (b). No real DETRAN
rule is quoted in DEVAI's own docs or template; `spec-lint` resolves `source:` against the fixture.
Context: the round-1 draft fabricated a 72 h rule under the real RN-BOAT-119 (tachograph custody,
CTB art. 279). Source: Owner.

## D-049 · 2026-10-18 · O-003 closed — final standards table copied to 03-standards Part A
The merged table in `02-architecture.md` §12 (S-17, S-18, S-19, S-26–S-29, S-37, S-38, S-45, S-46,
S-61–S-67, S-71 plus amendments to S-24, S-31, S-40, S-70) is the final numbering; mapping from
both reviews in `agents/consolidate-1/NOTES.md` §3. The D-015 held items are disposed: S-45
(byte-verify, narrowed), S-61 (coverage = requirements covered, D-036), S-62 (taxonomy = layout
suffixes, no wiring tier), S-71 (pino + prom-client, no OpenTelemetry ban). Source: both reviews +
Owner.

## D-050 · 2026-10-18 · Packet ids are `PKT-<PRODUCT>-nnn` (closes cross-check 2 item 1)
Both round-2 drafts used the product-scoped grammar; 02 had `TASK-nnnn` in four places and 04 in
one. Chosen: `PKT-<PRODUCT>-nnn`, one id family with `RN-`, `UC-`, `SPEC-`; trailer
`Packet: PKT-DEMO-004`; files `packets/<CMP>/PKT-*.md`. 02 and 04 amended. Source: Owner.

## D-051 · 2026-10-18 · `code`/`fix` acceptance is all-green; `--expect-red` is for `test` packets only
Options: (a) keep 02 §8 / D-026 as written; (b) let a `code` packet name a subset of the spec's
`unimplemented[]` and be accepted with those cases red (Fable's 05 extension). Chosen: (a).
Partial delivery is expressed by scope (smaller spec, successor packet), never by accepting red.
`observations.unimplemented` is non-empty only for `kind: test`; entries are `R-n` ids resolved
against the spec's `unimplemented[]`. Source: Owner.

## D-052 · 2026-10-18 · `paths.forbidden` overrides inside `paths.allowed`
Options: (a) disjoint sets, contradiction check (round-2 brief); (b) override: forbidden wins
inside allowed (round-1 drafts). Chosen: (b). `packet-scope` checks changed ⊆ allowed and
changed ∩ forbidden = ∅; no disjointness rule. Source: Owner.

## D-053 · 2026-10-18 · Spec lifecycle: written statuses `draft` · `approved` · `superseded-by`; `frozen` derived; links both ways
Options: (a) four written statuses incl. `frozen`; (b) immutable after first pin, backward
`supersedes` only (06 draft); (c) three written statuses, `frozen` derived from packets pinning
(`base`, sha256), successor carries `supersedes: {id, path, sha256}`, predecessor receives exactly
one post-pin edit — its status line becomes `superseded-by: <SpecId>` — and `spec-lint` SL09
checks the pair agree. Chosen: (c). Old packets are unaffected (they hash `git show <base>:<path>`);
a new packet may not pin a spec whose HEAD carries `superseded-by`. Source: Owner, after the
lifecycle explanation.

## D-054 · 2026-10-18 · Consolidation rulings from cross-check 2 (no Owner choice needed)
- Spec path is nested per 04 §1: fixture at `specs/notes/SPEC-DEMO-001.md`.
- `review.json` tracked at `.devai/review/<packet-id>.json`, excluded from the candidate digest
  and from `packet-scope` (02 §11 amended).
- Acceptance file name derived from the spec id: `<lowercase-spec-id>.acceptance.spec.ts` in
  `domain/<m>/api/test/acceptance/`; one top-level `it('R-n: …')` per `acceptance: yes`
  requirement; 04 §4 gains an acceptance tier row excluded from `unit`'s `*.spec.ts` glob.
- `inventory` `SKIPPED` evidence is a repository population predicate per node (e.g. `no mounted
  routes in domain/<m>`), never a closed list of prose strings and never the spec's empty
  collection alone (D-044).
- Generator emits `@RequireRoles(roles, 'all')`; `route-contract` compares the same (02 §7
  amended; S-28 allows either decorator, both sides must agree).
- String limits count UTF-16 code units (what zod `max`, the generator's `value.length` and
  `sql-typed`'s comparison against `character_maximum_length` all read); a UTF-16 bound never
  exceeds a Postgres character bound, so it is conservative. 06's "Unicode code points" wording and
  the R-2 astral-character case are corrected.
- The fixture's `unimplemented[]` lists every requirement whose observable depends on
  unimplemented behaviour (R-1, R-2, R-4 at least) so the fixture's own `test` packet can be
  accepted; drafting tags (`[opinion]`) are stripped from shipped fixture bytes; the spec digest is
  recomputed after these edits.
- 02 §9 bounds sentence distinguishes input exhaustion (→ `UNKNOWN`) from counterexample-budget
  exhaustion (→ `derived`).
- `spec-lint` SL09 history input is bounded to the spec's previous blob at `base` and executed by
  `packet-scope`, which already has `base`; SL10 digest equality likewise.
Source: both cross-check-2 reviews, adjudicated by orchestrator.

## D-055 · 2026-10-18 · Remaining specification set and the second-system brake
The v2 → v3 transition repeats the legacy → v2 pattern in substance (law cleaned up with
amendments folded in; ADRs consolidated and distributed to their owners — law or specs; code
rebuilt clean; library/framework choices reviewed), not in ceremony. Governing constraint: v2 was
the second system (Brooks, *The Mythical Man-Month* ch. 5); v3 is built under restraint. Rules for
every further document: an element exists only if a named v3 mechanism depends on it; no new node,
state, command, file or field unless 02/05/06 already requires it; prefer what STYNX already uses;
every document carries a "what we are not building" section. Remaining documents, in order:
07 dependency and runtime review · 08 CLI + check-node contracts (one document) · 09 rail
(generator, template, `demo` fixture as shipped) · 10 agent surface (remaining SKILL.md texts,
AGENTS.md, hook messages, reviewer prompt) · 11 STYNX migration items + v2 ADR consolidation
ledger (each v2 ADR → absorbed-into-decision / absorbed-into-spec / journal) · 12 succession plan
(identity, seed commit, host ceremony, pins). Package/repo identity and founding version are
decided in 12. Source: Owner ("Agree. Do it").

## D-056 · 2026-10-18 · Schema validation is zod only; JSON Schemas are emitted from zod
Options: (A) zod only — every artifact schema (`devai.json`, packet front matter, spec machine
block, `product/use-cases/*.json`, `review.json`, sensor verdict) is a zod definition;
`devai.schema.json` (D-034 `$schema`) and the use-case JSON Schema are emitted with
`z.toJSONSchema()` and committed; uniqueness constraints are `superRefine`s and do not project
into the emitted schema (editor validation may accept what `spec-lint` rejects; caught inside the
loop); (B) zod + Ajv 8 executing hand-written JSON Schemas exactly. Chosen: (A). 06 §3 wording
amended to "emitted from the validator's definition"; the DEVAI build verifies every artifact
schema projects. Source: Owner, after impact analysis.

## D-057 · 2026-10-18 · Consolidation rulings from cross-check 3 (07)
- "ESM only" (D-012, S-31, D-045) means authored source and emitted output are ESM (`type:
  module`, `module`/`moduleResolution` NodeNext, `.js` relative specifiers); third-party CJS is
  imported natively; `lint` forbids authored `require`, `createRequire`, `module.exports`,
  `__dirname`/`__filename`; STYNX's CJS backend output remains a migration item.
- `ignore` 7.0.5 (gitignore semantics) is the one matcher for `paths.allowed/forbidden` (D-052,
  forbidden wins), protected-path classes and tier globs; Node's `path.matchesGlob` does not
  implement the 05 dialect (probe 2026-10-18).
- Hooks: `devai init` sets `core.hooksPath`; no husky.
- Output: plain text and JSON only; no colour dependency.
- Reviewer and sensor transport: prompt on stdin (a 60k-token slice exceeds Linux `MAX_ARG_STRLEN`);
  explicit flag lists with output-schema arguments; Claude `structured_output` / Codex terminal
  event extracted; result validated by the zod schema that emitted the CLI's schema argument.
- Development runs emitted JS (`tsc -b`, `node dist/main.js`); no tsx; Node type stripping cannot
  resolve `.js` specifiers to `.ts` (probe 2026-10-18).
- TypeScript is a runtime dependency of the CLI (`~6.0.3`, lock-step with `@stynx-nyx/tsconfig`):
  library for `route-contract`, `sql-typed` static, `test-integrity`, `permissions-pattern`;
  binary for `typecheck` and `inventory` (`tsc --showConfig`).
- No runtime pin file: `engines >=24 <25` + `packageManager pnpm@9.15.0` are the pin; exact host
  patches are release pins (12).
- D-029 extended (acknowledged, no preference stated): STYNX ships `verify-api-coverage`,
  `list-routes`, `verify-openapi-contract`, `verify-public-api-baselines`, `verify-rls-negative`,
  `verify-stynx-boundary` as callable entry points of `@stynx-nyx/cli` with machine-readable
  output, and `@stynx-nyx/eslint-config` publishes the `./test` profile; dependent nodes report
  `UNKNOWN: tooling missing` until then. STYNX migration item (11).
- Token bounds (02 §4, §9) use a bytes-per-token proxy before the call and the CLI's reported
  usage after; no tokenizer dependency (08).
- 03 Part B S-20 note: the SDK generator is "deprecated and unmaintained upstream", not archived
  (`gh api` 2026-10-18: `archived: false`).
Source: both cross-check-3 reviews, adjudicated by orchestrator; Owner declined a preference on
the D-029 item.

## D-058 · 2026-10-18 · Rulings from cross-check 4 (08 CLI and node contracts)
Owner choices: (1) "temperature 0" struck from 02 §4 — neither `claude` 2.1.292 nor `codex exec`
0.163.0 exposes it; determinism comes from the verdict cache (slice digest + prompt digest + model
id). (2) `format` narrowed to Prettier's languages `*.{ts,mjs,json,md}`; SQL belongs to `sql-lint`
(Prettier 3.9.6 has no SQL language; no plugin added). (3) Consolidation base for 08 is Fable's
draft (it binds every mechanism 02 requires); Astra's fail-closed corrections are imported item by
item; Fable consolidates alone.
Orchestrator rulings (both reviews agree unless noted):
- `devai check --hook pre-commit|pre-push|commit-msg` is the binding of 02 §2's hook subsets, not
  a new command; hook scripts live in `scripts/hooks/` (04 §1, already `protected:ci`); pre-commit
  checks the **staged** snapshot (index bytes, modes, deletions), not working-tree files.
- `check.editLoopCeilingMs` is the `devai.json` key D-047 writes to; template value 90000,
  provisional.
- No per-node `gating` field in `report.json`; gating derives from `review.mustRun` and
  `protected:unplanned`; the summary prints `mustRun`/`tallied`.
- Exit codes: 0 = no gating FAIL/UNKNOWN; `accepted: true` only on `--packet --full`; deferred
  nodes listed in `accept` details without a status (02 §8 amended).
- `spec-tests` reachability: a case is `evaluated` when a chai `AssertionError` with a source-mapped
  frame inside the acceptance file's `it` body is observed (Vitest 4.1.11 reporter API); 06 §5
  gains the rule that a named expected-red case carries no rail assertion (rail behaviour is its own
  requirement), which makes the classifier sufficient; otherwise `UNKNOWN assertion-unresolved`.
- Token admission proxy `ceil(utf8Bytes / 3.5)` before the call (1 byte/token would make every
  STYNX adopter's sensor UNKNOWN by construction — `packages/auth/src` is 93 kB); CLI-reported
  usage after the call is binding; missing usage → UNKNOWN; first-call calibration recorded in 12.
- Sensor verdict evidence travels in the PR branch at `.devai/review/<packet-id>.permissions.json`
  bound to the slice digest (02 §11 amended); CI verifies the digest, never calls a model.
- `inventory` computes the mounted-route census from static `imports`/`controllers` arrays via the
  TypeScript library (D-057's library-consumer list grows to five; STYNX's `list-routes` parser is
  declaration-only by its own comment); dynamic module factories → `UNKNOWN mount-unresolved`;
  class-A cost measured under D-047.
- Query-text digests have a slot: `nodes[sql-typed].details.queries[].textSha256` (02 §3 step 5).
- `typecheck` invokes `tsc -b --pretty false` without a trailing `--` (TS 6.0.3 rejects it, TS5072).
- Reviewer isolation is not established by a scratch cwd: read-only repository and no-network are
  capability checks; unsupported → UNKNOWN (07 §6).
- `boundary`: missing `.stynxrc.json` is FAIL (04 §1 ships one), never SKIPPED. `init` and `new
  module` write product files per 02 §1/§7 (02 §11 lists runtime state only). `packet-scope` and
  `review` without a packet are deferred, not SKIPPED (D-044).
- `devai init` is the template command; 02 §1 amended (`devai new app` removed).
- 02 §3 step 3 (`EXPLAIN` cardinality "warning only") has no channel in the one report shape: struck
  from 08's obligations; 02 to decide finding-or-nothing later (open, non-blocking).
Source: Owner (three choices) + both cross-check-4 reviews, adjudicated by orchestrator.

## D-059 · 2026-10-18 · Owner rulings on the campaign items (09, 11)
Owner panel after the unattended campaign (`agents/campaign/OWNER-PENDING.md`); each the recommended option.
- P-5-13 pt-BR vs the fixed fixture — options: (b) successor SPEC-DEMO-002 for pt-BR workspaces;
  (c) revise 06 §7 once. Chosen: (c). E-5-10 applied with the five pt-BR strings as proposed
  (approved by the Owner); 06 §2 admits any D-014 locale; fixture re-pinned once: 9,546 bytes,
  sha256 `8f7a69558bb4fc15eb0b075ab9a4352520246c75a7fea6acef555bedba8ae160` (06:1, 05 §7, 09).
- P-7-03 `@ErrorContract`/`@UseCase`/`@Slo` home — options: (a) STYNX; (b) v3. Chosen: (b), per the
  correction at `decisions.md:232`; 12 names the package; STYNX keeps `@Idempotent/@NoIdempotent`,
  `@Permission`, `@RequireRoles` exported (11 SM-10).
- P-7-04 applied STYNX SQL (duplicate `0012`/`0018`, legacy `auth.*`/`stynx.*` GUCs) — options:
  (a) renumber and rewrite; (b) LINT010 exemption list; (c) never rewrite. Chosen: (c): duplicates
  stay; a new migration recreates the policies on `app.*` (D-033; 11 SM-05).
- P-7-05 session revocation under S-12 — options: (a) TTL only; (b) one lookup per request;
  (c) sensor unchanged. Chosen: (c): session/permission reads leave the request path; revocation
  is a STYNX design item inside the sensor's rule (D-025; 11 SM-14).
- P-7-06 SDK check form — options: (c) bin `stynx-sdk-codegen --check --input <openapi.json>
  --output <dir>` in `@stynx-nyx/sdk`, exit 0/1, no writes; (d) seventh `@stynx-nyx/cli` entry
  point. Chosen: (c). E-7-04 applied to 08 B.16; D-057's six entry points unchanged (11 SM-18).
Source: Owner panel 2026-10-18.

## D-060 · 2026-10-18 · Consolidation rulings from cross-check 5 (09 rail) adopted; 09 ratified
P-5-01…P-5-12 adopted as ruled in `agents/campaign/DECISIONS-PROPOSED.md`: catalogs are headed TS
literals `api/src/<slug>.i18n.<locale>.ts` (01); module `api/package.json` seed and
`api/tsconfig.json` generated (02); generated header is 02 §7's literal text (03); root manifest
`database/seed/modules.txt`, sha256sum form, module baselines before root migrations (04);
base-present module SQL leaves `generated`'s replay (05, D-043); release matrix: no exemption,
`review`/`permissions-pattern` evidence produced pre-push and digest-verified in CI (06); `--web`
components only for declared GET routes (07); no service spec, stub throws
`NotImplementedException` (08); no `CONTRIBUTING.md` (09); `acceptance/.gitkeep` is seed (10);
package tsconfigs plus one root `tsconfig.test.json` (11); product roles only, STYNX
parameterisation is a release prerequisite (12). Edits E-5-01…E-5-13 applied to 02, 04, 06, 08.
`09-rail.md` PROVISIONAL header removed. Source: Owner ("adopt all, apply, ratify").

## D-061 · 2026-10-18 · Consolidation rulings from cross-check 6 (10 agent surface) adopted; 10 ratified
P-6-01…P-6-09 adopted as ruled: `pnpm test` kept, root `scripts.test` = `devai check --only unit`
(01, E-6-05); `permissions-pattern` question is 02 §4's byte for byte (02); worker's `devai-review`
offers only `not-a-defect` (03); C.2 gains `ReviewPhase1` and `ReviewModelOutput` (04, E-6-02);
`generator-unavailable` hint unchanged (05); budget = static table + counted `context` row,
listing normalisation and harness overhead, no 05 amendment (06); test re-derivation sparse set =
every manifest `seed` entry at `base` plus `api/src/`, `web/src/`, with an absence check (07);
reviewer prompt = fenced slots plus a kind branch, no budgets or unexamined-ids request (08); hook
stage line on stdout immediately before `exit <code>` (09, E-6-03). Edits E-6-01…E-6-06 applied to
02, 05, 08, 09 (E-6-06 by its header form; the round-2 block stays as source). `10-agent-surface.md`
PROVISIONAL header removed. Source: Owner ("adopt all, apply, ratify").

## D-062 · 2026-10-18 · Consolidation rulings from cross-check 7 (11) adopted; 11 promoted PROVISIONAL
P-7-01 (REJECTED only where the decision text names and rules out the record's mechanism — D-002,
D-005, D-018, D-019, D-036; every other split JOURNAL, `confidence: low`) and P-7-02 (on an
ABSORBED vs non-ABSORBED split the non-absorbed bucket wins; targets re-anchored to binding text)
adopted. Edits E-7-01…E-7-04 applied to 02, 03b, 08. `11-migration-and-ledger.md` and
`11-ledger.json` (316 rows; all sha256 values re-verified against v2 @ 4289ff51, 41 article
hashes over their line ranges) promoted to `foundation/` as **PROVISIONAL**. Options: promote
PROVISIONAL / promote final / keep in `agents/`. Chosen: PROVISIONAL. Source: Owner.

## D-063 · 2026-10-18 · v3 package identity and founding version (12)
Options (identity): (a) `@devai-nyx/cli`, mirroring STYNX's `@stynx-nyx/*` scope, with v3's own
decorators (D-059 P-7-03) in a sibling `@devai-nyx/*` package; (b) `@stech/devai`, one package with
a subpath export; (c) unscoped `devai`. Chosen: (a); the sibling package's exact name is fixed in 12.
Options (version): (a) 3.0.0, continuing the v2.6.2 lineage; (b) 1.0.0, a new package. Chosen: (a)
3.0.0. Source: Owner panel 2026-10-18.

## D-064 · 2026-10-18 · Owner rulings on round 8 (12 succession)
Owner panel on `agents/campaign-8/OWNER-PENDING.md`:
- P-8-01 repository — (a) new `devai-nyx/devai-v3`; (b) take `devai-nyx/devai`. Chosen: (a).
- P-8-02 DEVAI repository checks — (a) `ci.yml` `build` + 02 §7 `matrix`, no `devai.json`; (b) also
  self-check with adopter files. Chosen: (a).
- P-8-03 STYNX gate for 3.0.0 — (a) template-gating rows SM-01–04, 06–08, 10, 13–20; (b) all
  SM-01…20. Chosen: (a); SM-05, 09, 11, 12 gate STYNX's own adoption.
- P-8-04 ledger review — (a) batches A (125) + B (4) one "as recorded" ruling, C (57) in three
  panels, any row separable; (b) ~16 area panels. Chosen: (a).
- P-8-05 first DETRAN module (D-026) — (a) `domain/inf-rait-worklist`, "claim next"; (b) another.
  Chosen: (a).
- P-8-06 fixture R-2/R-4 rail assertions (D-058) — (a) split into green rail requirements;
  (b) Owner wording. Chosen: (a), wording approved as previewed: R-2 = accept/persist at bounds,
  R-4 = cross-tenant 404 indistinguishable (both stay in `unimplemented`); new green R-5
  input-rejection and R-6 rls-visibility; six acceptance cases. Fixture re-pinned: 10,035 bytes,
  sha256 `12e9041f6e1637b7e3a55d7e2626b11725381b40f8d5392e32458f6233f7f30a`; propagated to
  05 §§4–7, 06 §§5, 7, 8, 09, 10. Supersedes D-059's digest.
- P-8-07 publication — (a) tag-triggered CI job with `GITHUB_TOKEN` after `build`+`matrix`;
  (b) Owner PAT locally. Chosen: (a).
- P-8-08 STYNX generator bytes (BUSL-1.1) in the Apache-2.0 CLI — (a) reimplement from 09 §5,
  no STYNX bytes; (b) NYXK relicenses the carried code to Apache-2.0. Chosen: **(b)** (not the
  recommended option): the relicensing act is an Owner/NYXK R0 prerequisite before R6.
- P-8-09 package visibility — (a) private; (b) public. Chosen: **(b)** (not the recommended
  option; irreversible): `@devai-nyx/cli` (including existing 0.1.0–0.8.0) and
  `@devai-nyx/decorators` public; host step H8 in 12 §5.
Source: Owner panel 2026-10-18.

## D-065 · 2026-10-18 · Round-8 consolidation rulings adopted; 12 promoted PROVISIONAL
P-8-10…P-8-18 adopted as ruled in `agents/campaign-8/DECISIONS-PROPOSED.md`: the twelve foundation
documents cross into `docs/framework/` as bytes after R0 (10); seed independent of STYNX `<v>`,
no `main.ts`, tsconfigs and schema projections at R6 (11); no succession folder or hash list in
the seed (12); only `aarusso-nyx/devai` is archived (13); SLO measurement stays in product release
lanes (14); adopters move by fresh scaffold, new repository or migration branch (15); adopters
keep the exact 2.6.2 pin until they move (16); branch protection by plain contexts with read-back
(17); no Changesets in the DEVAI repository (18). Decorator package: `@devai-nyx/decorators`
(D-063). Edits E-8-01…E-8-20 applied (E-8-17 with D-064's wording; 10 §5 budget rows recounted:
AGENTS.md 42 lines, 578 tokens); E-8-21 waits for the ledger ruling. `12-succession.md` promoted
to `foundation/` as PROVISIONAL, revised for D-064's two non-default choices. Source: Owner
("adopt all and apply"; "promote as PROVISIONAL").

## D-066 · 2026-10-19 · v2 law ledger review closed; 11 final, 12 ratified
Four Owner panels per D-064 (P-8-04) over `agents/campaign-8/LEDGER-REVIEW.md` (one line per row):
panel 1 = batches A (125, REJECTED↔JOURNAL) + B (4, ABSORBED target choice); panels 2–4 = batch C
by owner — spec 27, standards 17, decisions 13. Options per panel: ratify as recorded / flip named
rows to their alternative. Chosen: ratify as recorded, all four panels; no row flipped, so no
foundation edit follows. The 186 rows' `confidence` reads `low; ruled as recorded (D-066)`;
`alternative` kept. Final counts: REJECTED 193 · JOURNAL 90 · ABSORBED-SPEC 17 · ABSORBED-STANDARD 9
· ABSORBED-DECISION 7 (316). `foundation/11-ledger.json` sha256 `e06736842b1fba2b373c06bf93e73713bb7df590ed6bb8993da0b8a6916e37e3`. E-8-21 applied: 11 final;
12's PROVISIONAL header removed. 11, the ledger and 12 are bootstrap history, never edited again.
Source: Owner panels 2026-10-19.

## D-067 · 2026-10-19 · NYXK relicenses the STYNX generator code to Apache-2.0 (closes D-064 P-8-08 R0 act)
NYXK, Licensor of STYNX's BUSL-1.1, additionally licenses `stynx:packages/cli/src/generate-module.ts`
@ `63e5f788` (509 lines, sha256 `41d2fe3f899bf7553ef14c2d639755dfaaebfb3cb07733d48ba1f43d31cbe648`;
imports only Node built-ins) and its DEVAI v3 derivatives under Apache-2.0. The rest of STYNX stays
BUSL-1.1 and STYNX's repository is not modified. Grant text: `agents/relicense-2026-10-19/GRANT.md`
(sha256 `c8918388bde8f57608b9c4a2b7196393a16951430fa3cedd9e93440e2bd5cc89`). Carried files open with `SPDX-License-Identifier: Apache-2.0` and a provenance line
citing D-067; they enter at R6 with the generator, not the seed. Source: Owner, as owner of NYXK
("I, as owner of NYXK and this project, mandate you proceed with Apache relicensing").

## Open
- D-026 is provisional until the first DETRAN module is built with `kind:` packets.
- D-047 is provisional until the edit-loop p95 is measured on STYNX and DETRAN in both runtimes.
- Mutation testing's home (D-004: outside the cycle or not at all) — not blocking v3.0.
- 02 §3 step 3 `EXPLAIN` cardinality heuristic: finding or struck (D-058) — not blocking v3.0.
