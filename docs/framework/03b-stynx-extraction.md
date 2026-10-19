# 03b — What STYNX teaches v3 (extraction from the coding-standards report)

Source: `assessment/stynx-coding-standards-report.md`, produced 2026-10-17 by a Claude Code
(Opus 5.5) session in STYNX worktree `repo-coding-standards-audit-ee14b7` at commit `bfe12d67`.
Verification: nine load-bearing claims re-checked against STYNX `main` @ `63e5f788` by the
orchestrator; all nine hold (details at the end). One drift: `law/invariants/` has 17 files, the
report says 15. The report is reliable enough to build on.

## 1. The report's own method is the method v3 needs

The report separates **Enforced / Documented / Observed** and lists where they disagree. That
three-way split is exactly the error signal the v3 harness should compute for any repository:

- Enforced − Documented = rules the docs don't tell the agent about (agent learns by failing).
- Documented − Enforced = rules the agent is told but nothing checks (agent may ignore; §12 gap 1).
- Observed − (Enforced ∪ Documented) = conventions that exist only as pattern (agent must infer).

**[opinion]** v3 should be able to emit this table for a repo on demand (`devai standards`), and
the scaffolder should emit code that lands in the Enforced ∩ Documented ∩ Observed cell.

## 2. Mechanisms worth carrying into v3 as-is

These exist in STYNX, work, and are stack-specific enough that v3 should adopt rather than redesign.

| Mechanism | Where | Why it matters for v3 |
|---|---|---|
| Shared ESLint factory with five profiles (`nest`, `angular`, `lib`, `scripts`, `test`); packages extend exactly one | `tools/eslint-config/` | The rail: a generated package picks a profile and inherits every standard |
| tsconfig chain `base → node24 → lib`, `base → angular18` | `tools/tsconfig/` | Same; rename `angular18` |
| Migration linter on libpg_query with annotation comments (`-- @destructive: approved-by=`, `-- @softdelete_fk:`) | `tools/migration-linter/` | Human intent expressed *in the artifact*, checked mechanically. This is the pattern for every "pilot approval" v3 needs: an annotation in the file, not a receipt in a ledger |
| Route decorators as declared decisions: `@Idempotent()` / `@NoIdempotent()`, role binding, error contract, use-case claim, SLO | lint rule + INV-RBAC-001, INV-ERROR-001, INV-COVERAGE-001, INV-PERF-001 | Every write route carries its contract in code; coverage check closes the loop. **This is "code <== spec" realized at route granularity** |
| `Database.tx()` sets transaction-local GUCs then **re-reads and verifies them** | `packages/data/src/database.ts` | Self-checking actuator; the pattern for S-02 |
| Test helpers `expectRLSIsolated`, `expectROCannotWrite`, `withTenant`, `withActor` | `@stynx-nyx/testing` | Standards as reusable assertions; the scaffolder should emit tests that call them |
| Generated artifacts committed and byte-verified; `:write` / `--check` pairs | SDK, catalogs, OpenAPI, baselines, READMEs | Deterministic regeneration as a gate; cheap, exact, no model involved |
| Test lint CW-1 (no existence-only assertions) | `tools/eslint-config/test.mjs` | Mutation-resistance as a lint, not a mutation run (D-004) |
| CLI blueprint generator with INV-CLI-002/003/004 (deterministic; tenant-scoped SQL, FORCE RLS, permission guards baked in) | `packages/cli/src/generate-module.ts` | **This is v3's scaffolder, already half-built.** It is the thing to grow, not replace |
| Three DB roles (`stynx_owner` BYPASSRLS / `stynx_app` / `stynx_reader`) | DDL | Rail for S-02 |
| Postgres as the only async infrastructure (`FOR UPDATE SKIP LOCKED` queues) | outbox, jobs, notifications | A standard not in Antonio's list; candidate S-14 |

## 3. Gaps the report found that are v3 requirements, not STYNX bugs

Each of these is a case where STYNX's *mechanism* is right and its *coverage* is incomplete.
v3's check DAG should make the coverage complete.

| Report gap | v3 requirement |
|---|---|
| §12.1 Documented `ValidationPipe`, none wired; zod `parseDto()` used instead; some controllers take unvalidated bodies | Check: every controller method with a body parameter validates it (zod or pipe). Rail: scaffolder emits `parseDto` |
| §12.5 Layer direction declared, `default: 'allow'` | Check: flip to `deny` with explicit allow list; v3 config does this on day one |
| §12.6 Idempotent-route rule at `warn`; `--max-warnings=0` only in lint-staged | Check: `pnpm lint` runs with `--max-warnings=0`; or promote the rule to `error` |
| §12.7 a11y gate writes `status: 'passed'` unconditionally | Check: a gate that cannot fail is not a gate; v3 forbids hard-coded verdicts (Article 39/41 spirit, now as a lint on test code: no literal `status: 'passed'`) |
| §12.9 Demo module does not load the Angular lint config; uses `*ngIf`, wrong selector prefix | **Rail defect**: the scaffolder's exemplar violates the standards. v3 rule: the scaffolder's output must pass the full check DAG before the scaffolder ships |
| §12.3 Two GUC dialects for tenant context | Check: one declared GUC namespace; migration linter rule that policies reference it |
| §12.4 Duplicate migration prefixes | Check: migration linter rule (LINT010) |
| §12.2 Two incompatible `StynxError` classes | Check: public-API baseline already exists (`verify-public-api-baselines`, 08 B.16); no uniqueness node in v3.0 (D-055, 11); STYNX reconciles the two classes when a consumed error contract needs one |
| `no-explicit-any: off` while conventions say "avoid any" | Check: on (S-33) |

## 4. Things in STYNX that v3 should **not** inherit

**[opinion]** These came from DEVAI v2 and are the ceremony the author wants out:

- Role-based path authority (Owner/Architect/Inspector/Engineer/Auditor) and "pick your role first"
  as step 1 of the contributor quick-reference (§13.1). Under D-003/D-006 the pilot is one person
  with one identity.
- Per-commit Owner receipts in `law/policy/forbidden-action-authorizations.json` for forbidden
  actions. Replace with: a pre-push hook that refuses, and an annotation-in-artifact for the rare
  documented exception (the migration linter's `-- @destructive: approved-by=` is the model).
- `law/trace.json` rebinding on every test edit ("Editing a test moves `law/trace.json` and
  requires an Architect rebind", §9). Invariant IDs as optional test tags are fine; the trace as a
  gate is not.
- Hash-chained evidence under `record/` and `.devai/state` (D-002: no external consumer).
- "The constitution AST-diffs every commit and fails assertion decreases above 20%" — keep the
  *idea* (test-weakening detection), but v2's sensor was shown to miss skip-only weakening and to
  PASS on zero files. v3 builds this check correctly or not at all.

## 5. Standards the report surfaces that are not in Antonio's list (candidates)

| Candidate | Evidence in STYNX | Suggested tag |
|---|---|---|
| S-14 Postgres is the only async infrastructure (outbox/jobs/notifications via SKIP LOCKED; no SQS/BullMQ) | §1 theme 4 | rail |
| S-15 LGPD: every PII column declares legal basis and retention (INV-PRIVACY-001); archive-not-delete (ADR-001) | §7, §8 | both |
| S-16 pt-BR mandatory locale; ICU messages; i18n keys in `en` and `pt-BR` | §3, §13.9 | both |
| S-25 Every write route declares idempotency, role, error contract, use-case claim and SLO | §7 contract-first HTTP | both |
| S-36 No `enum`; string-literal unions / `as const`; named exports only; `interface` over `type`; `Stynx` prefix; kebab-case files with role suffix | §6, all Observed | check (naming lint) |
| S-45 Generated artifacts are committed and byte-verified; never hand-edited | §5 | check |
| S-61 100% coverage default (lines/branches/functions/statements); relaxed per package by declaration | `tools/repo-config/test-policy.json` | check |
| S-62 Tests live in `test/`, not colocated; taxonomy unit / wiring / integration / db / e2e per ADR-TEST-TAXONOMY | §9 | both |
| S-70 Request ID is UUIDv7, required on every request; tenant resolved from Host vs token claim with mismatch rejection | §7 | both |
| S-71 Observability: pino with redaction + Prometheus; no OpenTelemetry (gap 14, decision pending) | §3, §12.14 | rail |

Antonio to confirm, reject or amend each before they enter `03-standards.md` Part A.

## 6. Verification record

Checked 2026-10-17 against STYNX `main` @ `63e5f788` (worktree is identical to main):

| Claim | Command | Result |
|---|---|---|
| No `ValidationPipe` anywhere | `git grep -l ValidationPipe -- packages packages-web reference domain` | 0 files |
| Two `StynxError` classes | `git grep -n 'class StynxError' -- packages` | `contracts/src/errors.ts:1`, `core/src/errors.ts:9` |
| Idempotent rule at `warn`; `--max-warnings=0` only in lint-staged | grep `index.mjs:345`, `package.json:124` | confirmed |
| Boundaries `default: 'allow'` | `index.mjs:298` | confirmed |
| `no-explicit-any: off` | `index.mjs:308` | confirmed |
| Duplicate migration prefixes | `ls … \| cut -d_ -f1 \| uniq -d` | `0012`, `0018` |
| a11y `status: 'passed'` hard-coded | `a11y.ts:62` | confirmed |
| 0 default exports, 0 enums in `src` | `git grep -c` | 0 / 0 |
| `FORCE ROW LEVEL SECURITY` sites | `git grep -c` in migrations | 43 |
| Invariant count | `ls law/invariants \| wc -l` | 17 (report: 15) |
