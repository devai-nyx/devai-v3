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
Amended 2026-10-24 (D-080): the control-defining paths (`.github/**`, `scripts/hooks/**`,
`devai.json`) are the one place where the merge gate must not be definable by the PR it gates;
that is enforced by a ruleset-required workflow pinned to `main`, not by human review.
Amended again 2026-10-24 (D-091): the ruleset is retired (GitHub Free cannot express it); the PR
can redefine its own check and the residual risk is stated in D-091, still not met by human review.
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
Acknowledged weakness (reworded by D-079, 2026-10-24): CI trusts two locally produced,
worker-committed files (`.devai/review/<id>.json`, `<id>.permissions.json`) whose digests it can
verify and whose provenance it cannot; the worker family that selected the reviewer is the worker's
own declaration, recorded in `review.json` as `workerFamily` and `workerTrailers`. Accepted within
D-002: CI is the only consumer, and attestation is excluded (07 §7). Source: Owner.

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
  capability checks; unsupported → UNKNOWN (07 §6). (Since D-082 the capability is the host CLI's
  enforcement, sandbox and tool denial, checked in the stream as a second signal.)
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
("adopt all and apply"; "promote as PROVISIONAL"). Superseded in part by D-090 (item 13's timing; item 16).

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

## D-068 · 2026-10-19 · R2 passed; `sql-typed` describes through a pg Submittable (08 B.10 amended)
R2 (12 §4), the 08 B.10 adapter prototype, ran on PostgreSQL 16.15 bare (Homebrew) and docker
(`postgres:16-alpine@sha256:721873c3…a080ea`) with `pg` 8.23.1 / `pg-protocol` 1.16.1, sending only
Parse/Describe/Close/Sync. All cases met 12 §4's expectations identically in both runtimes: empty
SELECT and INSERT … RETURNING described (row count unchanged, no prepared statement left), INSERT
without RETURNING → `noData`, `point` → UNKNOWN `unsupported-oid 600`, parse error → FAIL SQLSTATE
42601 with the client still usable, terminated backend → UNKNOWN `postgres-unreachable`. 02 §3 is
not reopened. Rulings: (1) 08 B.10's literal `client.connection.parse/describe/sync` sequence is
replaced by one pg Submittable per query (`parse`, `describe`, `close`, one `sync`), because the
literal form makes the Client unqueryable ("Received unexpected rowDescription message from
backend."); (2) a Client `'error'` listener is mandatory; (3) prepare findings carry the SQLSTATE,
and cross-runtime comparisons key on it, since the server message follows `lc_messages` (bare
printed it in Portuguese, docker in English). Options for (1): Submittable (public API) / detach the
Client's listeners during describe / a raw `Connection` with own startup and auth. Chosen:
Submittable, the only one on public API. Evidence: devai3 `agents/r2-pg-prototype/`
(`RESULT.md`, `prototype.mjs` sha256 `b5c165af5d42d521acd963c01ef8ceb31b1d561580e3594755f04132e840b6c7`,
`result-bare.json`, `result-docker.json`). Source: R2 run, adopted by the Owner.

## D-069 · 2026-10-19 · R3 STYNX wave 1: LINT010 scope, tool publication and release wiring
Rulings taken while landing SM-02/03/04 (stynx-nyx/stynx#400; superseded #397, #398, #399):
- LINT010 (SM-04) — options: (a) a collision counts only when it involves a file absent from
  `--base-dir` (the merge base); (b) scope LINT010 to product roots only; (c) leave STYNX's
  `migration-lint` red. Chosen: (a). Applied history is immutable like LINT013 (D-033, D-059);
  STYNX's permanent 0012/0018 duplicates stay green; without `--base-dir` every file counts as
  new. STYNX's `lint:repo` computes the merge base itself. Source: Owner.
- Tool packages become publish-ready in their own item — `@stynx-nyx/tsconfig` (not private, no
  checkout `paths`; aliases move to STYNX's internal `tools/repo-config/tsconfig/`),
  `@stynx-nyx/migration-linter` (not private), `@stynx-nyx/eslint-config` (private until
  SM-21) — but STYNX's closed release roster (44 packages, first publications pinned to none),
  changeset fixed group and discovery roots are changed once, for all three, in SM-21. Each
  item carries a no-release changeset. Source: orchestrator, Owner approved the private flips.
- Landing: wave 1 is one combined STYNX PR with one signed local RC (`verified-local-rc`)
  instead of one per item. Source: Owner.
- STYNX-local facts recorded for 12: its local RC toolchain law now pins Postgres.app psql 18.6
  (STYNX ADR-DEVAI-ADOPTION-0025); its RC must run from a non-worktree checkout whose directory
  is named `stynx` (DEVAI derives the authority repository id from it) and that carries the
  local `refs/archive/*` history its release tests read; STYNX's release census now accepts
  standing no-release changeset acknowledgements (Owner ruling). Open: STYNX's local RC tests
  PostgreSQL 18 while its CI and this foundation use 16 (07 §4, 12 §3).
Source: Owner panel and directions 2026-10-19.

## D-070 · 2026-10-19 · Product role prefix is applied by STYNX's migration runner; apply.sh calls it
SM-06 (stynx-nyx/stynx#401) parameterises the platform roles at apply time: `stynx migrate
up|down|redo --role-prefix <p>` and `StynxDataModuleOptions.migrations.rolePrefix` rewrite only the
identifiers `stynx_(owner|app|reader)`; default `stynx` returns the SQL unchanged and the ledger
checksum stays the file's, so applied bytes are immutable (D-033) and LINT013 is unaffected.
Consequence for 09 §1 — options: (a) step 2 of `database/apply.sh` runs `stynx migrate up
--role-prefix <productPrefix>` with `PG*` variables (STYNX makes `--database-url` optional); (b)
`apply.sh` rewrites the platform SQL itself (a template compatibility layer, against 07 §5 and
P-5-12); (c) keep `psql -f` and stay on `stynx_*` roles (fails S-18). Chosen: (a); 09 §1 amended.
No URL on argv (E-5-08). Source: orchestrator under the Owner's standing authorisation
(recommended option).

## D-071 · 2026-10-19 · R4 STYNX wave 2: design rulings (SM-07/08/10/13/14/15/16/17/18/19/20)
Landed in stynx-nyx/stynx#400 together with wave 1 (one signed local RC, Owner's D-069 choice);
superseded #401-#406. Rulings recorded for 08/09/12 and the v3 template:
- Check entry points (SM-07): six `stynx` commands share one JSON report (status, counts,
  findings with `path:line`); exit 0 PASS / 1 FAIL / 2 UNKNOWN with a reason; check forms never
  write; `.stynxrc.json` keys read: `apiCoverage`, `publicApi`, `openapiContract`, `rlsNegative`.
  A zero-observation run exits 0 with `observed: 0`; the v3 runner maps it to UNKNOWN (08 §0).
- SDK (SM-18): `stynx-sdk-codegen` is STYNX-owned (a port of openapi-typescript-codegen 0.31.0,
  MIT) because the maintained successor drops the class clients the published SDK exposes;
  prettier is an optional peer; regenerated output differs only in the provenance header.
- Typed queries (SM-08): `Transaction.run` only (no standalone `run`); `sql` uses the cooked
  string; errors carry query name and zod path/code, never values; `one` with 0 rows →
  `NotFoundError` (404); more rows than `expects` allows → `QueryCardinalityError` (500); the
  row schema strips undeclared columns.
- Authorization (SM-14, within D-059): token lifetime clamped to the session's deadlines;
  `perms`/`roles` minted at issuance and refresh; a token without them is refused (401), never
  looked up; revocation = in-memory session-id list refreshed off the request path (1 s), fail
  closed (503) when stale (15 s). Permission changes take effect at token refresh.
- Request id (SM-15): missing and invalid ids get the same 400 `{code: VALIDATION, messageKey:
  REQUEST_ID_INVALID, requestId: null}` before authentication. Probe routes — options: (a) no
  exemption, probes send a fixed valid UUIDv7; (b) exempt health routes. Chosen: (a) (no new
  mechanism, D-055). Browser ids are UUIDv7 from `crypto.getRandomValues` (SM-16).
- i18n (SM-19): default locale en-US; feature modules call `registerCatalog` from
  `onModuleInit`; no filesystem scan unless `workspaceRoot` is set. Static module metadata
  (SM-20) for core, data, auth, i18n; `StynxPlatformPipelineModule` stays option-driven, so
  `inventory` reports it as `UNKNOWN mount-unresolved` per D-058 if a product mounts it.
- Test databases (SM-17, committed, pending an Owner receipt): `createTestApp` reads only
  `DATABASE_URL` and fails closed without it; it creates and drops a uniquely named scratch
  database on that server. Options: (a) allow test support to create per-app sub-databases;
  (b) use the supplied database directly. Chosen: (a). The drop needs the Owner's
  FORBID-DROP-PROD receipt for the exact commit in STYNX.
- Not yet covered (follow-ups): the SDK transport does not mint request ids (consumers add the
  header); `packages/cli/src/generate-module.ts` still emits extensionless relative imports;
  the STYNX RC task `db:rls` does not select the new CLI engine files.
Source: orchestrator under the Owner's standing authorisation (recommended options).

## D-072 · 2026-10-21 · Liveness and readiness probes may omit the request id (revisits D-071)
The Owner revisited D-071's SM-15 probe ruling and chose option (b): exempt the health routes.
- A `GET` or `HEAD` on exactly `/healthz` or `/readyz` (query string allowed) that sends no
  `X-Request-Id` is served without a request context and echoes no id. Orchestrators and load
  balancers probe without a client id. A probe that sends an id is still held to UUIDv7, so an
  invalid one is the SM-15 400. Every other route and method keeps the SM-15 rejection.
- S-70 is amended accordingly (03, 03b, 02 `integration`, 08 B.22, the 09 template test).
- STYNX: `isProbeRequest` in `@stynx-nyx/core`, applied in the CLS request seed and in
  `RequestContextInterceptor` [fact: `stynx:packages/core/src/request-id-rejection.ts:20-38`,
  `stynx:packages/core/src/core.module.ts:55`, `stynx:packages/core/src/request-context.interceptor.ts:72`],
  commits `aceca908` (code), `dde6a84e` (tests), `c454ce64` (rebind) on stynx-nyx/stynx#400. The
  CI health-gate workflow edit prepared under D-071 (a) is dropped and needs no receipt.
- [opinion] Cost: one small mechanism where D-071 chose none (D-055). Accepted because every
  deployment's probes would otherwise need a configured header.
Source: Owner, 2026-10-21.

## D-073 · 2026-10-21 · Stale-text corrections found by the docs set (devai-v3#14–#30)
Writing the docs set (#4) found framework text that no longer matches decisions already taken. Each
item below aligns the text with the decision it cites; no node, state, command, file or field is
added (D-055). Two items needed a choice; the Owner ruled on both.
- **D-046 (#14).** D-046's "the label set stays at six" is read as: the class set stays at
  seven (`spec`, `product`, `decisions`, `standards`, `infra`, `ci`, `acceptance`; no `database`
  class), and the labels are the seven `protected:<class>` plus `protected:unplanned` (02 §5,
  08 A.8). D-046 itself is not rewritten.
- **D-064 fixture re-pin not propagated (#15–#18).** 09's provenance header names the 10,035-byte
  `12e9041f…` digest as current; 09 §2 attributes input rejection to R-5; 08 B.21's example reads
  `expected 6, observed 6`; 05 §2's summary line follows 08 C.3's `requirements covered` grammar.
- **05 §7 example (#19).** The shipped template seeds `apps/web` and `test/e2e/shell.playwright.ts`
  (09 §1.1), so neither `i18n` nor `e2e` can be SKIPPED on it; the example skips `sql-lint` and
  `actionlint` only.
- **PL-06 (#20).** `CONTRIBUTING.md` leaves PL-06's root-file list (D-060, E-5-05; 04 §1, 09 §1.1).
- **S-12 (#21).** 03 Part C follows D-009: no lint guards S-12, runtime enforcement is ruled out,
  the narrow agentic check (`permissions-pattern`, 02 §4) guards it.
- **One copy (#22).** 03's verbatim copy of 02 §13–§14 is replaced by a pointer; 02 is the copy.
- **02 §6 sample (#23).** The sample lists all seven classes and `check.editLoopCeilingMs`, so it
  validates against 08 A.8 (D-047, D-058).
- **02 §9 (#24).** Besides `review.json` and `.devai/review/<packet>.permissions.json`, both tracked
  on the PR branch (02 §11, D-037, D-058), the reviewer writes nothing into the repository.
- **08 §0 (#25).** v3 has five commands (seven invocations, 08 Part A).
- **Summary node count (#26).** 08 C.3 left `<n>` undefined and 02 §8, 05 §7 read 26 against 28
  contracts. Options: (a) every planned node, `accept` and SKIPPED included (28 under
  `--packet --full`); (b) every planned node other than `accept`, i.e. B.28's `expected` (27).
  Chosen: (a), because it is the length of `report.json`'s `nodes` array (08 C.2) and the 28 the
  node set is known by. 02 §8 and 05 §7 now read 28.
- **Spec folder (#27).** `specs/<module.slug>/` (06) and `specs/<area>-<capability>/` (04, 02) name
  one folder: the module slug is 04 §1's `<area>-<capability>`, as `domain/<slug>/` is.
- **Locales (#28).** Options: (a) only en-US and pt-BR, as a zod enum; (b) any canonical BCP 47 tag,
  en-US first (08 A.8 as written). Chosen: (b). D-014 fixes the default and opts pt-BR in; it
  limits nothing, so 06 §2's two tags are examples.
- **Standards rows (#29).** 08 B.9 (`route-contract`) cites S-29 and B.25 (`protected-paths`) cites
  S-63, as 03 Part A says they enforce them.
- **Release workflow (#30).** 12 is bootstrap history and is not edited (D-066). `ci.yml` is the
  record where it differs from 12 §5: `matrix` also runs on every `v*` tag and fails tags until R8,
  so `publish` cannot run on an unfilled matrix; `publish` runs `pnpm -r publish --no-git-checks`
  because a tag checkout is detached.
Source: Owner, 2026-10-21 (rulings on #26 and #28; the corrections adopted as drafted).

## D-074 · 2026-10-21 · Rulings on the docs-set gaps that need a choice (devai-v3#7–#13)
All seven were found while writing the docs set (#4). The Owner adopted every recommendation; the
framework amendments named under each item are applied.
- **Human-only packets and `permissions-pattern` (#7).** The sensor runs the reviewer command of the
  worker family, read from `Co-Authored-By` trailers (08 B.24, A.8), and gates while
  `review.mustRun` is false, so a packet with no agent trailer is `UNKNOWN: family` and
  `--packet --full` exits 2. Options: (a) intended: `--full` needs agent-authored commits, stated
  in 02 §4 and the quickstart; (b) when no family resolves, the sensor runs the first configured
  reviewer in `Family` order (`claude`, then `gpt`), recorded in the permissions file; (c) the
  sensor reports a non-gating `UNKNOWN` when no family resolves. Recommended: (b). The sensor
  checks S-12 compliance, not independence, so who runs it does not matter; (a) refuses work by
  commit signature, which D-019 rules out; (c) leaves S-12 unguarded on exactly the packets nobody
  reviews. `review` keeps `UNKNOWN (family)` (02 §9): a missing trailer cannot prove a human
  worker, and the rule is non-gating until `mustRun` flips (D-028). Amends 08 A.8, B.24,
  Part D and 07 §6's "no first-entry fallback" for the sensor only. Chosen: (b).
- **Test module that fails to import (#8).** 08 B.11 makes it `FAIL` for `unit`; 08 C.5 maps
  "module import failure" to `setup-failed` for every Vitest node. Options: (a) `FAIL`, a defect in
  the change; (b) `UNKNOWN: setup-failed`, nothing was observed. Recommended: (a) for `unit` and
  `integration`, keeping B.21's `UNKNOWN: setup-failed` for `spec-tests`, where expected-red claims
  need collection to succeed first (corrections section). Missing tooling is already `UNKNOWN`
  from preflight (D-029), so an import failure that reaches the runner is in the candidate. C.5
  reports the import failure as its own event and each node maps it. Amends 08 C.5. Chosen: (a).
- **Exit code of `output-exists` and `spec-mismatch` (#9).** The `ReasonCode` enum lists both as
  command-level "could not run", which `report.json` ties to exit 2; 08 A.2 gives them exit 1.
  Options: (a) keep exit 1 and limit the exit-2 rule to commands that write `report.json`;
  (b) exit 2. Recommended: (b). Both are refusals to run, not demonstrated violations (08 Part A:
  `1` a demonstrated violation, `2` could not run), and `devai init`'s `dir-not-empty`, the same
  refusal, is already exit 2. Agents read exit 1 as "fix the change" (10 §4). Amends 08 A.2 and
  09 §2. Chosen: (b).
- **Template `.gitignore` lost on publish (#10).** [fact] `npm pack` (npm 12.2.0) and `pnpm pack`
  (pnpm 9.15.0, the version `ci.yml` publishes with) both omit `template/.gitignore` from
  `@devai-nyx/cli`, so `devai init` would scaffold without one; every other template file is
  packed. Options: (a) store it as `template/gitignore` and have `init` write it as `.gitignore`;
  (b) have `init` generate it from 09 §1.1's value; (c) leave it and rely on the adopter.
  Recommended: (a), with a build test that packs the CLI and asserts the file is in the tarball.
  The template stays the single source of the bytes; (b) moves them into code. Before R6.
  Amends 09 §1.1 (stored name); the template file is renamed now and the tarball test lands with
  `init` at R6 (the CLI has no test script yet); 12 is not edited (D-066). Chosen: (a).
- **Upgrade procedure (#11).** The law has the checks (`generator-version-mismatch`,
  `--regenerate`) but no procedure: no packet kind may touch the root `package.json`, the seed
  `api/package.json` pins `@devai-nyx/decorators` at `generatorVersion` and `--regenerate` never
  writes seeds, nothing moves a product to a later STYNX `<v>`, and only 08 A.2 and 09 §2 imply that
  a same-id `--regenerate` rewrites the manifest's `generatorVersion`. A bump makes every module's
  `generated` `UNKNOWN` until it is regenerated, so the bump and the regeneration must land in one
  packet. Options: (a) an upgrade is a `standards` packet: its default globs add `package.json`,
  `pnpm-lock.yaml`, `apps/*/package.json`, `domain/*/api/package.json` and, for a generator bump,
  `domain/**` generated files and manifests (the one exception to "manifest writable only by
  `generate` packets", limited to a same-id `--regenerate`); its required set adds `generated`,
  `unit`, `db-apply` and `integration` by population; (b) a seventh kind `upgrade` with that glob
  set and required set; (c) no rule: each upgrade amends `paths.allowed` by hand. Recommended: (a),
  plus: same-id `--regenerate` rewrites `generatorVersion` to the installed version; the agent
  edits the decorators pin by hand and `generated` FAILs when a module's pin ≠ its manifest
  `generatorVersion`; a STYNX `<v>` move is the same packet shape. (b) adds a kind, which D-055's
  brake resists; (c) cannot work, since only `generate` packets may write manifests. Amends 05 §3,
  08 A.2, A.4, B.16, 09 §2, PL-07 and 02 §7. Chosen: (a).
- **Who writes `fixed` (#12).** 05 §2 gives dispositions to the pilot and `not-a-defect` to the
  agent; 10 §2.4 offers the agent only `not-a-defect`; nobody is named for `fixed`. PL-10 holds a
  `fixed` line only when the finding is absent from the current review, which the next `--full`
  shows anyway, and the earlier `review.json` stays in git history. Options: (a) `fixed` is the
  pilot's; (b) drop `fixed`; (c) the agent may write it too. Recommended: (b). It adds no
  information PL-10 does not already re-derive, (a) spends the pilot's attention on a diff-level
  fact (D-003), and (c) keeps a word with no use. Amends D-035's vocabulary (superseding its
  `fixed`), 02 §9, 05 §2 and PL-10. Chosen: (b).
- **Migration manifest outside the `code` globs (#13).** 09 §3 appends a new module migration to
  `database/seed/modules.txt`; the `code`/`fix` default globs (08 A.4) cover `domain/<slug>/db/**`
  but not that file, so a default `code` packet adding a migration fails `packet-scope`. Options:
  (a) add `database/seed/modules.txt` (that file only) to the `code` and `fix` default globs;
  (b) keep it out; each such packet widens `paths.allowed` (05 §2 allows it). Recommended: (a).
  05 §3 lists new migrations as a `code` deliverable, so the default should admit them; the file's
  applied lines stay guarded by its hash and LINT013 (09 §3, D-043). Amends 08 A.4. Chosen: (a).
Source: Owner, 2026-10-21 (all seven recommendations adopted).

## D-075 · 2026-10-24 · The DAG runner and the verdict cache are DEVAI's; Turborepo is not the scheduler (devai-v3#48)
Options: (a) DEVAI-owned runner and cache exactly as 08 Part C (Kahn order, class concurrency,
PASS-only reuse, the 02 §2 key); 07 records Turborepo as rejected; 02 §2 says why an adopter that
runs `turbo` keeps two caches; (b) nodes as Turborepo tasks in a template `turbo.json`, DEVAI owning
node adapters and `accept`, 08 Part C rewritten over the runner, Turborepo a runtime dependency of
every adopter; (c) the same with Nx. Recommended: (a). Six 08 contracts have no Turborepo
equivalent and would need DEVAI code under (b) anyway: the staged-snapshot hook run (A.7), the shared
scratch database keyed by `schemaDigest`, `dependencyResultDigests` (Turborepo hashes a dependency's
inputs, not its result), the `observed = 0 → UNKNOWN` rewrite, the candidate re-digest
(`candidate-changed`) and the model-node keys; what remained for Turborepo (topological order, a
glob hash, `.turbo/` storage) is the smaller part of C.1/C.4, so (b) adds a dependency under the
runner rather than removing it. (b) also ships a file, a dependency and a binary to adopters that do
not use Turborepo (09 §1.1 has no `turbo.json`; 07 §5 "another DAG runner"). Second-system brake:
02 §2 already fixed the key, v2's `cache.ts:111-177` did the scheme in under 200 lines, and R6's cost
is the 28 adapters, not the scheduler. The "two overlapping caches" of #48 exist only in STYNX,
where `turbo run test` and `devai check --only unit` would both run Vitest; that is an S10 adoption
item (STYNX's `test` script calls `devai check --only unit`, 02 §10), not a DEVAI design flaw.
Amends 02 §2 (two-caches paragraph) and 07 §5/§7 (Turborepo and Nx named as rejected). Chosen: (a).
Source: Owner (decision packet `devai3/agents/decisions-3/PACKET-2026-10-24.md` §1).

## D-076 · 2026-10-24 · Cache inputs are computable sets; model nodes use the general key; stray files are gitignored, not excluded (devai-v3#46)
Three items. **Inputs** of `unit`, `spec-tests`, `integration`: (i) the selected test files plus
their `tsc -b` project closure as `inventory` computes it (02 §2 (f)), plus `apps/*/src/**`,
`test/support/**`, `vitest.config.ts`, and `db-apply`'s `schemaDigest` for the two DB-backed
nodes; (ii) keep the prose and let R6 decide; (iii) hash the whole repository. **`review` key**:
(i) model nodes use the general C.4 key (which brings `toolchainDigest`, `configDigest` and every
prerequisite's `resultDigest`) plus their model components; (ii) add only `toolchainDigest` to
B.27's key. **Untracked files in the candidate digest**: (i) the template `.gitignore` gains
`.DS_Store` and `Thumbs.db`, C.6 unchanged, and the text report prints the first untracked path
when the working-tree digest differs from HEAD's tree; (ii) C.6 excludes the two names; (iii) both.
Recommended and chosen: **1(i), 2(i), 3(i)**. 1(i) is what 02 §2 promised and reuses the closure
`typecheck` already needs; the acceptance cases assert the rail envelope from `apps/api/src/**` and
`test/support/**`, none under `domain/<m>/`, so a module-only input set is unsound. 2(i) binds a
`review` PASS to the `report.json` it read: any deterministic node's result change invalidates it,
which is the intended semantics at the price of more cold reviews; it also covers the sensor's
`minConfidence` through `configDigest` with one rule instead of two special keys. 3(ii) would be a
second ignore mechanism diverging from `git ls-files --others --exclude-standard`; 3(i) keeps "the
digest is what git sees" and makes the common stray visible with a remedy. Amends 08 B.11, B.21,
B.22, B.24, B.27 (Inputs, key), C.3 (one diagnostic line), C.4 (Key row); 09 §1.1 `.gitignore` row,
§4 fixtures N14–N16; `packages/cli/template/gitignore`. Source: Owner (packet §2).

## D-077 · 2026-10-24 · The report schema enforces the candidate-independent acceptance invariants; `review` gating stays plan-aware (devai-v3#34)
`report.ts` (byte-identical to 08 C.2) accepted seven inconsistent reports the issue reproduces:
PASS with `expected 10, observed 1, evaluated 0`; `accepted: true` with `nodes: []`; `accepted: true`
beside a FAIL row; `accepted: true` with a gating UNKNOWN; exit 0 with an `accept` FAIL; `cached`
without `cacheKey`; `verdict: blockers` without a blocker finding. Options: (a) minimal refinement
set in the schema: `PASS ⇒ evaluated = observed = expected`; `cached ⇒ cacheKey`; `accepted ⇒`
nodes non-empty ∧ `accept` PASS ∧ every node other than `review` ∈ {PASS, SKIPPED} ∧ every id in
`accept.details.requiredSet` present and not SKIPPED (PL-15); `exitCode 0 ⇒` no FAIL and no UNKNOWN
other than `review`; `exitCode 1 ⇒` a FAIL other than `review`, or a `review` FAIL with `accepted`
false; `Review.verdict = blockers ⇔ ∃ severity: blocker`; `review` schema-exempt because its gating
is derived from `devai.json` and `protected-paths` (D-028, D-058), which the schema cannot read;
(b) plan-aware validation that parses `devai.json` and the packet alongside the report; (c) runner
only. Recommended: (a); each clause restates prose already in 08 §0, A.3, C.4, B.27 and 02 §8, and
D-056's projection is untouched because refinements do not project. (b) makes `Report.parse` depend
on files outside the report. Lands with R6's first test file: the seven reproductions as negative
cases, the 09 §6 fixture report as the positive case. 08 B.11/B.22 let skipped or pending Vitest
cases lower `evaluated` without a finding, which under (a) is no longer a `PASS`; ruled in D-081. Amends 08 C.2 and
`packages/cli/src/report.ts` together. Chosen: (a). Source: Owner (packet §3).

## D-078 · 2026-10-24 · `protected:unplanned` is computed against the packet's `protected` at its introducing commit (devai-v3#42)
By construction a worker touching an undeclared class and widening `protected` in the same branch
produced `declared: true`, no label, `review` tallied, exit 0, `accepted: true`: the shadow period's
only gate was worker-controlled. Options: (a) `declared` is evaluated against the packet's
`protected` list at its introducing commit (the blob B.26 already reads for PL-13), so an in-branch
widening leaves the class undeclared for this PR → `protected:unplanned` → `review` gates; nothing
is refused (D-019); the pilot pre-declares on `main` or in a successor packet; (b) add `protected`
to PL-13's frozen set, making a widening a `packet-scope` FAIL; (c) record in D-028 that the gate
protects against accidental touches only. Recommended: (a). It costs the pilot nothing when
`protected` was written correctly up front (05 §2: the pilot writes it) and otherwise costs one
mandatory review, which is what the label is for; (b) turns a notice into a refusal against D-019;
(c) leaves the gate off on exactly the PRs (CI, hooks, `devai.json`) where it matters. A packet
introduced and amended in one PR uses its first version. Amends 02 §5, 05 §2, §4, PL-08, 08 B.25;
adds fixture N13 (09 §4). Chosen: (a). Source: Owner (packet §4).

## D-079 · 2026-10-24 · Mixed worker family is `UNKNOWN (family)`; D-037 reworded; the evidence files carry no label (devai-v3#43)
Four items. 1. A commit range whose `Co-Authored-By` trailers resolve to more than one family is
`UNKNOWN (family)`, like equal or unknown: adopt / reject. 2. A protected label on
`.devai/review/**`: adopt / reject. 3. D-037's weakness reworded to what CI actually verifies:
adopt / reject. 4. `review.json` records `workerFamily` and the trailer lines it was derived from:
adopt / reject. Recommended and chosen: **adopt 1, 3, 4; reject 2**. 1 closes the one case the
regexes decided by implementation order; its cost, a human fix-up commit with its own trailer making
the range mixed, is remedied by squashing or carrying the agent's trailer, already campaign practice
(02 §8). 2 adds no information: both files appear in every accepted PR, so the label would be on
every PR and distinguish nothing; the fabrication risk is D-037's weakness and the honest fix is 3.
4 makes the declaration auditable after the fact (`git log` trailers against `review.json`) and
gives #36's calibration a record of who reviewed whom; two additive fields on an evidence file 02 §11
already lists (D-055 respected). Provenance beyond the digest check would be attestation, which
D-002 and 07 §7 exclude. Amends 02 §9, 08 B.27 (Inputs, Status, Findings), C.2 `Review`,
`report.ts`, 10 §2.4 (`devai-review`), 01 (cross-reference), D-037 text; adds fixture N17.
Source: Owner (packet §5).

## D-080 · 2026-10-24 · The required check runs from `main` through a ruleset; CODEOWNERS deferred until agent PRs have their own GitHub identity (devai-v3#44)
For `pull_request` events GitHub runs the workflow from the PR's merge ref, so the required `devai`
context on an agent PR was computed by the PR's own copy of `.github/workflows/devai.yml`. All nine
devai-v3 PRs to date were opened by the Owner's account (`aarusso-nyx`) while the commits carry the
agent identity, and a PR author cannot approve their own PR. Options: (a) CODEOWNERS for
`.github/**`, `scripts/hooks/**`, `devai.json` with "require review from code owners" — today it
would block every agent PR touching those paths; (b) keep the policy and record the residual risk;
(c) a repository ruleset **requiring the workflow from `main`** (`devai` for adopters; `build`, then
`matrix`, for devai-v3), so the check a PR must pass cannot be rewritten by that PR; no human step;
label-only locally (D-019); CODEOWNERS left as a later option once agent PRs are opened by a machine
user or GitHub App (a new 12 §5 host step, not an R6 item); (d) (a) + (c). Recommended: (c). It
removes the mechanism #44 names without a human gate and leaves hook and `devai.json` changes to
`protected:ci`/`protected:standards` plus, with D-078, a gating `review` whenever the packet did not
pre-declare the class. Rulesets with required workflows are available on public repositories and
paid plans; devai-v3 and the adopters named in 12 §1 are public; a private free-plan adopter falls
back to (b)'s statement, which docs/adopters/ci.md says. The template ships no CODEOWNERS. Amends
D-003, 08 A.1 (Output), 09 §1.1 (`devai.yml` row), 12 §5 H3/H5 (in `devai3/foundation/12-succession.md`
until #45 lands 11 and 12 in this repository), docs/adopters/ci.md, docs/dev/contributing.md.
Host act (Owner): the ruleset on devai-v3 before H5 makes `matrix` required. Chosen: (c).
Source: Owner (packet §6). Option (c) superseded by D-091; the CODEOWNERS deferral stands.

## D-081 · 2026-10-24 · A skipped or pending test case is collected but not observed: `unit` and `integration` report a shortfall `FAIL` (closes the D-077 open item)
08 B.11 counted `skipped` and `pending` cases as observed but not evaluated and said they are "not a
`unit` finding (S-64 is `test-integrity`'s)", so a run with one skipped case was neither `PASS`
(D-077: `evaluated = observed = expected`), nor `FAIL` (no finding), nor `UNKNOWN` (no reason).
Options: (a) redefine `observed` as cases that ran to `passed` or `failed`, so `observed = evaluated`
always; a skipped or pending case is in `expected` (collected) and not in `observed`, and 02 §2 rule
(b) already makes `observed < expected` a shortfall `FAIL` naming the missing units; (b) keep the
counts and add a `unit` finding per skipped case; (c) a new reason code `cases-skipped` → `UNKNOWN`;
(d) relax D-077's refinement for `unit`/`integration` when the gap is skipped cases, relying on
`test-integrity`. Recommended: (a). It uses a rule the law already has and adds no code, no finding
class and no schema exception; (b) reaches the same verdict with two count definitions that differ
for no reader; (c) adds a code and reports a standards violation as a tooling condition; (d) keeps
the half-state and lets `devai check --only unit` print `PASS` on a run that skipped tests. The
static check stays `test-integrity`'s; `unit` catches runtime skips (`skipIf`, `pending`) the parser
cannot. Consequence, stated so it is not discovered later: S-64's issue reference satisfies
`test-integrity`, not `unit`; a referenced `.skip` still fails `unit` with `skipped [S-64] make it
run or delete the case`, so a deferred case lives in an issue, not in a skipped test. Amends 08 B.11
(Observation, Status, Findings), B.22 (Observation), C.5 (adapter note); docs/reference/nodes.md;
adds fixture N18 (09 §4). Chosen: (a). Source: Owner (ROADMAP G1 panel, 2026-10-24).

## D-082 · 2026-10-24 · Reviewer and sensor isolation is enforced by the host CLI and then checked in its stream (devai-v3#47)
08 B.24/B.27 and C.4 made isolation a property the runner *observes* in the CLI event stream: zero
tool items in phase 1 and the sensor; no write outside the scratch copy and no network item other
than the model API in phase 2. Both host CLIs document *enforcement* the law did not use, and a
stream cannot show what a `node` or `psql` child process does with sockets or files. Options: (a)
enforce on both CLIs and keep the stream as a second signal: Claude phase 2 runs with the sandbox
enabled (`allowUnsandboxedCommands: false`, `network.allowedDomains: []`, `strictAllowlist: true`;
Claude Code ≥ 2.1.219) and `--disallowedTools Edit,Write,NotebookEdit,WebFetch,WebSearch`; Codex
runs under its sandbox (`workspace-write` confined to the scratch `--cd`, network denied), and 07 §6
records that network isolation there is the sandbox's, not DEVAI's; the sensor keeps `--tools ""` /
`--sandbox read-only`; `capability-missing` means "the CLI cannot enforce" (flag rejected, sandbox
unavailable) and no longer "the stream cannot show"; the stream still counts the tool-call budget
and must show no write or network item; (b) enforce on Claude only; (c) keep stream-observed and
say so in D-058. Recommended: (a); the enforcement is free in both CLIs, (b) leaves the gap open
for every `gpt`-reviewed packet, and (c) makes 08's claim mean less than it says. No node, command,
state or field is added; the change is flags and one fixture (N19). Amends 07 §6, 08 B.24 (Invokes),
B.27 (Invokes), C.4 prose, 02 §9 (Access), 10 §4 and docs hints for `capability-missing`, D-058 note.
Chosen: (a). Source: Owner (ROADMAP G2 panel, 2026-10-24).

## D-083 · 2026-10-24 · The sensor evidence records the threshold it was judged by, and CI re-applies the PR head's (devai-v3#36)
`SensorEvidence` carried `output.confidence` but not `minConfidence`; CI compared the slice digest
only, so a committed `.permissions.json` with `verdict: compliant, confidence: 0` validated and was
reported `cached: true`, and raising the threshold after calibration changed nothing for evidence
already committed (D-076 covers only the local verdict cache). Options: (a) `SensorEvidence` gains
`minConfidence`, the value in force when the sensor ran; CI requires, besides the digest match, that
it equal the PR head's `devai.json` value and that `output.confidence ≥` it, else
`permissions-pattern: UNKNOWN (stale)`, reusing the code; (b) a `configDigest` of the
`agentic.permissionsPattern` object instead, plus the same confidence check; (c) defer to the
pilot. Recommended: (a): one field, one rule, readable in the file; (b) is more general and opaque,
and any sensor setting change forces a local re-run; (c) leaves fabricated evidence invisible to
CI, which is the issue's point. Amends 08 B.24 (Status), C.2 `SensorEvidence`, `report.ts`, C.4
`.devai/review/` row, 02 §4; adds fixture N20; docs. #36's calibration corpus and the "0.7 is
provisional" wording stay open for the pilot. Chosen: (a). Source: Owner (ROADMAP G3 panel,
2026-10-24).

## D-084 · 2026-10-24 · R6 W1 readings: fifteen adopted as 08 clarifications, three revised, populations and `nodeVersion` ruled (devai-v3#55)
W1 (#55) implemented the smaller reading wherever 08 was silent and listed 19 of them under "Open". Each
gets a verdict: **adopt** (one 08 sentence, no code change), **revise** (W2 or an earlier follow-up PR
changes the code), or **rule** (an option set). Two items needed a choice. **Item 1, populations**:
(a) W1's path-based counts become 08 B.1's population table, and a node's wave may *tighten* its
predicate only by a stale-text PR citing the row; (b) each wave changes counts freely; (c) freeze W1's
counts. (a) names the owner (02 §2 (f): populations come from `inventory`) and keeps the brake, since
a count change is a visible law edit; (b) lets counts drift per node unreviewed; (c) freezes
approximations (declared, not mounted, controllers) that later waves must replace. **Item 2,
`nodeVersion`**: (a) `<cliVersion>+<n>`, `n` kept in each node file, bumped by the PR that changes the
contract and listed in a C.4 table; (b) `n` = the D-nnn of the last contract change; (c) a hash of the
node's source file. (a) is readable and passes through review; (b) couples cache keys to the decision
log; (c) invalidates caches on every refactor.

| # | Item | Verdict | Rule |
|---|---|---|---|
| 1 | Population counts per node | rule: **(a)** | 08 B.1 population table, W1's predicates; the root manifest is excluded (item 7); "changed" without a packet = working tree vs `HEAD` + untracked, the A.3 edit-loop base |
| 2 | `nodeVersion` encoding | rule: **(a)** | `<cliVersion>+<n>`, `n = 1` for every node today; C.4 table |
| 3 | `accept` findings and UNKNOWN reason | revise | finding form adopted (one per gating FAIL, `locator = <node id>`, `[S-65]`); on a gating UNKNOWN `accept` carries the first gating UNKNOWN node's `reason` verbatim, not `prerequisite-failed` (B.28) |
| 4 | PL-15 hint | adopt | `deliver what the kind requires (05 §3); an empty population means the deliverable is missing` (05 §5, 10 §4) |
| 5 | Key list framing, plan order, content sha256 | adopt | C.4 Key row |
| 6 | `toolchainDigest` framing; missing lock frames empty | adopt | B.1 Observation |
| 7 | Root manifest as an observation | revise | `expected` = workspace packages the globs match; a workspace whose globs match no package is `FAIL` (`glob <g> matches no package`), never `observed 0` (B.1) |
| 8 | FAIL + UNKNOWN inside `inventory`; engines; Angular profile; `tsc` path | adopt | B.1 Status |
| 9 | Mount census stub | revise in W2 | W2's `route-contract` PR removes the stub and lands the static walk 08 already describes; a W2 obligation, not law |
| 10 | Message texts the law does not give | adopt | B.1 Findings, C.1 step 8, B.28 Findings |
| 11 | C.6 edges (escaping symlink working-tree only; untracked nested repo; unmerged index entry) | adopt | C.6, three clauses |
| 12 | `candidate-changed` report printed, not written | adopt | C.1 step 10 |
| 13 | `devai check` at the repository root only | adopt | A.0 |
| 14 | JSON refusals use the W0 envelope | adopt | A.0: a `Report` exists only once `inventory` ran |
| 15 | `--prune` output and scope | adopt | A.3 `--prune` row |
| 16 | Text report details | adopt | C.3, seven readings |
| 17 | B–C nodes in the class-C lane; `editLoopMs` | adopt | C.1 step 6, B.28 Observation |
| 18 | Precedence of `inventory` failure and SKIPPED | adopt | C.1 step 5 |
| 19 | `--only review` | revise | `--only` naming `review`, `permissions-pattern`, `packet-scope` or `spec-tests` without `--packet` is exit 2 `usage`: `<node> needs --packet` (A.3) |

Code follow-ups (not in this entry's PR): `accept.ts` (3), `inventory.ts` (7; 9 in W2), `commands/check.ts`
(19). No node, command, state, field or reason code is added (D-055). Amends 08 A.0, A.3, B.1, B.28,
C.1, C.3, C.4, C.6; 05 §5 PL-15; 10 §4. Chosen: 1 (a), 2 (a), the fifteen adoptions, revisions 3, 7,
19, and 9 as W2's obligation. Source: Owner (R6 packet, 2026-10-24).

## D-085 · 2026-10-24 · `sql-lint` runs one invocation over every root; LINT010's day prefix is a STYNX defect; DEVAI re-roots locators (R6 W2 fact sheet b1–b3)
Published `stynx-migration-lint` 3.0.0 lints several targets as one population, reads the LINT010
prefix as `^(\d+)_` (so `YYYYMMDD_01_…` and `YYYYMMDD_02_…` collide), reports `issues[].file` relative
to the target root, and exits 2 with no stdout on usage and input errors, the code `parserIssues` also
uses. **b1**: (a) one invocation over every root, one observation per SQL file across roots; (b) per-root
calls with DEVAI computing LINT010 across roots itself. (a) is what the tool already does; (b) is a
second implementation of a STYNX rule, which D-029 forbids. **b2**: (a) a STYNX defect: S10 gains
"LINT010 reads two prefix groups", and `sql-lint` reports what the tool says meanwhile; (b) DEVAI
changes 04 §1's name form to one serial prefix; (c) DEVAI filters LINT010 findings whose files share only
the day. (a) keeps 04 §1 (`YYYYMMDD_NN_snake_case.sql`) and the rule in STYNX; (b) moves the law to fit
a defect; (c) puts STYNX semantics in DEVAI (D-029). **b3**: (a) DEVAI re-roots each issue by the target
root it passed (disambiguated by `files[]`); exit 2 with empty stdout is `UNKNOWN`, reason by stderr
(`does not exist` / `not a directory` → `lint-config-failed`, otherwise `io`); exit 2 with JSON keeps
B.7's `parserIssues` mapping; (b) ask STYNX for cwd-relative paths and a distinct usage exit code and
block `sql-lint` until then. (a) unblocks W2 and is temporary where it compensates for a tool defect;
(b) waits on S10. S10 items filed: LINT010 prefix groups; cwd-relative issue paths and a usage exit
code. No 04 change; `layout`'s name-form predicate is unchanged. Amends 08 B.7 (Invokes, Observation,
Status, Findings) and the Part B preamble sentence on LINT010 (08 `:174` at `499b84c7`). Chosen: b1 (a),
b2 (a), b3 (a). Source: Owner (R6 packet, 2026-10-24).

## D-086 · 2026-10-24 · Exit codes are never trusted alone: pre-flight what DEVAI controls, read verdicts from parsed output (R6 W2 fact sheet b5, b6, b9)
`@commitlint/cli` 21.2.2 exits 1 for a rule violation and also for a missing config, a missing
message file and a `cwd` outside git; the `stynx` binaries exit 1 with no stdout on a usage error, the
`FAIL` code of D-071's contract; the published `./test` ESLint profile emits `no-restricted-syntax`
with `WAVE-05A/CW-1:` messages and `no-restricted-imports` with `R19-W06:` messages, while 08 B.4
printed `CW-1` as a rule id. Options: (a) a pre-flight and output-shape rule stated once as 08 §0's
fifth convention and applied in each adapter: inputs DEVAI controls (config file, message file, git
root) are checked before invoking and reported with the 08 reason; a non-zero exit without the
expected machine-readable stdout is `UNKNOWN: runner-crashed` with stderr's first line as the finding
message; findings come from parsed stdout only; ESLint findings map by `ruleId` and, for
`no-restricted-*`, by message prefix, printed `<path>:<line>:<col> <prefix>: <message> [S-60]`;
(b) ask STYNX and commitlint upstream for distinct exit codes and block the three adapters; (c)
per-tool special cases in each B row only. (a) decides now what DEVAI can decide; (b) waits on others;
(c) repeats one rule five times. No reason code is added (`runner-crashed`, `lint-config-failed`,
`io` are reused). Amends 08 §0 and one sentence each in B.4, B.9, B.15, B.17, B.19. Chosen: (a).
Source: Owner (R6 packet, 2026-10-24).

## D-087 · 2026-10-24 · Config contracts: template `.stynxrc.json` names the 04 roots and is validated by DEVAI; generated routes keep `@RequireRoles` from `@stynx-nyx/backend` (R6 W2 fact sheet b7, b8, b10)
Three items. **b7**: `verify-api-coverage` scans `apiCoverage.sourceRoots` (literal paths, default
STYNX's layout) and `verify-public-api-baselines` scans `publicApi.packageRoots` (one level deep,
skipping folders without a manifest); 09 §1.1's `.stynxrc.json` carried `boundary` only, so both saw 0
and passed with `observed 0`. Options: (a) the template `.stynxrc.json` gains `"apiCoverage":
{ "sourceRoots": ["apps/api/src"] }` and `"publicApi": { "packageRoots": [] }`, and, because the roots
are literal and one level deep, the generator prints one entry per module for each as mount lines
(`domain/<slug>/api/src`, `domain/<slug>`; 09 §2: mounting is the `generate` packet's job); (b) ask
STYNX for globs (S10) and block `openapi`; (c) pass roots on argv (3.0.0 has no such option). (a)
works with 3.0.0 as published; `["domain"]` would scan `domain/<m>` folders, which have no
`package.json`. **b8**: `verify-stynx-boundary` reads `.boundary ?? {}` unchecked, so `[1]` passes with
default roots. Options: (a) DEVAI validates `.stynxrc.json` with a zod definition of `boundary`,
`apiCoverage`, `publicApi` before any `stynx` call: malformed → `UNKNOWN: config-invalid` for every node
that reads it, absent → `boundary` `FAIL` (08 B.17); (b) rely on each command's own handling. (a)
closes the one path where a malformed config yields `PASS`. **b10**: `list-routes` accepts `Public`,
`Permission` and the other auth markers only from `@stynx-nyx/auth`, `@stynx-nyx/backend` or STYNX's
decorators path, and `RequireRoles` is not an auth marker, so 09 §6's controller fails `route-contract`
on the template's own fixture. STYNX's `@Permission(key)` takes one permission key
(`stynx:packages/auth/src/decorators.ts:25`), while 06 §2 `roles: Slug[]` means "all of these roles"
and maps to `@RequireRoles(roles, 'all')`, exported by `@stynx-nyx/backend`
(`stynx:packages/backend/src/authorization/decorators.ts:10`). Options: (a) the generator emits
`@Permission(…)` / `@Public()` from `@stynx-nyx/auth`; (b) the generator keeps `@RequireRoles(roles,
'all')` imported from `@stynx-nyx/backend`; S10 gains an item for `list-routes` to accept `RequireRoles`
as a role-binding marker and report it in `permissions`; until STYNX ships it, `route-contract` reports
a generated route `UNKNOWN: tooling-missing — route-contract: install @stynx-nyx/cli ≥ <v> whose
list-routes reads RequireRoles` (D-029, the D-088 pattern); (c) `route-contract` reads `RequireRoles`
itself beside `list-routes` (a second census, D-029). (a) cannot express 06 §2's role set in one
permission key without a new spec key; (b) keeps 06 §2, 08 B.9's `roles ↔ @RequireRoles([...], 'all')`
comparison and S-28 unchanged and puts the gap in STYNX, where the census lives; (c) duplicates a
STYNX rule. The first panel chose (a); the Owner revisited it in a second panel the same day after the
`@Permission(key)` fact and chose (b). Amends 09 §1.1 (`.stynxrc.json` row), 09 §2 (lowering, mount
lines), §2.1 (`routes[]` row), §6 (import line), 02 §2 (generator outputs: import origin), 08 B.9
(Status, `tooling-missing`), B.17 (validation), B.19 (roots). Chosen: b7 (a), b8 (a), b10 (b).
Source: Owner (R6 packet, 2026-10-24; b10 second panel, 2026-10-24).

## D-088 · 2026-10-24 · STYNX publishes the write pair; until then `openapi` and the STYNX `generated` pairs are `tooling-missing` and the contract files are seed (R6 W2 fact sheet c1)
`@stynx-nyx/cli` 3.0.0 ships the check forms only (`verify-api-coverage --json --strict`,
`verify-public-api-baselines --json`); the writer exists in the unexported engine and STYNX keeps the
write side as repository scripts, so a product has no published way to produce or refresh
`openapi.json` or `public-api-baselines.json`. Options: (a) STYNX publishes the write pair as an S10
item; meanwhile `openapi` and the two `generated` pairs report `UNKNOWN: tooling-missing` with an
install hint under D-029, and the template ships the two contract files as seed (hand-refreshed);
(b) DEVAI drops the write pairs: `openapi` checks against a hand-maintained document and B.16's STYNX
pairs are struck; (c) DEVAI reimplements the writer from the engine source. (a) keeps the drift check
the pair exists for and needs no law change beyond a Mode cell and hint text; (b) brings that drift
back; (c) is forbidden by D-029. S10 items filed for STYNX, by name: **`stynx api-docs write`** and
**`stynx public-api-baselines write`**. Amends 08 B.16 and B.19 (Status, hint text), 09 §1.1
(contracts row Mode: seed until the pair exists). Chosen: (a). Source: Owner (R6 packet, 2026-10-24).

## D-089 · 2026-10-24 · Stale citations after STYNX 3.0.0 (R6 W2 fact sheet a1–a9; a10 added in review)
STYNX 3.0.0 was published on 2026-10-23 from `10514fea`, renaming `tools/*` to `@stynx-nyx/*`. Ten
places in 08 and 07 cited a `stynx:` path at `63e5f788` or a "today" clause that moved; behaviour is
unchanged in each. No option set; the Owner ratifies the list. Citations now name the published
package path `P:<pkg>@3.0.0/<path>` (D-073 pattern):
- **a1 · 08 B.3 `lint`.** Profiles `P:@stynx-nyx/eslint-config@3.0.0/index.mjs:316-321`; default `strict: true` already sets `no-explicit-any`/`no-unsafe-*`, `require-idempotent-route-decorator` and `boundaries/dependencies` `'disallow'`; `stynx/no-authored-cjs` ships.
- **a2 · 08 B.4 `lint-tests`.** `./test` is exported (`package.json:9`); the `tooling-missing` status and the `./lib`/`./nest`/`./angular` fact are struck; CW-1 rules at `index.mjs:423-439`.
- **a3 · 08 B.7 `sql-lint`.** Context flags, LINT010–013 and `parserIssues` exist (`dist/src/cli.js`, `types.d.ts:1`, `parser.js:27-30`); "no binding", "publication requirement", "swallowed" and `tooling-missing: LINT010–013 context` are struck.
- **a4 · 08 B.9 `route-contract`.** `stynx list-routes --json --roots` is published (default = 08's roots); parser `engines/nest-route-declarations.mjs:29`.
- **a5 · 08 B.17 `boundary`.** The published command reads `.stynxrc.json` only, prints a `scanned` census and reports a missing file as `FAIL` (`checks.js:96-106`, `stynx-boundary.mjs:9-19`).
- **a6 · 08 B.19 `openapi`.** Paths are `.stynxrc.json` keys with STYNX-layout defaults (`api-coverage.mjs:22,24`, `checks.js:15-16,201-205`).
- **a7 · 08 B.14 `actionlint`.** The JSON-output `[inference]` is now `[fact]`: 1.7.12 downloads the binary at install and `-format '{{json .}}'` prints a JSON array.
- **a8 · 08 B.20 `db-apply`.** `stynx verify-rls-negative --json --ddl <roots>` is published (default `database/ddl`, `*` per segment).
- **a9 · 07 §2.** The four "pending publication" rows (`tsconfig`, `migration-linter`, `eslint-config`, `cli`) read "published 3.0.0".
- **a10 · 08 Part B preamble.** Every STYNX entry point the blocks invoke exists at 3.0.0; "`UNKNOWN: tooling-missing` until it exists" now applies only to D-088's write pair and to `list-routes` reading `RequireRoles` (D-087).
Amends 08 Part B preamble, B.3, B.4, B.7, B.9, B.14, B.17, B.19, B.20 and the 08 provenance header; 07 §2 and its
citation key. Source: Owner (R6 packet, 2026-10-24).

## D-090 · 2026-10-24 · v2 keeps a bounded stabilization window until the first adopter module is green on v3; H7 moves after it (devai-v3#39; amends D-065 items 13 and 16)
D-065 archived `aarusso-nyx/devai` on 3.0.0's publish day with no further 2.x release (item 13,
12 §6) and held adopters on an exact 2.6.2 pin (item 16). Both premises moved: 2.x development
continued after the ruling (GitHub Packages `@aarusso-nyx/devai` 2.6.2 2026-10-14, 2.6.3
2026-10-19, 2.7.0 2026-10-23, 2.7.1 2026-10-24T07:48Z; the repository is not archived, `main` at
`2df84159` pushed 2026-10-24T07:46Z, tags up to v2.7.1), and both adopters (STYNX, DETRAN) run v2
in production with no v3 module yet. Options: (a) a bounded window: `aarusso-nyx/devai` stays
unarchived and may receive defect fixes only (no features, no new law) until the first adopter
(STYNX through its S10 adoption, or DETRAN's first module per 12 §6) has one v3 module green in its
CI with its applied SQL history kept and a recovery path shown; then H7 archives it; adopter pins
float within `2.x` (`^2.6.2` or the adopter's own exact pin, their choice) until they move; (b) keep
D-065's publish-day cutoff and only fix the stale text: the final 2.x is whatever is latest on
publish day and the guide tells adopters to pin that exact version; (c) name 2.7.1 the final 2.x
now, stop publishing 2.x, archive on publish day. Recommended: (a). Publication and adoption are
different milestones: a publish-day archive would close the maintenance channel of two production
systems before either has a v3 module; the window ends on an observable event, not a date; and
fixes are defects only, which keeps D-065's "no dual development" in substance. (b) leaves
production adopters on a frozen release with no defect channel; (c) does the same and freezes it
today. Closure criteria, all observed, in order:
- [ ] one v3 module of the first adopter is green in that adopter's CI (`devai.yml` `matrix`, or
  `devai check --full` exit 0);
- [ ] that adopter's applied SQL history is preserved (D-033);
- [ ] a recovery path is demonstrated: a `devai check` after a deliberate break returns to green;
- [ ] the Owner runs H7 and the agent reads back `gh api repos/aarusso-nyx/devai --jq .archived` →
  `true`.
Supersedes in D-065: item 13's timing (only `aarusso-nyx/devai` is archived still holds; H7 runs
after the criteria above, not on publish day, and "no further 2.x" becomes "defect fixes only
during the window"); item 16 entirely (the exact 2.6.2 pin is replaced by a pin floating within
`2.x`). D-065's text is not edited. Amends 12 §5 (H7 row), §6 and §8; docs/adopters/moving-from-v2.md,
docs/adopters/index.md, docs/dev/release.md, docs/theory/stynx.md. Host act (Owner): H7, after the
criteria. Chosen: (a). Source: Owner (panel 2026-10-24, "Bounded window").

## D-091 · 2026-10-24 · DEVAI requires nothing beyond GitHub Free; D-080's ruleset is retired
On 2026-10-24 the Owner ran the H3 ruleset command from 12 §5 against devai-nyx/devai-v3 (public,
organization on the free plan, id 1425059721). GitHub answered `422 Validation Failed`, "Invalid rule
'workflows': Invalid parameter workflows: Workflow error at index 0", and created nothing
(`gh api repos/devai-nyx/devai-v3/rulesets` → `[]`). [fact] GitHub's rulesets documentation offers
"Require workflows to pass before merging" only in organization or enterprise rulesets, and
organization rulesets need GitHub Team or Enterprise; repository rulesets cannot carry the rule, by
API or web UI. D-080's premise ("available on public repositories and paid plans") was wrong.
Options: (a) buy GitHub Team for devai-nyx and move the rule into an organization ruleset (not
known to suffice: GitHub's 2023 changelog limited required workflows to Enterprise); (b) a
free-plan substitute: a `pull_request_target` guard job that fails when a PR touches
`.github/workflows/**`, or CODEOWNERS review on those paths; (c) retire the ruleset and adopt a
standing rule that no DEVAI step, host act, template file or adopter instruction needs more than
GitHub Free. Chosen: (c). Owner's words: "Retire completely such feature, since it could not be
fulfilled with available tools", and "no feature demand more than basic free github plan".
Rule. DEVAI's law, CLI output, template and docs use only what GitHub Free provides to a public
repository: Actions on standard runners, GitHub Packages, repository secrets, labels, scheduled
workflows, auto-merge, and classic branch protection with required status checks. Classic branch
protection is free only on public repositories; on a private free-plan repository nothing is
enforced and the `devai` check is what the pilot reads before merging (02 §9 already makes merging
the pilot's act or protection's). A later proposal that needs a paid feature is out of scope unless
a decision lifts this rule. [fact] Audit on 2026-10-24 of decisions.md, docs/framework, docs/history,
docs/adopters, docs/dev, `ci.yml` and the template: the ruleset was the only paid dependency;
devai-nyx and stynx-nyx are on the free plan; devai-v3, stynx-nyx/stynx and aarusso-nyx/detran are
public.
Residual risk (D-080 option (b), now stated). For `pull_request` events GitHub computes the
required check from the PR's own copy of the workflow, so a PR that edits `ci.yml` (devai-v3) or
`devai.yml` (adopters) can weaken the check it must pass. What remains: the `protected:ci` label
(D-019), `review` gating when the packet did not pre-declare the class (D-078, `protected:unplanned`),
protection's `enforce_admins` and `strict`, and the pilot's reading of control-defining changes for
intent (D-003). No human review gate is added; CODEOWNERS stays deferred as in D-080.
Supersedes D-080 option (c) and its host act; D-080's text is not edited beyond its marker. Amends
D-003's amendment line, 08 A.1 (Output: one host line), 09 §1.1 (`devai.yml` row), 12 §5 H3 and H5
(ruleset struck), docs/adopters/ci.md, docs/dev/contributing.md, docs/history/index.md. Host act:
none; H3 is complete with the protection read-back `[["build"],true]`.
Source: Owner (H3 session, 2026-10-24).

## D-092 · 2026-10-24 · The two `domain/*` workspace globs are seed globs and never raise the no-match finding (refines D-084 item 7)
[fact] 09 §1.1 fixes `pnpm-workspace.yaml` as `apps/*`, `domain/*/api`, `domain/*/web` (`09-rail.md:55`),
and D-084 item 7 makes a glob that matches no package a `FAIL` (`glob <g> matches no package`,
`decisions.md:1025`; `08-cli-and-nodes.md:185`). Before the first module both `domain/*` globs match
nothing, so on every fresh scaffold `inventory` FAILs, every other node is `prerequisite-failed`, the
pre-commit hook refuses the pilot's first commit, and campaign step 2 never reaches PL-15
(devai-v3#66 Open 1, devai-v3#59 Open 3, devai-v3#67 R8 seed: step 2 exit 1 in all eight cells).
Options: (a) refine D-084 item 7: the two 09 §1.1 `domain/*` globs are *seed globs*, and a seed glob
that matches no package is never a finding, whatever `database/seed/modules.txt` lists; any other
no-match glob stays `FAIL`; no template or generator change; (b) the template ships `apps/*` only and `devai new module` prints a mount line
adding `domain/*/api` (and `domain/*/web` with `--web`), with `pnpm-workspace.yaml` joining the
`generate` globs; (c) keep the rule and document that the first module must be generated before the
first commit. Recommended: (a). It changes one predicate and no bytes; (b) adds mount work and edits
09 §1.1, 09 §2 and 08 A.4; (c) blocks the pilot's `init` → commit → PR flow and 12 §4 R6's `init`
clause. The first panel's (a) kept the exemption only while `modules.txt` lists no module; the
recording PR (devai-v3#68) found that a module generated without `--web` then leaves `domain/*/web`
matching nothing, so `inventory` FAILs at campaign step 4 of every non-`--web` cell, the default cell
O2 included (devai-v3#67 R8 seed). A second panel the same day chose between (i) the seed globs never
raise the finding and (ii) the generator edits `pnpm-workspace.yaml`; Chosen: (i), the text of (a)
above; (ii) makes the generator edit a seed file it does not own (09 §2, D-033). D-084 is not edited;
this entry states what it refines: item 7's `FAIL` keeps every glob except the two seed globs. [inference] `layout`'s predicate "workspace globs name real
packages" (08 B.6) reads the same globs, so the same exemption applies there, or a fresh scaffold
fails `layout` instead. Amends 08 B.1 (Status, Observation), 08 B.6 (Observation). No template
doc states the rule (`docs/adopters/layout.md` ships in the template and names the globs only).
Chosen: (a), with the second panel's (i). Source: Owner (panels in the devai3 readiness session,
2026-10-24; exemption scope, second panel, 2026-10-24).

## D-093 · 2026-10-24 · Module tsconfigs carry `rootDir` and `composite`; the mount adds the module to the app's `references`
[fact] 09 §6 gives `domain/notes/api/tsconfig.json` whole, without `rootDir` or `composite`
(`09-rail.md:285-286`). Under TypeScript 6.0.3 with `@stynx-nyx/tsconfig/node24.json` 3.0.0,
`typecheck` FAILs `TS5011 'rootDir' must be explicitly set` and `project not built (no tsbuildinfo
after tsc -b)`, and `apps/api` then fails `TS2307 Cannot find module '@demo/notes-api'`, because no
09 §2 mount line adds a `references` entry (devai-v3#67 Open 1). With `--web`, `tsc -b` emits
`dist/src/index.js` while `exports` names `./dist/index.js`, so `ng serve` cannot resolve
`@demo/notes-web` and `e2e` waits out its 180 s timeout (devai-v3#67 Open 14). Observed fix:
`rootDir: "src"`, `composite: true` plus `references: [{ path: "../../domain/notes/api" }]` →
`typecheck` PASS (devai-v3#67 Open 1). Options: (a) 09 §6's module `api/tsconfig.json` (and the
`--web` `web/tsconfig.json`) carry `"rootDir": "src", "composite": true`; 09 §2 gains one mount line
per module, `{ "path": "../../domain/<slug>/api" }` added to `apps/api/tsconfig.json` `references` (the
web counterpart in `apps/web/tsconfig.json` with `--web`); 08 A.4's `generate` globs gain
`apps/api/tsconfig.json` and `apps/web/tsconfig.json`; (b) `typecheck` builds every module project
before the apps with no `references`; (c) the root `tsconfig.test.json` becomes the single `tsc -b`
entry and the generator adds modules there. Recommended: (a). It states the build dependency to
TypeScript where it exists; (b) hides it and runtime resolution still needs the module built; (c)
makes a test config the build graph. Amends 09 §2 (generated-file bytes, mount lines), 09 §6
(`api/tsconfig.json` row), 08 A.4 (`generate` globs; D-095 completes the list). 09 §2.1 names no
mount artefact and is unchanged by this entry. Chosen: (a). Source: Owner (panels in the devai3
readiness session, 2026-10-24).

## D-094 · 2026-10-24 · Each module package declares what its emitted code imports; the root carries tooling only
[fact] The generated module imports `@nestjs/common`, `@stynx-nyx/{flow,backend,data,idempotency}` and
`zod`, while its `api/package.json` lists only `@devai-nyx/decorators` (devai-v3#64 Open 14;
`packages/cli/src/generator/render.ts:487`). The template root carries `@nestjs/common` but none of the
four STYNX packages and no `zod`, although 09 §1.1's root row says "only the STYNX packages emitted
code imports" (`09-rail.md:54`). Observed: `lint` 138 × `@typescript-eslint/no-unsafe-*` and `unit`
`Cannot find package '@stynx-nyx/flow'`; adding the five to the root clears `lint`, but `deadcode`
(depcheck) then FAILs `domain/notes/api/package.json:1 missing dependency …` per package
(devai-v3#67 Open 2). Options: (a) per package: 09 §6's `api/package.json` (and `web/package.json`)
lists every package the emitted code imports, exact at the pins: `@nestjs/common` 11.2.3 (07 §2 Nest
row), `zod` 4.4.3 (07 §2 zod row), `@stynx-nyx/flow`, `@stynx-nyx/backend`, `@stynx-nyx/data`,
`@stynx-nyx/idempotency` at the one fixed-group version `<v>` that 12 §3 writes into the module
`api/package.json` (`docs/history/12-succession.md:95`), 3.0.0 since STYNX's publication (D-089, 07 §2
preamble), and `@devai-nyx/decorators` exact at `generatorVersion` (09 §2, 12 §3 DEVAI row); the root
carries tooling only and 09 §1.1's root row drops "the STYNX packages emitted code imports"; (b) root
only, with depcheck told to ignore workspace-package `missing dependency` for packages the root holds;
(c) both places. Recommended: (a). It is what depcheck reads and pnpm installs once; (b) hides real
gaps; (c) keeps two pins equal by hand. Amends 09 §6 (`api/package.json` row), 09 §1.1 (root
`package.json` row), 09 §2 (seed `api/package.json`), 09 §2.1 (`module.*` row), and 07 §2's app/testing
packages row, which still read "current manifests 1.6.2" after D-089 and now names 3.0.0 (a D-089
stale-text fix carried here). Chosen: (a). Source:
Owner (panels in the devai3 readiness session, 2026-10-24).

## D-095 · 2026-10-24 · The `generate` packet's globs, protected classes and `base`
[fact] 08 A.4's `generate` default globs name `apps/web/src/app.routes.ts` (`08-cli-and-nodes.md:68`;
copied at `packages/cli/src/commands/packet.ts:39`), while 09 §1.1 and the generator's mount line use
`apps/web/src/app/app.routes.ts` (`packages/cli/src/commands/new-module.ts:198`); the globs omit
`.stynxrc.json`, whose two entries D-087's mount lines edit, and `apps/api/tsconfig.json` (D-093).
`.stynxrc.json` is in the `standards` protected class and the generator writes
`api/test/acceptance/.gitkeep` (class `acceptance`), while PKT-DEMO-002 declares `protected: [spec]`
(`packages/cli/template/packets/CMP-DEMO-001/PKT-DEMO-002.md:22`); under D-078 both make `review`
gating (devai-v3#67 Open 4). [fact] `init` renders every packet's `base` as the template commit, so
the second commit (`chore(packets): seed CMP-DEMO-001`) is inside `base..candidate` and
`packet-scope` FAILs `out of scope: packets/CMP-DEMO-001/PKT-DEMO-001.md` (+3) in every cell
(devai-v3#67 Open 5). Options: (a) 08 A.4's `generate` globs corrected and completed
(`apps/web/src/app/app.routes.ts`, `.stynxrc.json`, `apps/api/tsconfig.json`,
`apps/web/tsconfig.json`); PKT-DEMO-002 declares `protected: [spec, standards, acceptance]`, the
classes a `generate` packet touches by construction; 09 §6 drops `api/test/acceptance/.gitkeep`, since
the `test` packet creates the folder; `init` keeps `base` = the template commit for all four
packets, and campaign step 3 runs `devai packet rebase packets/CMP-DEMO-001/PKT-DEMO-002.md --to HEAD`
before the generate commit, as steps 5 and 7 already rebase PKT-DEMO-003 and PKT-DEMO-004, so
`init`'s second commit is outside PKT-DEMO-002's `base..candidate`; (b) as (a), but `.stynxrc.json`
leaves the `standards` class (02 §5), so no declaration is needed; (c) globs and `base` only,
PKT-DEMO-002 keeps `protected: [spec]` and `review` gates on the mount. Recommended: (a). (b) weakens
`protected-paths` on a file that gates `boundary` and `openapi`; (c) makes campaign step 4 need a
model run, which 09 §4 keeps out of CI. [inference] Dropping `.gitkeep` also strikes it from 02 §7's
outputs and seed list and from 05 §3's `generate` row, which named it as the ground for `spec-tests`
`SKIPPED`; the ground is now the absent acceptance file. The first panel's (a) read "`init` renders
`base` = the packets commit for PKT-DEMO-002/003/004"; the recording PR (devai-v3#68) found that a
packet file inside that commit cannot name it, since the commit's sha depends on the file's bytes. A
second panel the same day chose for that clause between (i) `init` keeps the template commit as every
packet's `base` and campaign step 3 rebases PKT-DEMO-002 onto HEAD before the generate commit, and
(ii) the `generate` globs admit `packets/**`; Chosen: (i), the text of (a) above; (ii) would let a
`generate` packet edit every packet of its campaign. Amends 08 A.4 (`generate` globs), 05 §3
(`generate` row), 05 §7 (campaign prose, PKT-DEMO-002's `protected`), 09 §1.1 (packets row), 09 §2
(acceptance folder), 09 §2.1 (`requirements[]` row), 09 §4 (step 3), 09 §6 (`.gitkeep` row struck),
02 §7 (outputs, seed list). Chosen: (a), with the second panel's (i).
Source: Owner (panels in the devai3 readiness session, 2026-10-24; `base` clause, second panel,
2026-10-24).

## D-096 · 2026-10-24 · `.prettierignore` names the fixed-byte law texts; the generator formats its own output
[fact] `format` runs Prettier 3.9.6 with the template options over every changed file (08 B.2). The
fixed-byte law texts are not Prettier-clean: `AGENTS.md`, `.agents/skills/*/SKILL.md`,
`database/README.md`, `.stynxrc.json`, the five packet files, `SPEC-DEMO-001.md`, `UC-DEMO-001.json`
(devai-v3#66 Open 7, devai-v3#63 Open 25); nor are the generator's `README.md`, `api/package.json` and
`api/tsconfig.json` (devai-v3#67 Open 6, devai-v3#64 Open 17). Any edit of them, a spec packet and
campaign step 3's commit included, FAILs `format`. Options: (a) 09 §1.1 gains `.prettierignore` listing
the law-text paths (`AGENTS.md`, `CLAUDE.md`, `.agents/**`, `database/README.md`, `packets/**`,
`specs/**`, `product/**`, `.stynxrc.json`), read by `format`; the generator formats its emitted files
with Prettier and the template options before writing (09 §2; `prettier` is already a dependency of
`@devai-nyx/cli`); (b) reformat the texts in 05 §7, 06 §7, 09 §1.1 and 10 to Prettier's output and keep
them so; (c) `format` ignores files whose header marks them law texts. Recommended: (a). (b) touches
four law documents' bytes now and at every Prettier bump; (c) is a new population rule in B.2.
[inference] A path `.prettierignore` names is not a `format` observation, so B.2's count excludes it;
this entry is the decision D-084 item 1 requires for that count change. 08 B.2 Inputs already listed
`.prettierignore` (`08-cli-and-nodes.md:230`). Amends 09 §1.1 (new row), 09 §2 (emitted files
Prettier-formatted), 08 B.2 (Inputs, Observation, population table), 04 §1 (root drawing admits
`.prettierignore`). Chosen: (a). Source: Owner (panels in the devai3 readiness session, 2026-10-24).

## D-097 · 2026-10-24 · Materialise `init` installs `@devai-nyx/cli` at its own version, then commits with live hooks
[fact] 08 A.1 installs nothing (`08-cli-and-nodes.md:25-30`), so materialise's preflight finds every
package binary missing and exits 2 (devai-v3#66 Open 12), while 12 §4 R10 requires
`pnpm dlx @devai-nyx/cli@3.0.0 init --product demo` to exit 0 (`docs/history/12-succession.md:121`).
[fact] The registry has no `@devai-nyx/cli` 3.0.0, a lock produced at release cannot hold the
integrity of the tarball that contains it (devai-v3#66 Open 4), and the remedy printed today
(`pnpm add -D --save-exact @devai-nyx/cli@3.0.0`) 404s until R10 (devai-v3#67 Open 13). Options:
(a) materialise writes the template, runs `git init`, then
`pnpm add -D --save-exact @devai-nyx/cli@<its own version>`, which installs the workspace and
completes the lock in the scaffold, then makes the two commits (the hooks resolve, so no
`--no-verify`), then the preflight; a failed install is exit 2 `tooling-missing` with that command as
the remedy; the template manifest ships without `@devai-nyx/cli` and the shipped lock covers
everything else; (b) materialise runs `pnpm install --frozen-lockfile`, the manifest lists the CLI
exact and the lock is completed in a post-publish commit at R10; (c) materialise stays offline, skips
the `node_modules/.bin` preflight and prints `run pnpm install`. Recommended: (a). (b) makes the
release two-step and ships a 3.0.0 tarball whose lock omits itself; (c) moves the gaps to the pilot's
first `devai check`. No reason code is added (`tooling-missing` is reused). 12 §4 R10 still reads
exit 0 and does not contradict (a), so `docs/history/12-succession.md` is not edited for it. Amends
08 A.1 (Modes, Reads, Writes, Preflight, Exit), 09 §1 (Modes), 09 §1.1 (root `package.json` and
`pnpm-lock.yaml` rows), docs/adopters/install.md (`init` steps, exit 2). Chosen: (a). Source: Owner (panels in the devai3 readiness session,
2026-10-24).

## D-098 · 2026-10-24 · 09 §4 campaign: reference files as fixtures, the default cell is O2, negative cells re-stated to 08's forms
[fact] Campaign steps 5 and 7 add "the reference acceptance file" and "the reference service and
repository bodies" (`09-rail.md:197,199`); neither the law nor the repository gives their bytes
(devai-v3#67 Open 9). [fact] Negative cells mutate "the default cell (bare, no `--web`, `lgpd: true`,
en-US)" (`09-rail.md:209`) but `init`'s default is `lgpd: false` (`09-rail.md:53`; devai-v3#67 Open
10), and 09 §4 numbers no O-cell. [fact] Several expected messages differ from the implemented 08
forms: N1 `@Slo` → `@Slo missing (spec: p95 500 ms) [S-25]` (devai-v3#59 Open 2); N1 `@RequireRoles`
adds `neither role-bound nor @Public() [S-11]`; N4a–c and N5 yield LINT013 only, because
migration-linter 3.0.0 matches unquoted identifiers and lacks `author_alias` in its PII tokens
(devai-v3#58 Open 1–2); N12 exits 1, not 2 (devai-v3#67 Open 11). Options: (a) R8 authors the reference
files as DEVAI fixtures under `packages/cli/fixtures/campaign/` and 09 §4 cites them by path
(`SPEC-DEMO-001.acceptance.spec.ts`, `notes.service.ts`, `notes.repository.ts`); the default cell is
`init --lgpd` and is O2 in W9's numbering (O1 none · O2 `--lgpd` · O3 pt-BR · O4 `--lgpd` pt-BR · O5–O8
the same with `--web`; devai-v3#67 R8 seed); rows N1, N4a–c, N5 and N12 are re-stated to the observed
08 forms, with N4a–c's LINT001 and N5's LINT012 marked "after STYNX S10 fixes identifier quoting and
PII tokens" (D-100); (b) the reference files are written into 09 §4 as fixed-byte rows like 09 §6;
(c) 09 §4 stays as written and R8 reads it as intent. Recommended: (a). (b) makes every fixture edit a
law edit; (c) leaves steps 5–8 without an oracle. `init`'s default stays `lgpd: false` (08 A.1
unchanged). Amends 09 §4 (steps 5 and 7, default cell, O1–O8 numbering, N1, N4a–c, N5, N12). Code
follow-up (R8): the three fixtures. Chosen: (a). Source: Owner (panels in the devai3 readiness
session, 2026-10-24).

## D-099 · 2026-10-24 · Under `--hook pre-push` an unreadable base is `UNKNOWN` and exits 2 (C.2 over the A.7 "notice")
[fact] 08 A.7 says a pre-push hook with an unresolvable base reports `protected-paths UNKNOWN:
base-unreadable (a notice)` and "never exits non-zero for a protected-path notice"
(`08-cli-and-nodes.md:94,111`); C.2's report refinement rejects an exit 0 that carries an `UNKNOWN`
row other than `review`, and W4 let C.2 win, exiting 2 (devai-v3#63 Open 20). Options: (a) C.2 wins:
under `--hook pre-push` an unreadable base is `protected-paths UNKNOWN: base-unreadable`, exit 2 like
any gating `UNKNOWN`, and A.7's "never exits non-zero" sentence is struck; the push is refused until
the base is fetched; (b) A.7 wins: `protected-paths` is non-gating under `--hook pre-push` and C.2's
refinement exempts it beside `review` when `hook = pre-push`. Recommended: (a). (b) adds a second
gating exception to the schema (D-078). The touched-class lines stay notices: they come with a
`PASS` and never set the exit code. Amends 08 A.7, 10 §4 (pre-push text). No code change: W4
already behaves as ruled. Chosen: (a). Source: Owner (panels in the devai3 readiness session,
2026-10-24).

## D-100 · 2026-10-24 · R6 closes modulo the S10 list of STYNX defects (cross-references D-088)
[fact] `generated`'s three STYNX observations are `UNKNOWN: tooling-missing` until the write pair
ships (D-088), so campaign step 4's "exit 0" (`09-rail.md:196`) is unreachable now (devai-v3#64 Open
15; devai-v3#67 clauses 2 and 7). [fact] Further STYNX 3.0.0 defects found while building R6:
`stynx migrate up` reads `<cwd>/packages/data/migrations/platform`, so `db-apply` FAILs in every cell
(devai-v3#66 Open 5); an id-less `GET /healthz` answers 500 (devai-v3#66 Open 6); `list-routes` reports
`permissions: ""` for `@RequireRoles`, so `route-contract` is `tooling-missing` on every role-bound
route (D-087); the migration linter matches unquoted identifiers only, lacks `author_alias` as a PII
token, and will raise LINT002 on 09 §6's DDL once fixed (devai-v3#58 Open 1–3); LINT010 reads one
prefix group (D-085). `--full` is lifted but incomplete (devai-v3#67 Open 8). Options: (a) R6 closes
when W9's clause check is green modulo the S10 list: a cell whose only non-PASS rows are
`UNKNOWN: tooling-missing` or FAILs traced to a listed STYNX defect counts as met; until STYNX ships,
09 §4 step 4 is met when the exit is 0, or 1 or 2 where every `FAIL` row traces to the S10 list and
every other non-PASS row is `UNKNOWN: tooling-missing` or `prerequisite-failed` behind a traced row;
the S10 list is recorded here; `--full` completion is W10 code work; (b) R6
stays open until STYNX ships S10 and R7–R10 wait; (c) D-088 revised: absent STYNX pairs make the
observations `SKIPPED`, so `generated` can PASS on the replay alone. Recommended: (a). (b) puts months
of STYNX work on the critical path; (c) reports a missing verification as "nothing to do".
**The S10 list** (STYNX items DEVAI waits on; each is cited where DEVAI reports it):
1. the write pair `stynx api-docs write` and `stynx public-api-baselines write` (D-088);
2. `stynx migrate up` reads the installed `@stynx-nyx/data` platform migrations, not
   `<cwd>/packages/data/migrations/platform` (devai-v3#66 Open 5);
3. an id-less `GET /healthz` and `GET /readyz` answer 200, not 500 (devai-v3#66 Open 6; D-072);
4. `list-routes` reads `@RequireRoles` as role-binding and reports it in `permissions`, not `""` (D-087);
5. the migration linter matches quoted identifiers, counts `author_alias` as a PII token, and the
   LINT002 it then raises on 09 §6's DDL is settled (devai-v3#58 Open 1–3);
6. LINT010 reads both prefix groups of `YYYYMMDD_NN_` (D-085).
The first panel's (a) read step 4 as "exit 0, or exit 2 whose only non-PASS rows are `UNKNOWN
tooling-missing` or FAILs traced to the S10 list"; the recording PR (devai-v3#68) found it
self-contradictory, since a `FAIL` row makes the exit 1 (02 §8). A second panel the same day restated
it as the text of (a) above (exit 0, or 1 or 2 with every `FAIL` traced and every other non-PASS row
`tooling-missing` or `prerequisite-failed` behind a traced row); Chosen. D-088 is not edited; its `tooling-missing` rows are item 1 of the list. Amends 12 §4 (R6 row,
in place: `docs/history/12-succession.md` header note), 09 §4 (step 4), `docs/history/index.md` (12's
status line), docs/dev/release.md (where things stand). Code follow-up (W10): `--full` completion (`accepted: true` on exit 0, the report write
on text-format `--full`, `db-apply` reuse, the scratch database dropped after the last consumer;
devai-v3#67 Open 8). Chosen: (a), as restated by the second panel. Source: Owner (panels in the
devai3 readiness session, 2026-10-24; step 4 exit, second panel, 2026-10-24).

## D-101 · 2026-10-24 · The sensor runs without `--bare`
[fact] `claude --help` 2.1.292: `--bare` makes authentication strictly `ANTHROPIC_API_KEY` or
`apiKeyHelper`, so on an OAuth-only host (the release host) `permissions-pattern` is `model-error`
(devai-v3#62 Open 2; `packages/cli/test/model/fixtures/README.md:10`, "Not logged in"). 08 B.24's
recipe carries `--bare` (`08-cli-and-nodes.md:540`). Options: (a) drop `--bare` from B.24's recipe and
keep the D-082 flags (`--tools ""`, `--restricted`, the empty MCP config, `--setting-sources ""`), which
carry the isolation; the sensor uses the host's own authentication, as `review` does; (b) keep
`--bare` and require `ANTHROPIC_API_KEY` on the release host and in every adopter's local run (a new
07 §4 host requirement; 12 §4 R7 amended). Recommended: (a). (b) adds a host requirement for no
isolation gain. Amends 08 B.24 (Invokes), 07 §6 (sensor paragraph). Code follow-up (W10):
`packages/cli/src/model/cli.ts:102` drops the flag. Chosen: (a). Source: Owner (panels in the devai3
readiness session, 2026-10-24).

## D-102 · 2026-10-24 · The remaining R6 wave Open items are ratified as recorded
The nine R6 wave PRs listed their readings where the law was silent under `## Open`, 165 items in all
(collected verbatim in the Owner's workspace as `agents/R6-OPEN-LISTS-2026-10-24.md`): devai-v3#57
(16), #58 (21), #59 (14), #61 (13), #62 (19), #63 (26), #64 (20), #66 (22), #67 (14). D-092…D-101 rule 28
of them: #58 Open 1, 2, 3; #59 Open 2, 3; #62 Open 2; #63 Open 20, 25; #64 Open 14, 15, 17; #66 Open 1,
4, 5, 6, 7, 12; #67 Open 1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14. The other 137 are ratified here:
#57 16, #58 18, #59 12, #61 13, #62 18, #63 24, #64 17, #66 16, #67 3 (Open 3, 7, 12). Options: (a) ratify
as recorded: each item's reading is the law's reading until a stale-text PR or a later decision says
otherwise; the message texts and hints the waves invented become 08's text in one later 08 stale-text
PR, authored from that list; no code changes; (b) ratify as recorded except named rows, which get their
own D-nnn in the next packet. Recommended: (a). The packet named six rows the Owner might isolate,
as judgement calls rather than blockers: #62 Open 3 (usage accounting sums every reported input
component; a 20-call review often reaches the 150k bound), #62 Open 4 (Codex `workspace-write`
confinement flags added), #63 Open 21 (pre-push refused until `generated` landed; now moot), #61 Open 11
(`sql-typed` DB describes through `SET ROLE`), #66 Open 18 (test roles get the scratch password;
`DATABASE_APP_URL` is not law), #58 Open 17 (06 §3's `uniqueItems` contradiction; the schema follows
the text). None was isolated. This entry authorises the one 08 stale-text PR named in (a); it is not
that PR, and no law text changes here. Chosen: (a). Source: Owner (panels in the devai3 readiness
session, 2026-10-24).

## D-103 · 2026-10-25 · Module packages declare `@stynx-nyx/tsconfig`, the preset their `tsconfig.json` extends (amends D-094's list)
[fact] The module `api/tsconfig.json` extends `@stynx-nyx/tsconfig/node24.json` (`09-rail.md:291`;
`web/tsconfig.json` extends `angular18.json`), and depcheck counts an `extends` target as a dependency
of the package, so `deadcode` FAILs `domain/notes/api/package.json:1 missing dependency
@stynx-nyx/tsconfig` (and `domain/notes/web/package.json:1` with `--web`) in all eight O-cells
(devai-v3#69 Open 1). D-094's list (seven packages, `decisions.md:1266`) omits it; the app packages
already carry it as a devDependency (`packages/cli/template/apps/api/package.json`). Options: (a) D-094's
list gains `@stynx-nyx/tsconfig` 3.0.0 as a `devDependency` of the module `api/package.json` and
`web/package.json`; 09 §6 manifest rows amended; (b) the knip config ignores `extends` targets the
root already holds. Recommended: (a). It is what depcheck reads, as for the app packages; (b) adds a
second population rule to `deadcode`. D-094 is not edited; this entry states what it adds. Amends 09 §2
(seed `api/package.json`), 09 §2.1 (`module.*` row), 09 §6 (`api/package.json` row). Code follow-up
(W11): the generator's manifests. Chosen: (a). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part C, Owner's workspace).

## D-104 · 2026-10-25 · The generator tags the seeded exports a code packet will consume `/** @public */`
[fact] On a fresh module knip FAILs `unused export insertNote`, `getNote` (`notes.repository.ts`),
`createNoteResponse`, `getNoteResponse` (the DTO files): the seeded queries and response schemas have
no importer until the code packet PKT-DEMO-004 wires them, so campaign step 4 cannot be met under
D-100 in any cell (devai-v3#69 Open 2; devai-v3#67 Open 7, ratified as recorded by D-102). Options:
(a) the generator emits knip's `/** @public */` JSDoc tag on each seeded export the code packet is
expected to consume (repository queries, response schemas); knip then does not report them; the code
packet may remove the tag when it wires them; no knip config change; (b) knip ignores exports under
`domain/*/api/src/dto/**` and `*.repository.ts`; (c) the seed service stub consumes them.
Recommended: (a). It marks the exact exports and keeps `deadcode` live on everything else; (b) hides
every future dead export in those files; (c) gives a stub behaviour the code packet must delete
(P-5-08). Amends 09 §2 (seed repository, generated DTO files), 09 §2.1 (`queries[]`,
`routes[].response` rows), 09 §6 (repository and DTO rows). Code follow-up (W11): the renderer.
Chosen: (a). Source: Owner (panels, 2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part C,
Owner's workspace).

## D-105 · 2026-10-25 · The `unit` tier initialises Angular's TestBed for web specs from a template setup file
[fact] In every `--web` cell `unit` FAILs `domain/notes/web/test/note.service.spec.ts:1 collection
failed: The service 'BrowserXhr' needs to be compiled using the JIT compiler, but '@angular/compiler'
is not available` (devai-v3#69 O5–O8; devai-v3#67 Open 3, ratified as recorded by D-102): the root
Vitest config (09 §1.1, `09-rail.md:64`) loads no Angular test environment, and the template root
carries neither `@angular/compiler` nor `@angular/platform-browser` (`packages/cli/template/package.json`;
both are in `apps/web/package.json` only). Options: (a) 09 §1.1 `vitest.config.ts` row: the `unit` tier
gets a `setupFiles` entry for web specs, `test/support/angular.setup.ts` (imports `@angular/compiler`,
initialises TestBed with `BrowserTestingModule`/`platformBrowserTesting`, zoneless); `@angular/compiler`
and the `@angular/platform-browser` testing entry join the template root devDependencies, pinned
exactly like the other Angular packages in §1.1; (b) the generated web spec avoids Angular DI.
Recommended: (a). The generated service is an Angular injectable, and its spec should load it as the
app does; (b) tests a service outside the injector that runs it. [inference] "Pinned exactly like the
other Angular packages" is 22.2.1, the Angular family pin (09 §5, 07 §2), which the root's
`@angular/build`, `@angular/cli` and `@angular/compiler-cli` carry. Amends 09 §1.1 (root
`package.json` row, `vitest.config.ts` row, new `test/support/angular.setup.ts` row). Code follow-up
(W11): the template file, config and manifest. Chosen: (a). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part C, Owner's workspace).

## D-106 · 2026-10-25 · Campaign step 3 builds the workspace before the generate commit; `new module` prints the build last
[fact] At campaign step 3 the pre-commit hook's `lint` FAILs `apps/api/src/app.module.ts:19:3
@typescript-eslint/no-unsafe-assignment` while `@demo/notes-api`'s `exports` (`./dist/index.js`,
`09-rail.md:288`) is unbuilt: typed lint sees the import as `any`. W10's re-run ran
`tsc -b apps/api/tsconfig.json [apps/web/tsconfig.json]` before `git commit`; 09 §4 step 3 lists no
build (`09-rail.md:197`; devai-v3#69 Open 5). Options: (a) 09 §4 step 3 gains `pnpm -r build` after
`pnpm install` (the apps' `tsc -b` builds the referenced module); `new module` prints it as the last
mount line, `then pnpm -r build`; (b) `exports` gain a `types`/`development` condition. Recommended:
(a). It builds what D-093's `references` already declare; (b) makes typed lint read sources through a
condition no runtime uses. Amends 09 §2 (mount lines), 09 §4 (step 3), 09 §6 (printed mount lines).
Code follow-up (W11): `new module`'s mount print. Chosen: (a). Source: Owner (panels, 2026-10-25;
packet `PACKET-2026-10-24-R6-CLOSE.md` Part C, Owner's workspace).

## D-107 · 2026-10-25 · W10's readings are ratified as recorded (devai-v3#69 Open 3, 4, 6–11)
[fact] The W10 fix wave (devai-v3#69) listed eleven items under `## Open`; D-103, D-104 and D-106 rule
Open 1, 2 and 5. The other eight are W10's readings where the law was silent:
- **Open 3**: the D-098 fixtures are not authored and steps 5–8 not run; R8 authors them (D-098), with a
  token helper, since the template's test support gives database roles but no way to mint a
  `StynxAuthModule` token and no law fixes the token form.
- **Open 4**: the real D-097 `pnpm add -D --save-exact @devai-nyx/cli@3.0.0` 404s until R10; tests and
  the re-run reach `init` through a `pnpm` first on `PATH` (`packages/cli/test/pnpm-shim.ts`, modes
  `stub`, `fail`, `real`), the host lookup `init` already makes, not a CLI flag or variable; the real
  `pnpm add` is first exercised at R10. The `@devai-nyx/decorators` 3.0.0 pin at campaign step 3's
  `pnpm install` is bridged the same way (a global pnpmfile `link:`).
- **Open 6**: under `--hook pre-commit|commit-msg` an unborn `HEAD` is read as git's empty tree, and the
  report's `head` is the empty tree's id (`4b825dc6…`, not a commit); every other mode still refuses
  `HEAD has no commit`.
- **Open 7**: `AppModule` in `apps/<app>/src/app.module.ts`, the mount-census root, is exempt from
  `devai/product-prefix`; only that class in that file.
- **Open 8**: a commit refused by a hook during `init` is exit 2 `setup-failed`
  (`git commit "<subject>" refused by the hooks: <FAIL/UNKNOWN lines>; fix the findings, then commit by
  hand`); after a failed install or a refused commit, `devai init` again is attach mode and commits
  nothing.
- **Open 9**: the `layout` exemption covers all six 09 §1.1 `vitest.config.ts` tier literals, including
  `test/integration/…` and `test/db/…`, which the template already populates.
- **Open 10**: generator formatting is pinned to the CLI's own Prettier (3.9.6, a dependency of
  `@devai-nyx/cli`); a Prettier bump in a later CLI changes the bytes for a new `generatorVersion`, as
  any renderer change does.
- **Open 11**: `render()` is async (Prettier 3 has no synchronous API); 09 §2's
  `render(specBytes, options, version) → Map` resolves to that map.
Options: (a) ratify all as recorded; (b) ratify except named rows. Recommended: (a). Chosen: (a).
Where a reading changes framework text it is applied: 08 A.1 (Exit, Failure → reason: the `init`
exit-2 path and the attach re-run; Open 8), 08 A.7 (unborn `HEAD`; Open 6), 08 B.3 (`product-prefix`
exemption; Open 7), 08 B.6 (S-62 tier literals; Open 9), 09 §2 (async `render`, the pinned Prettier;
Open 10, 11), 09 §4 (R8's token helper; Open 3). Open 4 changes no law text; this entry records it.
No code change: W10 already behaves as ratified. Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part C, Owner's workspace).

## D-108 · 2026-10-25 · The app manifests carry `scripts.build: "tsc -b"`, so D-106's `pnpm -r build` builds the module
[fact] D-106 has campaign step 3 run `pnpm -r build`, "the apps' `tsc -b` builds the referenced module"
(D-106), but no template package has a `build` script: the root `scripts` holds only `test`
(`packages/cli/template/package.json:10-12`), and `apps/api/package.json` and `apps/web/package.json` have
no `scripts`. pnpm 9.15.0 then prints `None of the selected packages has a "build" script` and exits 0,
building nothing (devai-v3#70 Open 1). Options: (a) `apps/api/package.json` and `apps/web/package.json`
gain `scripts.build: "tsc -b"`; (b) step 3 runs `pnpm exec tsc -b apps/api/tsconfig.json` directly;
(c) the module manifests get the script. Recommended: (a). The apps' `tsc -b` follows D-093's
`references` into every mounted module, so one script per app builds the graph and D-106's line
stays true; (b) leaves the printed mount line without effect; (c) puts the script in each generated
seed and still builds nothing the apps reference unless they build too. 09 §6 shows no app manifest,
so its bytes do not change. Amends 09 §1.1 (`apps/api` and `apps/web` rows). Code follow-up (W11): the
two template manifests. Chosen: (a). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part D, Owner's workspace).

## D-109 · 2026-10-25 · D-106's printed line is exactly `mount: then pnpm -r build`
[fact] D-106 has `new module` print `then pnpm -r build` "as the last mount line" without fixing the
line's form; 09 §2 and §6 read it as its own line `mount: then pnpm -r build` (devai-v3#70 Open 2).
Options: (a) the last printed line is exactly `mount: then pnpm -r build`; (b) the line drops the
`mount:` prefix. Recommended: (a). Every printed mount line carries the prefix, so a reader that
collects them gets the build too. Confirms 09 §6 as amended by D-106; 09 §2 now says "exactly".
Chosen: (a). Source: Owner (panels, 2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part D,
Owner's workspace).

## D-110 · 2026-10-25 · The `unit` tier is two Vitest projects in the one root config: `unit-api` and `unit-web` (refines D-105)
[fact] D-105 gives the `unit` tier `setupFiles: ['test/support/angular.setup.ts']` "for web specs", but
Vitest applies a config's `setupFiles` to every file it runs, so the one root config would load the
Angular setup for API and app specs too; the setup's TestBed comes from `@angular/core/testing`, while
`@angular/core` is in `apps/web/package.json` only; and no DOM environment was named for
`BrowserTestingModule` (devai-v3#70 Open 3). Options: (a) the `unit` tier is two Vitest projects in the
one root config: `unit-api` (node environment; `domain/*/api/test/*.spec.ts`, `apps/*/test/*.spec.ts`)
and `unit-web` (`environment: 'jsdom'`, `setupFiles: ['test/support/angular.setup.ts']`,
`domain/*/web/test/*.spec.ts`); root devDependencies gain `@angular/core` at the Angular pin 22.2.1 and
`jsdom` at an exact pin resolved from the registry; one `unit` tier literal (S-62 unchanged); (b) a
self-guarding setup plus a generator-emitted `// @vitest-environment jsdom` pragma; (c) revert to
D-105 (b), the generated web spec avoids Angular DI. Recommended: (a). It scopes the setup and the DOM
to the web specs in configuration, with no per-file pragma; (b) makes each generated spec carry its
environment; (c) undoes D-105. [fact] The exact pin is `jsdom` 30.1.3, the registry's `latest`
(published 2026-10-15; `engines.node` `^22.22.2 || ^24.15.0 || >=26.0.0`, which admits Node 24;
Vitest 4.1.11 peers `jsdom: "*"`; `npm view jsdom@30.1.3`, `npm view vitest@4.1.11 peerDependencies`,
2026-10-25). [inference] "One `unit` tier literal" reads as: `TEST_TIER=unit` stays one tier over the
same three patterns, now split between the two projects, so S-62 and 08 B.6's six tier literals
(D-107) are unchanged. D-105 is not edited; this entry states how its setup is scoped. Amends 09 §1.1
(root `package.json` row, `vitest.config.ts` row, `test/support/angular.setup.ts` row). Code follow-up
(W11): the template config and manifest, and the lock. Chosen: (a). Source: Owner (panels,
2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part D, Owner's workspace).

## D-111 · 2026-10-25 · The `/** @public */` tag is permanent in `generated` DTO files, removable only in seed files (refines D-104)
[fact] D-104 says the code packet "may remove the tag when it wires" the tagged exports, but the
response schemas live in `generated` DTO files, where a hand edit FAILs `generated` (S-45) and
regeneration puts the tag back (devai-v3#70 Open 4). Options: (a) the tag is permanent in `generated`
DTO files and removable only in seed files such as `*.repository.ts`; 09 §2.1 says so; (b) the
generator drops the tag once the export is wired. Recommended: (a). (b) is not implementable: the
renderer reads only the spec and the options (09 §2), never whether a seed imports an export. Amends
09 §2 (generated and seed bullets), 09 §2.1 (`queries[]`, `routes[].response` rows). No code change:
the renderer emits the tag either way. Chosen: (a). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part D, Owner's workspace).

## D-112 · 2026-10-25 · A re-run of `init` on a repository without a `Packet:` commit is a first run, not attach mode (narrows D-107's Open 8 reading)
[fact] D-107 ratified W10's reading that after a failed install or a hook-refused commit "`devai init`
again is attach mode and commits nothing" (devai-v3#69 Open 8), and amended 08 A.1 to say so; who then
makes the template and packets commits was not stated (devai-v3#70 Open 5). Options: (a) attach mode
makes the missing commits; (b) `init` prints the commit commands; (c) a re-run of `init` on a
repository whose `HEAD` is unborn or that has no `Packet:` commit is a first run, not attach mode;
D-107's attach reading is narrowed to repositories with a `Packet:` commit. Recommended: (c). It keeps
attach mode to "hooks and git config only" (08 A.1) and lets the same command finish what it started;
(a) gives attach mode a write path; (b) moves the pilot's first commits out of DEVAI. D-107 is not
edited; this entry narrows its Open 8 reading: attach mode is a repository with `devai.json` and
both `init` commits; with fewer than the two `init` commits a re-run is a first run (wording amended
by D-115, 2026-10-25: it read "a commit carrying a `Packet:` trailer"). The first run here is D-113's re-run: it keeps the files on
disk, skips materialise, re-runs the install and makes the two `init` commits (wording amended by
D-113, 2026-10-25). Amends 08 A.1 (Modes, Exit), 09 §1 (Modes), docs/adopters/install.md (attach
mode). Chosen: (c). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part D, Owner's workspace).

## D-113 · 2026-10-25 · An `init` re-run keeps the files on disk, re-runs the install and makes the two commits; `--product` must match (`config-mismatch`)
[fact] D-112 makes a re-run of `init` on a repository whose `HEAD` is unborn or that has fewer than
the two `init` commits (wording amended by D-115, 2026-10-25: it read "no `Packet:` commit") a first run, not attach mode; but 08 A.1 rejects `--product` "when one [`devai.json`] exists" and
requires `--dir` "empty or absent in materialise mode" (`dir-not-empty`), so the re-run D-112 admits
meets two rules written for an empty directory, and whether it rewrites the template was not stated
(devai-v3#71 Open 1). Options: (a) a re-run where `HEAD` is unborn or has fewer than the two `init` commits (D-115) keeps
the files on disk and skips materialise; it accepts the existing `devai.json` and template (`--product`
must match the recorded product or be omitted; a mismatch is exit 2 `config-mismatch`), re-runs the
`pnpm add`/install and makes the two `init` commits; nothing is rewritten; (b) materialise over the
existing files, with `dir-not-empty` waived when `HEAD` is unborn; (c) no re-run: the operator deletes
the directory. Recommended: (a). It finishes the interrupted `init` without discarding the pilot's
fixes to the findings that refused the commit; (b) overwrites those fixes; (c) discards them.
[inference] "The recorded product" is `devai.json` `productPrefix`, the field `--product` writes (09
§1.1). `config-mismatch` is a new command-level reason code: this entry is the decision D-055 requires
for it; it joins 08 C.2's `ReasonCode` enum and 10 §4's hint table. Its hint, written here, is
`--product differs from devai.json productPrefix; omit it or pass the recorded product`. D-112's
wording is amended by this entry ("a first run" now reads as this re-run). Amends 08 A.1 (Arguments,
Modes, Reads, Exit, Failure → reason), 08 C.2 (`ReasonCode`), 09 §1 (Modes), 10 §4 (hint table),
docs/adopters/install.md, docs/reference/reason-codes.md, docs/reference/cli.md. Code follow-up: the
re-run path and the reason code in `packages/cli/src/report.ts`, whose byte-parity test with 08 C.2 is
`it.fails` until then. Chosen: (a). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part E, Owner's workspace).

## D-114 · 2026-10-25 · `unit` invokes Vitest on the affected spec files by path; an empty Vitest project is left out at load
[fact] 08 B.11's Invokes row passes `--project <affected…>` (`08-cli-and-nodes.md:358`); with D-110's
Vitest projects `--project` selects `unit-api`/`unit-web` by name, not workspace packages, and the
implementation passes the population's files instead (`packages/cli/src/nodes/unit.ts:2`); whether a
project whose patterns match no file is left out was not stated (devai-v3#71 Open 2). Options: (a) 08
B.11's Invokes row reads "the affected spec files, by path" (what `packages/cli/src/nodes/unit.ts` does);
a Vitest project whose patterns match no file is left out of the config at load exactly as an empty
tier is (S-62 reading extended), so a template without a web module runs `unit-api` only; (b) keep
`--project` and map affected packages to project names. Recommended: (a). The census already names
the files, and a path selects across both projects; (b) adds a mapping the files make unnecessary.
Amends 08 B.11 (Invokes), 09 §1.1 (`vitest.config.ts` row). No code change: the node already passes
paths, and the template config already filters out a project with no file
(`packages/cli/template/vitest.config.ts:22-39`, devai-v3#72). Chosen: (a). Source:
Owner (panels, 2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part E, Owner's workspace).

## D-115 · 2026-10-25 · `init` is a re-run until both of its commits exist and makes whichever is missing; attach mode starts after both (amends D-112, D-113)
[fact] D-112 makes attach mode a repository with a `Packet:` commit, but `init`'s template commit carries
`Packet: PKT-DEMO-001` while its packets commit is the second: when the template commit lands and the
hooks refuse the packets commit, the repository has a `Packet:` commit, a re-run is attach mode, which
makes no commit, and the packets commit has no path (devai-v3#73 Open 1). Options: (a) `init` is a
re-run while `HEAD` lacks either of its two commits (the template commit, trailer `Packet:
PKT-DEMO-001`, and the packets commit, trailer `Packet: CMP-DEMO-001` since D-120; wording amended by
D-120, 2026-10-25) and makes whichever is missing; attach mode starts only after
both exist; (b) the operator commits by hand; (c) a single `init` commit. Recommended: (a). It finishes
an interrupted `init` from any point with the same command; (b) leaves the commits' form to the
operator; (c) changes 05 §7's campaign, whose spec packet is complete in the template commit. D-112's
and D-113's "no `Packet:` commit" now reads "fewer than the two `init` commits"; both entries' wording is
amended so. Amends 08 A.1 (Modes, Exit), 09 §1 (Modes), docs/adopters/install.md,
docs/reference/reason-codes.md. Code follow-up: the re-run's commit detection. Chosen: (a). Source:
Owner (panels, 2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part F, Owner's workspace).

## D-116 · 2026-10-25 · On an `init` re-run, `--locales`, `--lgpd` and `--runtime` must equal `devai.json` or be omitted (`config-mismatch`)
[fact] D-113 rules only `--product` on a re-run; W11 ignores `--locales`, `--lgpd` and `--runtime` there,
without comparing them with `devai.json` (devai-v3#73 Open 2, devai-v3#74 Open 2, devai-v3#72 Open 1).
Options: (a) ignored; (b) on a re-run `--locales`, `--lgpd` and `--runtime` must equal `devai.json` or
be omitted, else exit 2 `config-mismatch`, the same rule as `--product`; (c) refused as `usage`.
Recommended: (b). The re-run rewrites nothing, so an argument that differs from the recorded value
would be silently dropped under (a); (c) refuses an argument that agrees. [inference] The recorded
fields are `devai.json` `locales`, `lgpd` and `runtime.mode`, the fields those arguments write (09 §1.1).
Amends 08 A.1 (Arguments, Exit, Failure → reason), 09 §1 (Modes), docs/adopters/install.md,
docs/reference/{reason-codes,cli}.md. Code follow-up: the three comparisons. Chosen: (b).
Source: Owner (panels, 2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part F, Owner's workspace).

## D-117 · 2026-10-25 · The `config-mismatch` hint names the mismatching argument; a refused `init` commit says "run devai init again"
[fact] D-113's `config-mismatch` hint was written in the recording PR (devai-v3#73 Open 3); W11 wrote
another (`omit --product, or pass the productPrefix devai.json records; the re-run keeps the files on
disk`, devai-v3#74 Open 1, devai-v3#72 Open 1); and 08 A.1's `setup-failed` line still told the pilot to
"commit by hand", which under D-112 leaves the repository in first-run state or skips the packets
commit, so W11 printed `fix the findings, then run devai init again` (devai-v3#72 Open 2). Options:
(a) 10 §4 keeps devai-v3#73's hint text, generalised to name the mismatching argument:
`<flag> differs from devai.json <field>; omit it or pass the recorded value`, and the `setup-failed`
remedy becomes `fix the findings, then run devai init again` in 08 A.1, replacing `then commit by hand`;
(b) the code's texts win. Recommended: (a). One hint covers D-116's four arguments; the remedy is the
D-115 path. Amends 08 A.1 (Exit), 10 §4 (`config-mismatch` row), docs/reference/reason-codes.md. Code
follow-up: the hint in `packages/cli/src/text/hints.ts`. Chosen: (a). Source: Owner (panels,
2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part F, Owner's workspace).

## D-118 · 2026-10-25 · W11's readings are ratified as recorded (devai-v3#72 Open 3, 4, 7; devai-v3#74 Open 3)
[fact] W11 (devai-v3#72, devai-v3#74) listed its readings where the law was silent. Ratified:
- **#72 Open 3**: a `Packet:` commit is any commit reachable from `HEAD` with a `Packet:` trailer
  (`git log --format=%(trailers:key=Packet,valueonly) HEAD`), not specifically `PKT-DEMO-001`; under
  D-115 the two `init` commits are identified by their trailers, `Packet: PKT-DEMO-001` and `Packet:
  CMP-DEMO-001` (wording amended by D-120, 2026-10-25).
- **#72 Open 4**: `accept`'s campaign step 4 `FAIL` counts as traced (D-100) when every finding it
  carries is a traced or `tooling-missing` row.
- **#72 Open 7**: on a re-run, the `dir-not-empty` check and the `--product` requirement do not apply
  (as 08 A.1 states since D-113).
- **#74 Open 3**: `config-mismatch` is a reason code the Owner introduced by D-113, not one chosen in
  code; D-055 is kept.
Options: (a) ratify as recorded; (b) ratify except named rows. Recommended: (a). Where a reading
changes framework text it is applied: 08 A.1 (what a `Packet:` commit is), 09 §4 step 4 (`accept`'s
traced `FAIL`). 12 §4 R6 is not edited:
its done clause reads "every `FAIL` row traces to the S10 list", and this entry records how `accept`'s
row traces. No code change: W11 already behaves as ratified. Chosen: (a). Source: Owner (panels,
2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part F, Owner's workspace).

## D-119 · 2026-10-25 · R6 clause 2 is met at 09 §4 steps 1–4; steps 5–8 are R8 acceptance; R6 closes at 10/10 modulo the S10 list
[fact] W11's R6 clause check is 10 ✅ reading clause 2 ("campaign 09 §4 steps 1–8 green in bare mode")
as steps 1–4 while D-098 defers the fixtures steps 5–8 need, and 9 ✅ · 1 ❌ on a strict reading
(devai-v3#72 Open 5; steps 5–8 not run, as in devai-v3#69 Open 3). Options: (a) clause 2 of the R6
check is met at 09 §4 steps 1–4; steps 5–8 are R8 acceptance (D-098); R6 closes at 10/10 modulo the
S10 list (D-100) once devai-v3#73 and devai-v3#74 merge; (b) R6 stays open until steps 5–8 run.
Recommended: (a). Steps 5–8 need the R8 fixtures and a token helper (D-098, D-107), and steps 6 and 8
would meet S10 #2 anyway (devai-v3#69 Open 3); (b) puts R8's work on R6's critical path. **R6 status:
closed at 10/10 modulo the S10 list (D-100)**, effective when devai-v3#74 merges (devai-v3#73 merged
2026-10-25). 00 and 10 carry no round status line; docs/dev/release.md (where things stand) records the
close. 12 §4's R6 row is not edited. Chosen: (a). Source: Owner (panels, 2026-10-25; packet
`PACKET-2026-10-24-R6-CLOSE.md` Part F, Owner's workspace).

## D-120 · 2026-10-25 · `init`'s packets commit carries `Packet: CMP-DEMO-001`; both `init` commits are recognised by their trailers (amends D-115, D-118)
[fact] D-118 identifies the two `init` commits by their `Packet:` trailers, but the packets commit
(`chore(packets): seed CMP-DEMO-001`) carried no trailer (08 A.1; `packages/cli/src/commands/init.ts:313`),
so a re-run could not recognise it (devai-v3#75 Open 1); W11 matched its exact subject instead
(devai-v3#76 Open 2). Options: (a) the packets commit gains the trailer `Packet: CMP-DEMO-001`, so both
`init` commits are recognised by their `Packet:` trailers exactly as D-118 reads; a history without both
trailers reachable from `HEAD` is a re-run, one with both is attach mode; (b) match the exact subject;
(c) `packets/CMP-DEMO-001/` present at `HEAD`. Recommended: (a). Trailers survive a reworded subject,
and D-118 already reads them; (b) breaks on a reworded or squashed history; (c) holds after a hand
commit of the packet files, which is not `init`'s commit. D-115's and D-118's wording is amended:
"identified by their trailers" names `Packet: PKT-DEMO-001` (template commit) and `Packet: CMP-DEMO-001`
(packets commit). Amends 08 A.1 (Modes: the packets commit's message, attach mode), 09 §1 (step 4,
attach), 05 §7 (campaign prose), docs/adopters/install.md, docs/start/quickstart.md. Code follow-up: the
trailer on the packets commit and trailer-based detection in `init`. Chosen: (a). Source: Owner (panels,
2026-10-25; packet `PACKET-2026-10-24-R6-CLOSE.md` Part G, Owner's workspace).

## D-121 · 2026-10-25 · W11's `config-mismatch` readings are ratified (devai-v3#76 Open 1, 3, 4)
[fact] W11's second follow-up (devai-v3#76) listed its readings of D-116 and D-117:
- **Open 1**: `HINTS['config-mismatch']` equals 10 §4's row byte for byte: `<flag> differs from
  devai.json <field>; omit it or pass the recorded value`.
- **Open 3**: `--runtime` names its field `runtime.mode` (the `devai.json` path); `--lgpd` can mismatch
  only when given (a boolean flag cannot say "off").
- **Open 4**: `--locales` compares the comma list, each tag trimmed, in order, against `devai.json`
  `locales`.
Options: (a) ratify as recorded; (b) ratify except named rows. Recommended: (a). Chosen: (a). Where a
reading changes framework text it is applied: 08 A.1 (Arguments: the field names, `--lgpd`, the
`--locales` comparison). Open 1 changes no law text (10 §4 already reads so). devai-v3#76 Open 2 is
ruled by D-120. No code change: W11 already behaves as ratified. Source: Owner (panels, 2026-10-25;
packet `PACKET-2026-10-24-R6-CLOSE.md` Part G, Owner's workspace).

## Open
- D-026 is provisional until the first DETRAN module is built with `kind:` packets.
- D-047 is provisional until the edit-loop p95 is measured on STYNX and DETRAN in both runtimes.
- Mutation testing's home (D-004: outside the cycle or not at all) — not blocking v3.0.
- 02 §3 step 3 `EXPLAIN` cardinality heuristic: finding or struck (D-058) — not blocking v3.0.
- STYNX local RC runs PostgreSQL 18 while STYNX CI and v3 pin 16 (D-069) — STYNX item, not blocking 3.0.0.
- D-120's trailer value `CMP-DEMO-001` is a campaign id, while 02 §5 gives agent commits the trailer
  `Packet: PKT-<PRODUCT>-nnn` (D-050) and 05 §2 calls the trailer the packet `id`. The code's trailer
  readers take any value (PL-12 builds a set, `packages/cli/src/packet/rules.ts:405`; `init` tests
  presence, `packages/cli/src/commands/init.ts:244`), but whether 02 §5/05 §2 widen the trailer's form
  for `init`'s commit, or readers that expect a packet id must skip it, is not ruled.
