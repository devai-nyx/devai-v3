<!-- Consolidated 2026-10-18 from agents/consolidate-4 (Fable base per Owner choice D-058; Astra cross-check-4 corrections imported item by item). 28 node contracts in 02 §2 order; 54 reason codes, closed enum. -->
<!-- Final · consolidation 4 · Claude Fable 5.1 · 2026-10-18 · base: round-4 Fable draft (D-058 choice 3); Astra's cross-review applied item by item; binding inputs D-001–D-058, 01–07 as amended today. Reference trees read-only: stynx: = /Volumes/Development/projects/stech/stynx @ 63e5f788, devai: = /Volumes/Development/projects/stech/devai @ 4289ff51, P: = stynx:node_modules/.pnpm/; P:<pkg>@3.0.0/<path> = <path> inside the published @stynx-nyx 3.0.0 tarball of <pkg> (D-089). -->
# 08 — CLI and check-node contracts

Consolidated · Claude Fable 5.1 · 2026-10-18. Tags: `[fact]` observed in a cited source, `[inference]` a consequence, `[opinion]` a contract choice made here. Node names are exactly the twenty-eight of 02 §2; command names are the ones 02, 05 and 06 use, plus `devai packet lint` from the round-4 brief. Nothing in this document is a decision; where a contract needed something the foundation does not provide, the contract says `UNKNOWN` and `NOTES.md` carries the item for the owning document (D-055). The names D-058 ruled on today (`--hook`, `check.editLoopCeilingMs`, `devai init`, the sensor evidence file) are used as decided.

## 0. How to read this document

[opinion] Part A is the command surface: one block per command, the three hook scripts byte for byte, and the `devai.json` definition in zod (D-056). Part B is one block per node, in 02 §2 order, each with the same nine rows. Part C is what the runner does with the blocks: order, parallelism, the one report shape, the summary grammar, the cache and the candidate digest. Part D says what is not built. Parts A–C are contracts; the prose around them explains the few places where a choice had to be made and why the choice is the smaller one.

[opinion] Five conventions hold everywhere and are not repeated per block. First, every status comes from the same four words (`PASS`, `FAIL`, `UNKNOWN`, `SKIPPED`) with 02 §8's meanings, and the runner, not the node, rewrites a success with `observed = 0` to `UNKNOWN: no-observations` (S-65). Second, every node reconciles its counts against a known population before pronouncing: with a complete inventory and a known `expected`, `observed < expected` is `FAIL` naming the missing units (02 §2 rule b), and a tool's exit 0 with plausible counts is never itself `PASS`; `PASS` needs `evaluated = observed = expected` and no finding. Third, `SKIPPED` is pronounced only by `inventory`, from a population predicate written in each block as the exact evidence string; a node whose runtime finds nothing to do but whose population was non-empty is `UNKNOWN`, never `SKIPPED` (D-044, D-054); a node that is not planned for the invocation is *deferred*, listed by `accept` without a status (D-058). Fourth, every tool is spawned as an argument vector with `shell: false`, an explicit `cwd`, a bounded output buffer and a bounded wall time (07 §3); a missing binary is `UNKNOWN: tooling-missing` with the install command printed on the finding line (D-029, S-19). The argv lines below are recipes in that sense: placeholders in angle brackets are values, never shell substitutions. Fifth, exit codes are never trusted alone (D-086): before invoking a tool the adapter pre-flights the inputs DEVAI controls (a config file DEVAI owns exists and parses, a message file is readable, the `cwd` is inside a git repository) and, when one fails, reports the block's reason without invoking; verdicts and findings come from parsed stdout only; a non-zero exit without the expected machine-readable stdout is `UNKNOWN: runner-crashed`, with stderr's first line as the finding message.

[inference] The brake bites hardest on the command surface. v2 exposed 69 actions and a `check` facade with `--only`, `--strict` and `--since-ref` [fact: `devai:packages/cli/src/commands/check/facade.ts:166,175-176`] and a separate `--format json|human` on a second entry point [fact: `devai:packages/cli/src/commands/check/schemas.ts:221`]. v3 has five commands (`init`, `new module`, `check`, `packet new|lint|rebase`, `packets status`; seven invocations, Part A) and one flag family. Two names the foundation required but did not spell were settled today: `devai check --hook pre-commit|pre-push|commit-msg` is the binding of 02 §2's hook subsets, not a command, with the scripts under `scripts/hooks/` (already `protected:ci`), and `check.editLoopCeilingMs` is the key D-047 writes to (D-058). `devai init` is the template command (02 §1 amended). `devai packet rebase` is named by 05 §4 and PL-05. `devai doctor` is not built: 02 §1 makes preflight a phase of `devai check` ("tooling preflight", 02:21), D-029 makes its result a per-node `UNKNOWN: tooling-missing`, and 07 §4 adds shell, psql and docker to the same phase; `devai check --only <node>` prints one node's preflight.

## Part A — commands

[opinion] Every command reads `devai.json` first and validates it with the definition in A.8; an invalid file is exit 2 `config-invalid` before anything else runs, for every command except `devai init` in a directory where the file does not yet exist. Every command resolves the runtime once (02 §6 `resolveRuntime()`), honouring `DEVAI_RUNTIME=bare|docker`; any other value is exit 2 `config-invalid`. Output is plain text on stdout and, with `--format json`, one JSON document on stdout (07 §3); diagnostics about the command itself go to stderr. Exit codes are 02 §8's three everywhere (D-058): `0` the command did what it says and no gating node is `FAIL` or `UNKNOWN`, `1` a demonstrated violation, `2` could not run or could not observe, with a `reason` code in the JSON output. `accepted: true` appears only on `devai check --packet <p> --full` exit 0; every other exit 0 carries `accepted: false`. `devai check` runs at the repository root only; run in a subdirectory, even one holding a `devai.json`, it is exit 2 `not-a-repository` (D-084). A command-level refusal before acquisition prints, under `--format json`, the envelope `{ accepted, exitCode, reason, message }`; a `Report` (C.2) exists only once `inventory` ran, so C.2's `nodes` may be empty only for a `reason` run after acquisition (D-084).

### A.1 `devai init`

| Field | Contract |
|---|---|
| Synopsis | `devai init [--product <slug>] [--locales <tag,…>] [--lgpd] [--runtime bare\|docker] [--dir <path>] [--format text\|json]` |
| Arguments | `--product` slug `^[a-z][a-z0-9]*$`, required when no `devai.json` exists (materialise mode), rejected when one exists (attach mode); on a re-run it may be omitted and otherwise must equal `devai.json` `productPrefix`, else exit 2 `config-mismatch` (D-113), and so must `--locales`, `--lgpd` and `--runtime` equal `locales`, `lgpd` and `runtime.mode` (D-116): `--locales` compares the comma list, each tag trimmed, in order, with `locales`; `--lgpd` can mismatch only when given; the message names the field as `productPrefix`, `locales`, `lgpd` or `runtime.mode` (D-121); `--locales` default `en-US`, must start with `en-US` (D-014); `--lgpd` default off (D-014); `--runtime` default `bare`; `--dir` default `.` and must be empty or absent in materialise mode, not on a re-run (D-113) |
| Modes | **materialise**: no `devai.json` in `--dir` → emit the 09 template (04 §1–§6, 02 §1 row 1: `devai.json`, `compose.yaml`, `database/README.md`, `AGENTS.md`, `decisions.md`, `specs/`, `packets/`, `product/` fixture, `scripts/hooks/`, Action), `git init` if needed, run `pnpm add -D --save-exact @devai-nyx/cli@<its own version>` in `--dir` (installs the workspace and completes `pnpm-lock.yaml`; the template manifest ships without `@devai-nyx/cli`, D-097), commit `chore(template): devai init <product>` with trailer `Packet: PKT-DEMO-001` (05 §7: the fixture's spec packet is complete in that commit), render the four `CMP-DEMO-001` packets with `base` = the template commit and commit `chore(packets): seed CMP-DEMO-001` with trailer `Packet: CMP-DEMO-001` (D-120); both commits run with the hooks live, never `--no-verify` (D-097). The campaign rebases PKT-DEMO-002/003/004 before their runs (09 §4 steps 3, 5, 7; D-095). **attach**: `devai.json` exists and `HEAD` has both `init` commits, recognised by their trailers reachable from `HEAD` (the template commit, `Packet: PKT-DEMO-001`, and the packets commit, `Packet: CMP-DEMO-001`; D-120) → no files written except the hook scripts (D-115); a repository with `devai.json` whose `HEAD` is unborn or lacks either `init` commit is a first run, not attach (D-112, D-115): a **re-run**, which keeps the files on disk and skips materialise's writes, accepts the existing `devai.json` and template, re-runs the `pnpm add` above and makes whichever `init` commit is missing; nothing is rewritten (D-113, D-115). A `Packet:` commit is any commit reachable from `HEAD` with a `Packet:` trailer (D-118) |
| Reads | `devai.json` (attach, re-run), host `git`, `node --version`, `pnpm --version`, `corepack --version`; the package registry `.npmrc` names (materialise: the `pnpm add` above, D-097) |
| Writes (02 §1/§7 product files; 02 §11 lists runtime state only, D-058) | Template files, `node_modules/`, the completed `pnpm-lock.yaml` and the `@devai-nyx/cli` entry in the root `package.json` (both inside the template commit) and two commits (materialise, D-097); `git config core.hooksPath scripts/hooks` (D-057, D-058), `git config user.name <product>-agent`, `git config user.email agent@<product>.local` (02 §5) — in the current worktree's config, both modes; nothing under `.devai/cache/` |
| Preflight (last step; after the install and the two commits in materialise mode, D-097) | Resolves every binary and library Part B names for every node whose population could be non-empty on this template; prints one line per missing item `UNKNOWN: tooling-missing — <node>: install with <command>`; shell/psql/docker per 07 §4 |
| Exit | `0` written and every tool resolved; `2` written but ≥ 1 tool missing (`tooling-missing`), or the materialise install failed (`tooling-missing`, remedy `pnpm add -D --save-exact @devai-nyx/cli@<its own version>`, no commit made; D-097), or a materialise commit refused by the hooks (`setup-failed`, one line `git commit "<subject>" refused by the hooks: <FAIL/UNKNOWN lines>; fix the findings, then run devai init again`; D-107, D-117), or `--dir` not empty (`dir-not-empty`), or `--product` missing in materialise mode (`usage`), or, on a re-run, `--product`, `--locales`, `--lgpd` or `--runtime` ≠ its `devai.json` value (`config-mismatch`, nothing run; D-113, D-116); never `1`. After a failed install or a refused commit `HEAD` lacks an `init` commit, so `devai init` again is the re-run and makes the missing commit, not attach mode (D-107 as narrowed by D-112, D-113, D-115) |
| Output | text: one line per file class written, the three `git config` lines, the preflight lines, and one host line the pilot runs once (`protection: require the devai job`; no ruleset, D-091; docs/adopters/ci.md has the command); json: `{ mode, product, written: string[], gitConfig: {…}, preflight: [{ node, binary, status, remedy? }], accepted: false, exitCode, reason? }` |
| Failure → reason | `config-invalid` (attach mode, bad file), `not-a-repository` (attach mode outside git), `tooling-missing`, `setup-failed` (a hook refused a materialise commit, D-107), `dir-not-empty`, `config-mismatch` (re-run argument ≠ its `devai.json` value, D-113, D-116), `usage` |

### A.2 `devai new module`

| Field | Contract |
|---|---|
| Synopsis | `devai new module --spec <path> [--web] [--out <dir>] [--regenerate] [--format text\|json]` (02 §7) |
| Arguments | `--spec` repo path of an approved spec (06 §6); `--web` adds `web/**` (04 §2); `--out` default `domain/<module.slug>`; `--regenerate` rewrites `mode: generated` TypeScript files of an existing module from the same spec id |
| Reads | The spec's machine block (06 §2) through the same zod parse `spec-lint` uses; `devai.json` `locales`, `lgpd`, `productPrefix`; `generation-manifest.json` (regenerate); `git show <merge-base>:<db path>` to detect base-present SQL (02 §7) |
| Writes (02 §7) | `domain/<slug>/**` exactly 04 §2 with `@generated` headers in the language's comment syntax, `generation-manifest.json` (02 §7 shape, no timestamp), one entry in `database/seed/` manifest (D-023). Nothing else; no commit |
| Refuses | Spec `status` ≠ `approved`, `approved-by` null, `## Open questions` non-empty, machine block invalid (06 §5) → exit 2 `spec-not-approved` / `spec-invalid` with the SL locator; `--out` exists without `--regenerate` → exit 2 `output-exists`; `--regenerate` on a module whose manifest `specId` ≠ the spec's id and ≠ the spec's `supersedes.id` (D-053) → exit 2 `spec-mismatch` (refusals to run, D-074); a successor is admitted only inside a `generate` packet and rewrites the generated non-SQL files and the manifest (09 §3) |
| Regenerate | Admitted in a `generate` packet and, same-id only, in a `standards` upgrade packet (05 §3, D-074). Rewrites the manifest's `generatorVersion` to the installed version. For each manifest entry: `generated` → rewritten; `seed` → compared with the manifest's initial digest and printed as `seed unchanged, safe to overwrite` or `seed edited, left alone`, never written; `db/*.sql` present at the merge base → never rewritten (D-033, LINT013) |
| Exit | `0` written; `2` `output-exists`, `spec-mismatch`, `spec-not-approved`, `spec-invalid`, `config-invalid`; never `1` (D-074) |
| Output | text: one line per file `<mode> <path>`; json: `{ specId, specSha256, machineBlockSha256, out, files: [{ path, mode, sha256, action: written\|unchanged\|left-alone }], accepted: false, exitCode, reason? }` |
| What `generated` later verifies | Every `mode: generated` entry byte-equals a fresh render from the generator version named in the manifest over the recorded inputs (the spec bytes whose sha256 is `specSha256`, the recorded `options`); file set equality for generated entries; seeds excluded (S-45, B.16). The replay adapter and the generator's own contract are 09's |

### A.3 `devai check`

| Field | Contract |
|---|---|
| Synopsis | `devai check [--packet <path>] [--full] [--only <node>]… [--hook pre-commit\|pre-push\|commit-msg <msgfile>] [--expect-red] [--summary] [--format text\|json] [--prune]` |
| Subset selection | no flags: edit-loop subset of 02 §2 (`format lint lint-tests typecheck layout sql-lint spec-lint route-contract sql-typed` static, `unit test-integrity i18n`), plus `sql-typed` DB when `provide('postgres')` succeeds without starting anything; `--packet` adds `packet-scope` and `spec-tests` over the packet's derived acceptance file, with their prerequisite closure (`db-apply`, `sql-typed` DB); `--packet --full` runs every applicable node incl. `permissions-pattern`, `review`, `accept` over `base..candidate` (02 §8); `--full` alone is feedback over every applicable node except the packet-bound ones (`packet-scope`, `spec-tests`, `review` deferred), `accepted: false`; `--only <node>` (repeatable) runs the named nodes and their prerequisites, feedback only; `--only` naming a packet-bound node (`review`, `permissions-pattern`, `packet-scope`, `spec-tests`) without `--packet` is exit 2 `usage`: `<node> needs --packet` (D-084); `--hook` selects the 02 §2 hook subsets (A.7). Every selection includes `inventory` and `accept`. Without a packet, the edit-loop base is the working tree against `HEAD` plus untracked files: "changed" in every population predicate means that set (D-084) |
| `--expect-red` | Accepted only with `--packet` whose `kind: test` and whose `observations.unimplemented` is non-empty (PL-11, D-051); it restates what the packet already selects and must agree; given otherwise → exit 2 `expect-red-nothing-named` |
| `--summary` | Requires `--packet`; after a `--full` run prints the Part C summary; without `--full` prints the summary of the latest report in `.devai/cache/reports/` whose `candidateDigest` equals the current candidate's, else `no acceptance report for head <sha>; run --full` (exit 2 `no-report`) |
| `--prune` | Keeps the newest 200 entries per node under `.devai/cache/`, drops the scratch databases named in `.devai/cache/scratch/*.json` descriptors (only those; never a database without a descriptor), deletes the descriptors; also prunes `.devai/cache/agentic/<node>/` and deletes `results/` files no `nodes/` entry names; prints `pruned <n> cache entries` (`--format json`: `{ pruned, accepted: false, exitCode: 0 }`); exits 0; combines with nothing else (D-084) |
| Reads | `devai.json`, the packet (05 §2), the pinned spec via `git show <base>:<path>`, the candidate (tracked + untracked; the index under `--hook pre-commit`), `.devai/cache/**`, `.devai/review/**`, host tools per Part B |
| Writes (02 §11) | `.devai/cache/{nodes,results}/` (PASS only), `.devai/cache/reports/<candidateDigest>.json` (every `--full` run and every `--format json` run), `.devai/cache/agentic/<node>/<digest>.json`, `.devai/cache/scratch/` (worktree and index copies, scratch-DB descriptors), `.devai/review/<packet-id>.json` (by `review`) and `.devai/review/<packet-id>.permissions.json` (by `permissions-pattern`, D-058), both `--packet --full` only. Never the packet, the spec, the candidate |
| Exit | `0` no gating node `FAIL` or `UNKNOWN` (under `--packet --full` this includes `accept` `PASS` and sets `accepted: true`); `1` ≥ 1 gating `FAIL`; `2` ≥ 1 gating `UNKNOWN` and no `FAIL`, or could not run (`reason`); `FAIL` + `UNKNOWN` → `1` with both preserved (02 §8). Gating = every planned node except `review` while `review.mustRun` is false and the candidate touches no undeclared protected class (D-028, D-058) |
| Output | `--format text` (default): the 02 §8 report, failing nodes first, ≤ 40 lines, grammar in C.3; `--format json`: the C.2 `report.json` on stdout |
| Failure → reason | `config-invalid`, `not-a-repository` (incl. a subdirectory of the repository), `packet-invalid`, `base-not-ancestor`, `expect-red-nothing-named`, `no-report`, `usage` (`--only` on a packet-bound node without `--packet`), `candidate-changed` (digest differs before/after the run, result discarded: C.1 step 10), `io` (candidate unreadable while framing), `tooling-missing` (only when `inventory` itself cannot run) |

### A.4 `devai packet new` · `devai packet lint` · `devai packet rebase`

| Field | Contract |
|---|---|
| Synopsis | `devai packet new --kind <spec\|generate\|test\|code\|fix\|standards> [--spec <path>] [--campaign <CMP-id>] [--format text\|json]` · `devai packet lint <path> [--format text\|json]` · `devai packet rebase <path> --to <commit> [--format text\|json]` (05 §2, §4, §5; brief Part A) |
| `new` renders | `id` = next `PKT-<PRODUCT>-nnn` over the global id population (`packets/**` at HEAD plus untracked; D-050; `PRODUCT` = uppercase `productPrefix`; 999 exhausted → exit 2 `usage`), `base` = `HEAD`, `protected: []`, `## Intent` and `## Deliverables` as empty headings, `title` as the PL-01-visible placeholder `<title>`; file written to `packets/<CMP>/<id>.md`; `--campaign` default = the single campaign folder when exactly one exists, else required (`usage`). Per kind: **`generate`/`test`/`code`/`fix`** (pinning kinds): `--spec` required, `spec.{id,path}` from the file, `spec.sha256` = sha256 of `git show HEAD:<path>`; `observations.unimplemented` = the spec's `unimplemented[]` requirement ids for `test`, else `[]`. **`spec`**: `--spec` required and is the *output* path (05 §2), need not exist, `spec.id` = its `SPEC-*` stem, no `sha256`, no approval check. **`standards`**: `--spec` rejected (PL-03; `usage`), no `spec` block |
| `new` default globs | gitignore globs, brace-free (07 §3 `ignore` has no brace expansion), always plus the packet's own path: `code`/`fix`: `domain/<slug>/api/src/**`, `domain/<slug>/web/src/**`, `domain/<slug>/api/test/*.spec.ts`, `domain/<slug>/db/**`, `database/seed/modules.txt` (D-074); `test`: `domain/<slug>/api/test/acceptance/**`; `generate`: `domain/<slug>/**`, `database/seed/**`, `apps/api/package.json`, `apps/api/src/app.module.ts`, `apps/api/tsconfig.json`, `apps/web/package.json`, `apps/web/src/app/app.routes.ts`, `apps/web/tsconfig.json`, `.stynxrc.json`, `pnpm-lock.yaml`, `docs/framework/contracts/**` (D-093, D-095); `spec`: `specs/<area>-<capability>/**`; `standards`: the 05 §3 row (`tools/**`, `devai.json`, `eslint.config.*`, `tsconfig*.json`, `.stynxrc.json`, `.agents/**`, `.claude/skills/**`, `AGENTS.md`, `.github/**`, `scripts/**`, and for an upgrade `package.json`, `pnpm-lock.yaml`, `apps/*/package.json`, `domain/**` within PL-07's limit; D-074) |
| `new` refuses | Pinning kinds: spec at HEAD not `approved`, or carrying `superseded-by` (PL-04, D-053) → exit 2 `spec-not-approved` / `spec-superseded`; machine block invalid → `spec-invalid`; `HEAD` has no commit → exit 2 `not-a-repository` |
| `lint` evaluates | Every 05 §5 rule that needs no DAG run, over HEAD and the working tree: PL-01, PL-02, PL-03, PL-04, PL-05, PL-06, PL-07, PL-09, PL-11, PL-13, PL-14, PL-17 (the `packet-scope` rules) and PL-08 as a notice; PL-10 (needs `review`) and PL-12/PL-15/PL-16 (`accept`, `--full`) are printed as `deferred`; messages verbatim from 05 §5; never prints "accepted" |
| `rebase` | Rewrites `base` to `--to` iff `--to` descends from the current `base` and, for pinning kinds, `sha256(git show <to>:<spec.path>)` = `spec.sha256` (PL-05, 05 §4); otherwise exit 1 with PL-05's message; no other byte changes |
| Reads | `devai.json`, `packets/**`, the spec blob, `git rev-parse`, `git merge-base --is-ancestor`, `git log --diff-filter=A` (introducing commit, PL-13), `.devai/review/<id>.json` history (PL-09) |
| Writes | The packet file only; no commit (the pilot commits, 05 §4) |
| Exit | `new`: `0`/`2`; `lint`: `0` clean, `2` `packet-invalid`/`base-not-ancestor` (PL-01–03, 06, 14, pin absent, base not ancestor), `1` any other violated rule; `rebase`: `0`/`1`/`2` |
| Output | text: the rendered path, or PL lines; json: `{ path, id?, rules: [{ id, status: pass\|fail\|deferred, message? }], accepted: false, exitCode, reason? }` |

### A.5 `devai packets status`

| Field | Contract |
|---|---|
| Synopsis | `devai packets status [--campaign <CMP-id>] [--format text\|json]` |
| Derivation (05 §4, 02 §11) | For each `packets/**/PKT-*.md` at HEAD (plus untracked ones): `drafted` (untracked); `frozen` (in a commit, `devai packet lint` clean); `candidate` (≥ 1 commit in `git log --all --grep '^Packet: <id>$'` descending from `base`, not reachable from `main`); `merged` (a commit reachable from `main` carries the trailer); `superseded` (another packet at HEAD carries `supersedes: <id>`, PL-16). `accepted` is printed only when **both** pieces of 05 §4's evidence exist: a committed `.devai/review/<id>.json` whose `candidateDigest` equals the digest recomputed from the tree of a commit carrying the trailer (C.6; a review-only commit keeps that digest, Astra N-13), **and** a report in `.devai/cache/reports/<candidateDigest>.json` with `accepted: true`. Review evidence alone prints `candidate (review bound to <sha>, no accepted report)`; a pruned report prints the same. The highest state whose evidence exists is printed with its evidence |
| Reads | `git log`, `git ls-files`, `git ls-tree`, packets, `.devai/review/*.json`, `.devai/cache/reports/` (read-only, evidence only) |
| Writes | Nothing |
| Exit | `0`; `2` `not-a-repository` / `config-invalid` |
| Output | text: one line per packet `<id>  <kind>  <state>  <evidence>` in campaign order; json: `{ campaigns: [{ id, packets: [{ id, kind, state, evidence, after: string[], supersedes? }] }], accepted: false, exitCode }` |

### A.6 `devai doctor`

Not built. [fact] 02 §1 lists "tooling preflight" as part of the `devai check` component (02:21); D-029 defines the preflight result as `UNKNOWN: tooling missing` for the dependent node; 07 §4 (07:73) adds shell/psql/docker to the same preflight; none of them names a command. [opinion] The preflight is therefore the first phase of every `devai check` and the last of `devai init`, reported per node, and `devai check --only <node>` is the way to ask for one node's preflight.

### A.7 Hook scripts

[opinion] `devai init` writes three files under `scripts/hooks/` (tracked, `protected:ci` by 02 §5's `scripts/**`) and points `core.hooksPath` at the folder (D-057, D-058, no husky). Each hook is one line after the shebang. The pre-push hook receives the ref lines on stdin as git defines them; `devai check --hook pre-push` reads them to find the fetched base (02 §5); a touched-class notice never sets the exit code, an unreadable base does (D-099).

```sh
#!/bin/sh
exec pnpm exec devai check --hook pre-commit
```

```sh
#!/bin/sh
exec pnpm exec devai check --hook pre-push "$@"
```

```sh
#!/bin/sh
exec pnpm exec devai check --hook commit-msg "$1"
```

Hook stages select these subsets (02 §2, D-058): `pre-commit` → `format lint lint-tests sql-lint` over the **staged snapshot**: the change set is `git diff --cached --name-status --no-renames --diff-filter=ACMRD -z`, the bytes and modes are the index's (`git ls-files --stage -z`, `git cat-file --batch`), materialised once per run with `git checkout-index -a -f --prefix=.devai/cache/scratch/staged-<digest>/` plus symlinked `node_modules` so typed lint sees the whole project as staged; tools run with that copy as `cwd`, locators are rewritten repo-relative, and the candidate digest is the index snapshot (C.6). Under `pre-commit` and `commit-msg` an unborn `HEAD` (the repository's first commit, as in materialise `init`, D-097) is read as git's empty tree, and the report's `head` is the empty tree's id, not a commit; every other mode refuses `HEAD has no commit` (`not-a-repository`; D-107). A partially staged file is checked as staged, not as on disk (unlike STYNX's lint-staged [fact: `stynx:.husky/pre-commit:1`, `stynx:package.json:122-129`]). `pre-push` → the pre-commit set plus `generated boundary deadcode openapi actionlint`, `db-apply`, `sql-typed` DB and `integration` when `database/**`, `domain/*/db/**` or `*.repository.ts` changed since the fetched base, and the `protected-paths` notice lines; the fetched base per stdin line `<local ref> <local sha> <remote ref> <remote sha>` is `<remote sha>` when non-zero and an ancestor of `<local sha>`, else `git merge-base <local sha> refs/remotes/origin/HEAD`; unresolvable → `protected-paths` `UNKNOWN: base-unreadable`, gating like any `UNKNOWN` (exit 2, C.2; the push is refused until the base is fetched, D-099), while the other nodes run over the resolved range or, failing that, the working tree. The pre-push subset does not invoke `review`: D-037's "pre-push" is the agent's `--packet --full` run before pushing, not the hook. `commit-msg` → `commitlint` over the message file. [fact] v2's hooks delegated to `pnpm run precommit` and a hygiene script (`devai:.githooks/pre-commit:1-3`, `commit-msg:1-5`) and made pre-push opt-in by a worktree config key (`pre-push:1-8`); v3 has no opt-in: the hook runs, a touched-class notice is a notice, and an unreadable base is `UNKNOWN` (D-099).

### A.8 `devai.json` — zod definition (D-056)

[opinion] The keys are exactly those 02 §6 shows plus `check.editLoopCeilingMs`, the key D-047 writes the measured ceiling to (D-058; template value 90000, provisional). `devai.schema.json` is emitted by `z.toJSONSchema(DevaiConfig)` [fact: exported at `P:zod@4.4.3/node_modules/zod/v4/classic/external.d.ts:10`] at the DEVAI build and committed; it is not reproduced here. `superRefine`s do not project (D-056). `productPrefix` is the scalar 02 §6 shows; how a repository hosting several apps maps prefixes is 02's (NOTES).

```ts
import { z } from 'zod';

export const Family = z.enum(['claude', 'gpt']);                       // 02 §6 sample keys
export const ProtectedClass = z.enum(['spec', 'product', 'decisions', 'standards', 'infra', 'ci', 'acceptance']); // 02 §5, D-046
const Glob = z.string().min(1).refine((g) => !g.startsWith('/') && !g.includes('..') && !/[{}]/.test(g), 'repo-relative gitignore glob, no braces');
const Locale = z.string().refine((l) => { try { return Intl.getCanonicalLocales(l)[0] === l; } catch { return false; } }, 'canonical BCP 47 tag');

export const DevaiConfig = z.strictObject({
  $schema: z.literal('https://devai.nyx/schema/devai.json/3'),           // D-034
  productPrefix: z.string().regex(/^[a-z][a-z0-9]*$/),                     // D-032
  locales: z.array(Locale).min(1),                                         // D-014; en-US first (refined)
  lgpd: z.boolean(),                                                        // D-014, S-15 opt-in
  runtime: z.strictObject({                                                // 02 §6, D-011, D-034
    mode: z.enum(['bare', 'docker']),
    services: z.strictObject({                                             // the runtime a node's `needs` resolves against
      postgres: z.strictObject({
        bare: z.string().regex(/^env:[A-Z][A-Z0-9_]*$/),                   // env:DATABASE_URL
        docker: z.string().regex(/^compose:[a-z][a-z0-9_-]*$/),            // compose:postgres
      }),
    }),
  }),
  protected: z.record(ProtectedClass, z.array(Glob).min(1)),               // all seven classes, template-filled (02 §5)
  review: z.strictObject({                                                 // 02 §9, D-028, D-037
    mustRun: z.boolean(),
    reviewers: z.partialRecord(Family, z.string().min(1)),                 // worker family → reviewer argv prefix
  }),
  agentic: z.strictObject({                                                // 02 §4
    permissionsPattern: z.strictObject({
      minConfidence: z.number().min(0.7).max(1),                           // 02 §4: PASS needs confidence ≥ 0.7
      maxInputTokens: z.number().int().positive().max(60000),              // 02 §4: 60k bound
    }),
  }),
  check: z.strictObject({
    editLoopCeilingMs: z.number().int().positive(),                        // D-047, D-058; template value 90000, provisional
  }),
}).superRefine((c, ctx) => {
  if (c.locales[0] !== 'en-US') ctx.addIssue({ code: 'custom', path: ['locales', 0], message: 'en-US is the default locale (D-014)' });
  if (new Set(c.locales).size !== c.locales.length) ctx.addIssue({ code: 'custom', path: ['locales'], message: 'duplicate locale' });
  for (const [family, argv] of Object.entries(c.review.reviewers)) {
    const bin = argv.split(/\s+/)[0];
    const binFamily = bin === 'claude' ? 'claude' : bin === 'codex' ? 'gpt' : undefined;
    if (!binFamily) ctx.addIssue({ code: 'custom', path: ['review', 'reviewers', family], message: 'reviewer must start with claude or codex (07 §6)' });
    else if (binFamily === family) ctx.addIssue({ code: 'custom', path: ['review', 'reviewers', family], message: 'reviewer must be the other family (S-66)' });
  }
});
export type DevaiConfig = z.infer<typeof DevaiConfig>;
```

[opinion] `review.reviewers` values are argument-vector prefixes, whitespace-split, never a shell string; the runner appends 07 §6's fixed flag list. A model is chosen inside the prefix (`codex exec --model <m>`) or left to the CLI's default; the model the CLI reports is what `review.json` records. The same selection serves `permissions-pattern` (B.24): the sensor is run by the reviewer command of the candidate's worker family, so no field names a sensor backend (07 §6). When no family resolves (no agent trailer), the sensor alone runs the first configured reviewer in `Family` order, `claude` then `gpt` (D-074); `review` has no such fallback.

## Part B — the 28 node contracts

[opinion] Each block has the same nine rows. **Inputs** is the declared set from which the cache key's `sortedInputDigests` is built (C.4); a path pattern means every matching path's content at the candidate, a `base:` prefix means the blob at the packet's `base`; every byte a predicate reads is an input, so an edit that changes only content a node reads still invalidates it. **Population** is the predicate `inventory` evaluates and the exact evidence string printed after `SKIPPED` when it is empty; the strings for nodes 05 §3 already names are 05's. **Observation** defines one observation and the three counts. **Status** lists only what is specific; the shared rules of §0 apply, including shortfall reconciliation. **Findings** give the locator form, the message form, the standard id in brackets and the one-line hint; both are required on every finding (02 §8, C.2). **Latency/where** is 02 §2's letter and placement. **Needs** is `postgres` or `—`; a model CLI is written as `model`.

[inference] Where 02 §2 names a STYNX script, the block invokes the published `@stynx-nyx/cli` entry point D-057 requires; every such entry point exists at 3.0.0 (D-089), and "`UNKNOWN: tooling-missing` until it exists" now applies only to D-088's write pair and to `list-routes` reading `RequireRoles` (D-087). The TypeScript library (D-057, grown to five consumers by D-058) is `typescript` 6.0.3 imported in-process by `inventory` (mount closure), `route-contract`, `sql-typed` static, `test-integrity` and `permissions-pattern`; it parses, it does not type-check, except in `typecheck`.

[opinion] Two population questions recur and are settled the same way in every block. First, a node selects *what to evaluate* from the change but its population is global (02 §2 rule f): `sql-lint` lints the changed SQL files while LINT010 sees every migration prefix, because one invocation covers every root (D-085), `sql-typed` checks the changed repositories while `name` uniqueness sees every repository, `route-contract` compares the changed controllers while the mounted-route set comes from the app's module closure. The cache key carries both the changed inputs and the population, so an unchanged population with an unchanged selection is a cache hit and a changed population without a changed selection is a miss, which is what rule (f) asks. Second, "mounted" is v3's to compute, not STYNX's: the STYNX route parser reads declarations and says so in its own header, so `inventory` walks each app's root module through static `imports` and `controllers` arrays with the TypeScript parser (D-058); a dynamic module factory it cannot follow is `UNKNOWN: mount-unresolved` with the import's locator, the template keeps module lists static (09), and the class-A cost of the walk is measured under D-047 before the class is confirmed (Astra N-06).

### B.1 `inventory`

| Row | Contract |
|---|---|
| Standards | S-06, S-07, S-31, S-62 |
| Inputs | `devai.json`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, every workspace `package.json`, every `tsconfig*.json`, the full path set (tracked + untracked, modes, symlinks), `git diff --name-status --no-renames <base>..HEAD` plus working-tree changes, the bytes of every module file the mount walk reads (`apps/*/src/**/*.module.ts`, `domain/*/api/src/*.module.ts` and their static `imports` targets), `vitest.config.ts` tier globs, host `node`/`pnpm`/`corepack` versions |
| Population | Always applies; never `SKIPPED` |
| Invokes | `git ls-files -z`, `git ls-files -z --others --exclude-standard`, `git diff --name-status --no-renames -z <base> HEAD`, `node --version`, `corepack --version`, `pnpm --version`, `tsc --showConfig -p <tsconfig>` per project (binary consumer, D-057); TypeScript library in-process for the mount walk (D-058) |
| Observation | One observation = one workspace package manifest. `expected` = packages the workspace globs match (real packages only, 04 §1; a seed glob with no match adds none and is no finding, D-092); the root manifest is not an observation (D-084); `observed` = manifests read; `evaluated` = manifests whose `type`, engines and `tsc --showConfig` were checked. Side products: `toolchainDigest = sha256(node version ‖ pnpm version ‖ pnpm-lock.yaml)`, each component length-framed as C.4's `<len>:<bytes>`, a missing `pnpm-lock.yaml` framed as empty (D-084); every population Part B names, with its predicate result and count; the mounted-route population (app root module → static `imports`/`controllers` closure, TS AST); the test-file census per tier; the project closure (`tsc -b` references) of each changed file |
| Status | `FAIL`: a manifest without `"type": "module"` (S-31); a Node profile whose effective `module`/`moduleResolution` ≠ `nodenext`, or an Angular profile whose `module` ≠ `es2022`/`moduleResolution` ≠ `bundler` (07 §1); an effective profile lacking `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `forceConsistentCasingInFileNames` or `target` ≠ `es2022` (S-32); workspace glob naming no package (a workspace whose globs match no package is this `FAIL`, never `observed 0`, D-084), except a seed glob: the 09 §1.1 globs `domain/*/api` and `domain/*/web` are seed globs, and a seed glob that matches no package is never a finding, whatever `database/seed/modules.txt` lists; any other no-match glob is this `FAIL` (D-092). `UNKNOWN`: host `node` ∉ `engines.node`, `pnpm` ≠ `packageManager` or `corepack` absent, and a missing `engines.node` or `packageManager` (`engines-mismatch`, remedy `corepack use <packageManager>`; no pin file, D-057); `tsc` unresolvable (`tooling-missing`; `tsc` resolves from `<root>/node_modules/.bin/tsc` only); mounted-route closure unresolvable (`mount-unresolved`, locator = the dynamic import) — dependents inherit via `prerequisite-failed`. `FAIL` findings and an `UNKNOWN` cause together are `FAIL`, keeping every finding (A.3's `FAIL` + `UNKNOWN` → `1`, applied inside the node; D-084). The Angular profile applies to a package that depends on `@angular/core` (D-084) |
| Findings | `<package.json>:1 "type" is not "module" [S-31] set "type": "module"` · `<tsconfig>:1 effective module <x> ≠ nodenext [S-31] extend @stynx-nyx/tsconfig/node24.json` · `<tsconfig>:1 effective strict is false [S-32] restore the published chain` · `pnpm-workspace.yaml:<line> glob <g> matches no package [S-06] remove it` · `pnpm-workspace.yaml:1 unparseable: <first line of the parser error> [S-06] fix the YAML` · `<package.json>:1 manifest not readable [S-06] restore the package.json` · `<package.json>:1 manifest not parseable: <message> [S-06] fix the JSON` · `package.json:1 engines.node is not declared` · `… host node <v> ∉ engines.node <range>` · `… packageManager does not name pnpm@<x.y.z>` · `… host pnpm <v> ≠ packageManager <pm>` · `… corepack is absent` (each `[S-07] corepack use <packageManager>; Node must satisfy engines (>=24 <25)`) · `<tsconfig>:1 tsc not resolvable from node_modules/.bin [S-31] install with pnpm install` · `<tsconfig>:1 tsc --showConfig exited <code> [S-31] the tool exited abnormally; re-run once, then put the output under ## Notes` (D-084) |
| Latency / where | A (mount walk measured under D-047, Astra N-06) · all |
| Needs | — |

[opinion] **Population table (D-084).** `inventory` owns every count (02 §2 (f)); a node never recounts. The evidence string is the block's Population row; the count is one unit per entry below. "Changed" is the packet's `base..candidate` diff, or without a packet the working tree against `HEAD` plus untracked files (A.3); "present" = present at the candidate. A node's wave may *tighten* its predicate only by a stale-text PR that cites the row (no decision); any other change to a count is a decision.

| Node | Count (one unit per) |
|---|---|
| `inventory` | workspace package the globs match (root manifest excluded); never `SKIPPED` |
| `format` | changed, present `*.{ts,mjs,json,md}` not named by `.prettierignore` (D-096) |
| `lint` | changed, present `*.ts`, `*.mts`, `*.html` |
| `lint-tests` | changed, present `*.spec.ts` |
| `typecheck` | workspace package containing a changed `*.ts`/`*.mts`/`*.cts` or `tsconfig*.json` (the `tsc -b` closure replaces it when its wave lands) |
| `layout` | candidate path; never `SKIPPED` |
| `sql-lint` | changed, present `*.sql` |
| `spec-lint` | changed path under `specs/` or `product/` |
| `route-contract` | declared `domain/*/api/src/**/*.controller.ts` (declared, not mounted, until the mount census lands) |
| `sql-typed` | changed, present `*.repository.ts` |
| `unit` | `*.spec.ts` outside the tier suffixes (`acceptance`, `integration`, `db`, `e2e`) in a `typecheck`-affected package |
| `test-integrity` | changed path under `test/`, `apps/*/test/` or `domain/*/{api,web}/test/` |
| `i18n` | opted-in locale beyond `en-US`, plus each package that depends on `@angular/core` |
| `actionlint` | changed, present `.github/**/*.{yml,yaml}` |
| `commitlint` | commit in `base..HEAD`; 0 without `--packet` |
| `generated` | `domain/*/generation-manifest.json` |
| `boundary` | 1; never `SKIPPED` (B.17) |
| `deadcode` | workspace package; never `SKIPPED` |
| `openapi` | changed `*.controller.ts`, file under a `dto/` folder, `index.ts`, or `apps/*/src/**/*.module.ts` |
| `db-apply` | path under `database/` |
| `spec-tests` | `*.acceptance.spec.ts` in the candidate (any; the evidence string keeps the literal `<spec id>` until its wave narrows it per spec) |
| `integration` | every `test/integration/*.integration.spec.ts` and `test/db/*.db.spec.ts` (not only the affected ones) |
| `e2e` | `test/e2e/*.e2e.spec.ts` or `*.playwright.ts` |
| `permissions-pattern` | declared `*.controller.ts` under `domain/*/api/src/` or `apps/*/src/` |
| `protected-paths` | 1; never `SKIPPED` |
| `packet-scope` | 1 under `--packet`, else 0 (deferred, not `SKIPPED`) |
| `review` | 1 under `--packet`, else 0 (deferred, not `SKIPPED`) |
| `accept` | 1; never `SKIPPED` |

[inference] W1 (#55) approximates the mounted-route census with a stub that reports `UNKNOWN: mount-unresolved` for any `apps/*/src/**/*.module.ts` or `domain/*/api/src/*.module.ts`; removing the stub and landing the static `imports`/`controllers` walk this block describes is an obligation on W2's `route-contract` PR, not a contract (D-084 item 9).

### B.2 `format`

| Row | Contract |
|---|---|
| Standards | S-41 |
| Inputs | Changed `*.{ts,mjs,json,md}` (the staged set under `--hook pre-commit`; 02 §2 as narrowed by D-058: SQL belongs to `sql-lint`), `package.json` `prettier` block, `.prettierignore` (the 09 §1.1 row: the fixed-byte law texts, D-096) |
| Population | `no changed *.{ts,mjs,json,md}` |
| Invokes | `prettier --list-different -- <files…>` (Prettier 3.9.6; root options as STYNX's [fact: `stynx:package.json:130-135`]; `getSupportInfo()` lists 23 languages and none with `.sql` [fact: probe today, D-058]) |
| Observation | One observation = one file; `expected` = changed matching files, less the paths `.prettierignore` names (D-096); `observed` = files Prettier accepted as input (every argv file unless it reports a parse error for it); `evaluated` = `observed` |
| Status | `FAIL` when stdout lists ≥ 1 path, or Prettier reports a syntax error for a candidate file (a readable file it rejects is a defect); `UNKNOWN`: `tooling-missing`, exit ∉ {0, 1, 2} (`runner-crashed`) |
| Findings | `<path>:1 not formatted [S-41] run prettier --write <path>` · `<path>:<line>:<col> syntax error: <message> [S-41] fix the file` |
| Latency / where | A · E, C1 |
| Needs | — |

### B.3 `lint`

| Row | Contract |
|---|---|
| Standards | S-01, S-05, S-25, S-31, S-33–S-38, S-41, S-50, S-51 |
| Inputs | Changed `*.ts`, `*.mts`, `*.html` plus their project closure, `eslint.config.mjs`, the published `@stynx-nyx/eslint-config` version, the v3 overlay version, each project's `tsconfig*.json`, `devai.json` `productPrefix` |
| Population | `no changed *.ts, *.mts or *.html` |
| Invokes | `eslint --format json --max-warnings=0 --no-warn-ignored -- <files…>` (ESLint 10.10.0). The template's `eslint.config.mjs` = published STYNX profiles [fact: factories `P:@stynx-nyx/eslint-config@3.0.0/index.mjs:316-321`; D-089] + the v3 overlay. The published default `strict: true` (`:181`) already sets `@typescript-eslint/no-explicit-any` and every `no-unsafe-*` rule to `error` [fact: `:117-137`; D-013], `stynx/require-idempotent-route-decorator` to `error` [fact: `:266`] and `boundaries/dependencies` `default: 'disallow'` [fact: `:150`, the plugin's value; S-37], and ships `stynx/no-authored-cjs` [fact: `:161`], which covers `require`, `createRequire`, `module.exports`, `exports`, `__dirname`, `__filename`, `import = require` and `export =` (D-057); the overlay keeps those settings, enables `@angular-eslint/template/i18n` for `*.html`, and adds the `devai/*` rules absent from STYNX: `no-enum`, `named-exports-only` (S-36/S-38, exempting `eslint.config.*`, `vitest.config.*`, `playwright.config.*`), `product-prefix` (selectors `<prefix>-`, DI tokens `<PREFIX>_`, classes `<Prefix>`, D-032; exempt is exactly `AppModule` in `apps/<app>/src/app.module.ts`, the mount-census root, D-107), `define-query-location` (`defineQuery(` only in `*.repository.ts`, the 02 §2 `layout` phrase enforced here as an AST rule), `no-raw-query` (02 §3) |
| Observation | One observation = one file; `expected` = changed lintable files; `observed` = files in ESLint's JSON; `evaluated` = files without `fatalErrorCount` |
| Status | `FAIL`: any message (warnings count, `--max-warnings=0`); an `expected` file absent from the JSON (ignored by config) is a shortfall `FAIL`; `UNKNOWN`: config load failure or parser fatal (`lint-config-failed`, locator = the file), `tooling-missing` |
| Findings | `<path>:<line>:<col> <ruleId>: <message> [S-nn] <hint>`; the overlay carries a rule→standard map; hint example `S-33 no-explicit-any: type the value or parse it with zod` (02 §10) |
| Latency / where | B · E, C1, R |
| Needs | — |

### B.4 `lint-tests`

| Row | Contract |
|---|---|
| Standards | S-60 |
| Inputs | Changed `**/*.spec.ts` (acceptance files included), the published `@stynx-nyx/eslint-config` `./test` profile version |
| Population | `no changed *.spec.ts` |
| Invokes | `eslint --config <resolved @stynx-nyx/eslint-config/test> --format json --max-warnings=0 --no-error-on-unmatched-pattern -- <files…>` (STYNX's own invocation form [fact: `stynx:package.json:16`]); CW-1 rules [fact: `P:@stynx-nyx/eslint-config@3.0.0/index.mjs:423-439`; D-089] |
| Observation | As `lint`, over test files |
| Status | As `lint`; `./test` is exported [fact: `P:@stynx-nyx/eslint-config@3.0.0/package.json:9`; D-089]. Pre-flight and output shape per §0's fifth convention: the resolved `./test` config must load, a non-zero exit without ESLint's JSON is `runner-crashed` (D-086) |
| Findings | Mapped by `ruleId` and, for `no-restricted-*`, by the message prefix (D-086): `no-restricted-syntax` with `WAVE-05A/CW-1:` → `<path>:<line>:<col> WAVE-05A/CW-1: <message> [S-60] assert a value, not existence`; `no-restricted-imports` with `R19-W06:` → `<path>:<line>:<col> R19-W06: <message> [S-60] import the package, not its src by relative path` |
| Latency / where | A–B · E, C1, R |
| Needs | — |

### B.5 `typecheck`

| Row | Contract |
|---|---|
| Standards | S-30–S-33, S-31 (D-045) |
| Inputs | The affected project closure's sources and `tsconfig*.json`, the published `@stynx-nyx/tsconfig` version, `inventory`'s `showConfig` results |
| Population | `no affected project` |
| Invokes | `tsc -b --verbose --pretty false <affected project tsconfigs…>` (TypeScript 6.0.3 binary, D-057; no trailing `--`: `tsc -b` rejects it with TS5072 "Unknown build option" [fact: `stynx:node_modules/typescript/lib/_tsc.js:6959`; D-058]); emits JS into each project's `outDir` as development requires (07 §1); `--verbose` names every project as built or up to date, which is the clean-project observation |
| Observation | One observation = one project; `expected` = affected projects; `observed` = projects the verbose output names (built or up to date) whose `tsbuildinfo` exists afterwards; `evaluated` = projects that completed with or without diagnostics |
| Status | `FAIL`: ≥ 1 diagnostic; an effective `module: commonjs`, or a missing strictness option, reported by `inventory` for an affected project (D-012, S-32; 02 §2 "effective options must keep the chain's module and strictness"); `UNKNOWN`: `tooling-missing`, non-diagnostic crash (`runner-crashed`) |
| Findings | `<path>:<line>:<col> TS<code>: <message> [S-33] type the value or parse it with zod` · `… [S-32] fix the type, not the config` (`TS7006`/`any`-family codes map to S-33, the rest to S-32); `<tsconfig>:1 emits commonjs [S-31] set module: NodeNext` · `<tsconfig>:1 effective <option> off [S-32] restore the published chain` |
| Latency / where | B · E, P, R |
| Needs | — |

### B.6 `layout`

| Row | Contract |
|---|---|
| Standards | 04 §1–§6, D-017, D-021–D-024, D-027, D-031, S-62 |
| Inputs | The full path set, `pnpm-workspace.yaml`, `vitest.config.ts` (tier globs), `docs/_ia/categories.json`, the bytes of every `specs/**/*.md` (line count), the bytes of `law/**/README.md` and `product/**/README.md` (facade test) |
| Population | Always applies (the root itself is the population) |
| Invokes | Nothing; path predicates with `ignore` 7.0.5 for tier globs (D-057); no TypeScript library (the `defineQuery` location rule is `lint`'s, B.3) |
| Observation | One observation = one predicate × path; `expected` = predicates × candidate paths in scope; `observed` = evaluated pairs; `evaluated` = `observed`. Predicates: module shape (04 §2: flat `api/src`, only `dto/`, `adapter/`; `web/src` flat; `db/<ns>_<slug>.sql`), `test/` singular everywhere (D-024), tier suffix in filename (04 §4), every enabled tier glob matches ≥ 1 file (S-62; the six 09 §1.1 `vitest.config.ts` tier literals are exempt when they match no file, as the seed globs are, D-107), docs seven sections + `_ia`, kebab names and ≤ 350 lines for specs (04 §4), workspace globs name real packages (the two seed globs are exempt, as in B.1, D-092), root-guide allowlist (04 §1), a `README.md` under `law/` or `product/` that consists only of links into `docs/` is a facade (04 §1 line 38), `database/ddl/NN-<schema>-<topic>.sql` band digits (D-017, D-040), `database/migrations/YYYYMMDD_NN_snake_case.sql` name form |
| Status | `FAIL` on any predicate violation; `UNKNOWN: io` only when the path set or a declared input could not be read |
| Findings | `<path>:1 <predicate>: <what is wrong> [04 §n] <move/rename hint>`, e.g. `domain/notes/api/src/services/x.ts:1 layer folder under api/src [04 §2] flatten to api/src/x.service.ts` |
| Latency / where | A · E, P, R |
| Needs | — |

### B.7 `sql-lint`

| Row | Contract |
|---|---|
| Standards | S-02, S-15, S-17, S-24 (LINT001–013), D-033, D-043 |
| Inputs | Changed `*.sql`; the migration population (`database/ddl/**`, `database/migrations/**`, `domain/*/db/**`); the committed applied-migration manifest LINT013 reads; `devai.json` `lgpd`; `base:` blobs of changed SQL |
| Population | `no changed *.sql` (05 §3) |
| Invokes | `stynx-migration-lint <root>… --format=json --lgpd --base-dir <scratch dir holding base: blobs> --manifest <path>`: **one invocation over every root** present (`database/ddl`, `database/migrations`, `domain/*/db`), so LINT010 and LINT013 run across the joint population [fact: `P:@stynx-nyx/migration-linter@3.0.0/dist/src/lint.js:306-311`, `context-rules.js:19-50`; D-085]. The context flags exist [fact: `dist/src/cli.js:3,32-40`], `LINT_CODES` holds LINT001–013 [fact: `dist/src/types.d.ts:1`] and a parser-load failure is reported as `parserIssues` with exit 2 [fact: `dist/src/parser.js:27-30`, `lint.js:323-337,375-376`; D-089]. Output JSON `{ files, issues[{ code, file, message, line, suggestion? }], parserIssues[] }`; `files[]` are cwd-relative, `issues[].file` and `parserIssues[].file` relative to their target root [fact: `lint.js:297,369`]; usage and input errors print one stderr line, nothing on stdout, exit 2 [fact: `cli.js:85-98`]. Before invoking, the node imports `pg-query-emscripten` 5.1.0 itself (a DEVAI runtime dependency, 07 §2) and treats a load failure as `UNKNOWN: parser-unavailable` |
| Observation | One observation = one SQL file across the roots; `expected` = population files; `observed` = `files.length` of the one invocation; `evaluated` = `observed` − files in `parserIssues` |
| Status | `FAIL`: ≥ 1 issue or ≥ 1 `parserIssues` entry naming a candidate file (a readable file the parser rejects is a defect; exit 2 **with** JSON is this case). LINT010 reads the prefix as `^(\d+)_`, so two migrations of one day (`YYYYMMDD_01_…`, `YYYYMMDD_02_…`) collide; that is a STYNX defect filed for S10, and `sql-lint` reports what the tool says meanwhile (D-085). `UNKNOWN`: `tooling-missing`, `parser-unavailable`; exit 2 with empty stdout, reason by stderr (`does not exist` / `not a directory` → `lint-config-failed`; otherwise `io`; D-085, until STYNX gives usage errors their own exit code, S10); exit ∉ {0, 1, 2} (`runner-crashed`) |
| Findings | `<root>/<file>:<line> LINT<nnn> <message> [S-24] <first line of suggestion>`; DEVAI re-roots each `issues[].file` and `parserIssues[].file` by prefixing the target root it passed, disambiguated by `files[]` (D-085) |
| Latency / where | A · E, C1, R |
| Needs | — |

### B.8 `spec-lint`

| Row | Contract |
|---|---|
| Standards | S-25, D-008, D-016, D-048, D-056 |
| Inputs | Changed `specs/**/*.md` and every spec whose `sources[].path` is a changed `product/**` file, the referenced `product/**` artifacts, the global identity population for SL06 (the `id` of every `specs/**/*.md` and every `product/use-cases/*.json` at the candidate), `devai.json` `locales`/`lgpd`, the zod definitions of the 06 §2 machine block and the use-case object |
| Population | `no changed specs/** or product/**` |
| Invokes | In-process: `yaml` 2.9.0 (`uniqueKeys: true`, positions; aliases, tags, non-string keys rejected by walk, 07 §3), zod 4.4.3 |
| Observation | One observation = one spec file; `expected` = specs in scope; `observed` = specs parsed to a document; `evaluated` = specs whose SL01–SL08 and SL12 all executed. SL09–SL11 are `packet-scope`'s (D-054) |
| Status | `FAIL` on any SL01–SL08/SL12 violation incl. malformed readable YAML (06 §4); `UNKNOWN` when a spec, source, population member or `devai.json` cannot be read (`io`) |
| Findings | `<spec path>:<line> SL<nn> <06 §4 message> [S-25] <hint>`; line = the YAML node's position or `1` |
| Latency / where | A · E, P, R |
| Needs | — |

### B.9 `route-contract`

| Row | Contract |
|---|---|
| Standards | S-10, S-11, S-20, S-22, S-25, S-26, S-28, S-29, S-70 |
| Inputs | `inventory`'s mounted-route population per module and app, affected controllers (`*.controller.ts`) and app root modules, the spec machine block (`routes[]`), `product/use-cases/*.json`, the `@stynx-nyx/cli` version |
| Population | `no mounted routes in domain/<m>` **and** spec `routes[]` empty (05 §3; a spec with routes and no mounted routes is `FAIL`, not `SKIPPED`) |
| Invokes | `stynx list-routes --json --roots <domain/*/api/src,apps/*/src>` (published entry point of `@stynx-nyx/cli` 3.0.0, D-057, whose default roots are these [fact: `P:@stynx-nyx/cli@3.0.0/dist/cli/src/checks.js:13`]; its parser is TypeScript-based and declaration-only [fact: `P:@stynx-nyx/cli@3.0.0/engines/nest-route-declarations.mjs:29`, "Source declarations only"; D-089]); TypeScript library for decorator arguments, `parseDto`, middleware |
| Observation | One observation = one `(method, normalised path)` pair in spec routes ∪ mounted routes of the module; `expected` = that union; `observed` = pairs resolved on both sides; `evaluated` = pairs whose five fields, boundary validation and role binding were compared |
| Status | `FAIL`: pair on one side only; any field mismatch (`mode:key` ↔ `@Idempotent({headerName, ttlMs})`, `mode:none` ↔ `@NoIdempotent()`, `roles` ↔ `@RequireRoles([...], 'all')` as sets, `errorContract` ↔ `@ErrorContract([...])` as a set of `{status, code, messageKey}`, `useCase` ↔ `@UseCase('UC-…')`, `slo` ↔ `@Slo({metric, percentile, maxMs})`; 06 §5); a decorator argument that is not a literal (`not statically readable`); a handler parameter decorated `@Body/@Query/@Param/@Headers` (headers used by logic, S-26, 02 §12) without `parseDto(<zod>)` or a typed pipe; a route neither role-bound nor `@Public()`; `@UseCase` id absent from `product/use-cases/`; an app root module without the request-id middleware (`StynxCoreModule` from `@stynx-nyx/core`, which mounts it [fact: `stynx:packages/core/src/core.module.ts:36-50`], or a `NestMiddleware` applied `forRoutes('*')` that rejects a missing or non-UUIDv7 `x-request-id` — reading the header alone is not validation). `UNKNOWN`: `tooling-missing`, including a route bound by `@RequireRoles` while `list-routes` does not read it as role-binding (S10), finding `tooling-missing — route-contract: install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles` (D-087, D-029), `mount-unresolved`, `prerequisite-failed` (typecheck); a `stynx` exit 1 without the JSON report on stdout (a usage error) is `runner-crashed`, never `FAIL` (§0 fifth convention, D-086) |
| Findings | `<controller>:<line> <METHOD> <path> lacks @ErrorContract [S-28] add @ErrorContract(<value from the spec route>)` · `… @Slo missing (spec: p95 500 ms) [S-25] add @Slo(<spec slo>)` · `… spec route not mounted [S-25] add the handler or remove the spec route` · `… @Headers('x-tenant') without parseDto [S-26] parseDto(tenantHeaderDto)` · `apps/api/src/app.module.ts:1 request-id middleware not mounted [S-70] import StynxCoreModule` |
| Latency / where | B · E, P, R |
| Needs | — |

### B.10 `sql-typed`

| Row | Contract |
|---|---|
| Standards | S-21, S-27, D-010, D-030, D-054 |
| Inputs | Changed `*.repository.ts` (static) plus every `*.repository.ts` for name uniqueness; the spec machine block `queries[]`/`data` for generated modules; **DB part**: the same files plus `db-apply`'s `schemaDigest` |
| Population | `no *.repository.ts changed` (05 §3: required when spec `queries[]` non-empty) |
| Invokes | Static: TypeScript library over each `defineQuery({...})` call. DB (`--packet --full`, `--hook pre-push` when `db-apply` ran, PR, and the edit loop when Postgres is already reachable; a static-only result never satisfies the DB placement, C.4): `pg` 8.23.1 `Client` on the scratch URL as `<product>_app`; per query one pg Submittable passed to `client.query()` (public API) whose `submit(connection)` sends `parse({ name: 'devai_q', text, types: [] })`, `describe({ type: 'S', name: 'devai_q' })`, `close({ type: 'S', name: 'devai_q' })` and one `sync()`; the Submittable carries no `name` property, the Client routes `rowDescription`/`errorMessage`/`readyForQuery` to it, and `parameterDescription`/`noData` are read from `connection` only while it is active [fact: calling `client.connection` directly with no active query makes the Client unqueryable, `P:pg@8.23.1/node_modules/pg/lib/client.js:416-423,444-450,499-505`; R2, D-068]; a Client `'error'` listener is mandatory (a dropped backend emits it with no query active), and a describe answered by `handleError` without `submit()` is `postgres-unreachable`. Messages observed: `parseComplete`, `parameterDescription` (`dataTypeIDs[]`), `rowDescription` (`fields[].name/dataTypeID/dataTypeModifier/tableID/columnID`) or `noData`, `errorMessage`, `readyForQuery` [fact: `Connection` re-emits every protocol message by name, `P:pg@8.23.1/node_modules/pg/lib/connection.js:137-141`; `parse`/`sync`/`close`/`describe` at `:182-185,203-206,229-231,233-235`; `Client` itself registers no `parameterDescription` listener, `lib/client.js:251-270`; message shapes `P:pg-protocol@1.16.1/node_modules/pg-protocol/dist/messages.js:61-68,82-89,16-17`]; never `bind`/`execute`. Column binding by `pg-query-emscripten` 5.1.0 parse (INSERT target list ↔ `$n` in `VALUES`, `UPDATE … SET col = $n`, `WHERE col = $n`); limits by read-only `SELECT … FROM information_schema.columns` (`character_maximum_length`, `is_nullable`, `data_type`) and `pg_get_constraintdef()` of the column's CHECK constraints parsed for `char_length(col) BETWEEN a AND b` / `>= a AND <= b` (02 §3 step 4). Adapter is version-bound: `pg` ≠ `8.23.1` or `pg-protocol` ∉ `^1.16.1` at load → `UNKNOWN: adapter-unbound`; the four-case prototype (empty SELECT, INSERT RETURNING, unsupported OID, protocol error) is 12's prerequisite |
| Observation | One observation = one `defineQuery` site; `expected` = sites in changed files; `observed` = sites parsed; `evaluated` = sites whose static (and, DB part, describe) checks ran. Static checks: `text` is a `sql` tagged template with zero expressions; `$n` contiguous from 1 and count = `z.tuple([...])` length; `name` unique workspace-wide; generated modules: limits equal the spec's `data` bounds (UTF-16 units, D-054). DB checks: `parameterDescription.dataTypeIDs.length` = tuple length; each OID → zod leaf by 02 §3's explicit table; `rowDescription` names = `row` keys with compatible OIDs; zod `max` ≤ `character_maximum_length`, zod `min`/`max` within the CHECK `char_length` bounds, integer ranges, nullability for insert/update targets; each query's `sha256(text)` goes to `details.queries[].textSha256` (D-058) |
| Status | `FAIL`: any static or DB mismatch; prepare error (SQLSTATE and server message as finding; the server message is localised by `lc_messages`, so comparisons key on SQLSTATE, D-068); `UNKNOWN`: OID outside the table (`unsupported-oid <oid>`), a `$n` bound through an expression, cast or function the parser cannot resolve to a column (`unsupported-binding`, locator = the site; a parameter bound to no column has no limit obligation), `adapter-unbound`, `postgres-unreachable`, `prerequisite-failed` (db-apply), `parser-unavailable`. The 02 §3 step-3 `EXPLAIN` heuristic is struck from this node's obligations (D-058; open in 02) |
| Findings | `<repository>:<line> param $5 z.string().max(1024) exceeds est.crash_vehicle.apparent_damage varchar(512) [S-27] keep the zod bound within the column's limits; in a generated module, equal to the spec's data bound` · `… $2 z.string().max(80) outside CHECK char_length BETWEEN 1 AND 64 [S-27] keep the zod bound within the column's limits; in a generated module, equal to the spec's data bound` · `… $3 declared but tuple has 2 params [S-21]` · `… name demo_notes.note.get duplicates <other path>:<line> [S-21] rename one query` · `… prepare failed: <SQLSTATE> <server message> [S-21] fix the SQL text` |
| Latency / where | A static / B DB · E static; P, R, F DB |
| Needs | `postgres` (DB part only) |

### B.11 `unit`

| Row | Contract |
|---|---|
| Standards | tests (04 §4), S-62 |
| Inputs | The selected `*.spec.ts` files (affected projects, minus `*.acceptance.spec.ts`, D-054) and the `tsc -b` project closure of each as `inventory` computes it (02 §2 (f)); `vitest.config.ts`; the Vitest 4.1.11 version (D-076) |
| Population | `no unit test files in affected projects` |
| Invokes | `vitest run --config vitest.config.ts --reporter <devai reporter module> -- <files…>` with `TEST_TIER=unit`, the files being the affected spec files, by path (D-114); the reporter is the C.5 adapter (Vitest `Reporter` interface [fact: `P:vitest@4.1.11…/dist/chunks/reporters.d.DtoKVV2s.d.ts:1041-1091`]); SWC metadata transform as STYNX's [fact: `stynx:tools/repo-config/vitest.base.mjs:243-253`] |
| Observation | One observation = one test case; `expected` = cases collected (`onTestModuleCollected`) across the `expected` files; `observed` = cases that ran to `passed` or `failed` (a `skipped` or `pending` case is terminal but is **not** an observation, D-081); `evaluated` = `observed`. A collected file absent from the census, or a collected case not observed, is a shortfall `FAIL` (02 §2 rule b) |
| Status | `FAIL`: ≥ 1 failed case; a test module that fails to import (candidate defect, locator = module); `UNKNOWN`: a collected case without a terminal result at `onTestRunEnd`, or exit without `onTestRunEnd` (`runner-crashed`), timeout, `tooling-missing`. A skipped or pending case is a shortfall `FAIL` naming the case (D-081): S-64's issue reference satisfies `test-integrity`'s static check, not `unit`, which observes what ran |
| Findings | `<file>:<line> <fullName>: <error.message first line> [tests] fix the behaviour or the case through its packet`; import failure `<file>:1 collection failed: <message> [tests] fix the import`; skipped `<file>:<line> <fullName>: skipped [S-64] make it run or delete the case` |
| Latency / where | B · E, P, R |
| Needs | — |

### B.12 `test-integrity`

| Row | Contract |
|---|---|
| Standards | S-63, S-64 |
| Inputs | Changed `test/**`, `domain/*/{api,web}/test/**`, `apps/*/test/**` at the candidate and `base:` blobs of the same paths; `git diff --name-status --no-renames`; the pinned spec's `acceptance: yes` ids; the packet `kind` (when `--packet`) |
| Population | `no changed test/**` (05 §3) |
| Invokes | TypeScript library (parse only) |
| Observation | One observation = one changed test file; `expected` = changed test files (adds, modifies, deletes); `observed` = files parsed at head or read at base; `evaluated` = files whose four rules ran |
| Status | `FAIL`: `it/describe/test.skip|.only|.todo` whose arguments or trailing comment carry no issue reference (`#\d+`, `[A-Z]+-\d+`, URL); literal verdicts (`expect(<literal>).toBe(<same literal>)`, `status: 'passed'`); assertion count (`expect(` + `assert.` call expressions) at head < 80 % of base in a file without `// @acceptance-change: approved-by=`; **any** modification, deletion or rename of a base-present `*.acceptance.spec.ts` without `// @acceptance-change: approved-by=` in the head file (02 §2 row, 05 §4: every acceptance change needs the annotation), and any such edit at all while `kind ∉ {test}` (S-63); an `it('R-n: …')` for an `acceptance: yes` requirement present at base and absent at head (annotation or not). `UNKNOWN`: `base-unreadable` |
| Findings | `<file>:<line> it.skip without issue reference [S-64] link the issue or delete the case` · `<file>:1 assertions 12 → 7 (−42 %) [S-64] add // @acceptance-change: approved-by=<pilot> in a test packet` · `<file>:1 acceptance file changed without @acceptance-change [S-63] add the annotation in a test packet` · `<file>:1 acceptance file edited by a code packet [S-63] revert; a test packet owns it` |
| Latency / where | A · E, P, R |
| Needs | — |

### B.13 `i18n`

| Row | Contract |
|---|---|
| Standards | S-16 |
| Inputs | The per-locale catalog files `domain/*/api/src/<slug>.i18n.<locale>.ts` (09 §2; locale tag lowercased; one `as const` object literal read statically, never executed), `devai.json` `locales`, the spec `i18n` map, Angular templates `web/src/**/*.html` |
| Population | `no opted-in locale beyond en-US and no Angular app` (05 §3) |
| Invokes | In-process catalog comparison; `eslint --format json --max-warnings=0 -- <templates…>` with the overlay's `@angular-eslint/template/i18n` (07 §5) |
| Observation | One observation = one `(key, locale)` pair plus one per template file; `expected` = keys in `en-US` (∪ spec `i18n` keys) × opted-in locales + template files; `observed` = pairs looked up + templates in ESLint's JSON; `evaluated` = `observed` |
| Status | `FAIL`: a key missing in a locale; a spec key absent from the `en-US` catalog; any template i18n message; `UNKNOWN`: `catalog-unresolved`, catalog unreadable (`io`), `tooling-missing` |
| Findings | `<catalog pt-BR>:1 missing key demo.notes.missing [S-16] add the pt-BR text` · `<template>:<line>:<col> template/i18n: <message> [S-16] mark the text i18n` |
| Latency / where | A · E, P, R |
| Needs | — |

### B.14 `actionlint`

| Row | Contract |
|---|---|
| Standards | S-43 |
| Inputs | Changed `.github/**/*.yml` and `.github/**/*.yaml` |
| Population | `no changed .github/**` (05 §3) |
| Invokes | `github-actionlint -format '{{json .}}' -- <files…>` (wrapper 1.7.12 runs the official binary [fact: `P:github-actionlint@1.7.12/node_modules/github-actionlint/package.json:2-4`; STYNX spawns it, `stynx:scripts/lint-workflows.mjs:54-58`]; `-format '{{json .}}'` prints a JSON array, `[]` with exit 0 and the error entries with exit 1 [fact: 1.7.12 downloads the binary at install under pnpm 9.15.0; probe in the R6 W2 fact sheet §2 B.14; D-089]) |
| Observation | One observation = one workflow file; `expected` = changed workflow files; `observed` = argv files on an exit of 0 or 1 with parseable JSON (the output lists errors only; a file the binary cannot read appears as an error entry, so a clean file is observed by the exit status plus its absence from the error list); `evaluated` = `observed` |
| Status | `FAIL`: ≥ 1 entry; `UNKNOWN`: `tooling-missing` (binary download absent), unparseable output or exit ∉ {0, 1} (`runner-crashed`) |
| Findings | `<file>:<line>:<col> <kind>: <message> [S-43] fix the expression or input` |
| Latency / where | A · P, R |
| Needs | — |

### B.15 `commitlint`

| Row | Contract |
|---|---|
| Standards | S-40 |
| Inputs | The message file (`--hook commit-msg`) or `git log <base>..HEAD` messages (`--full`); `tools/commitlint.config.mjs` (ESM, D-057; location per 07's handoff to 09); the scope population (every workspace package name, every `domain/<slug>`, and `template`, `packets` for A.1's two commits) |
| Population | `no commits between base and HEAD` (`--full` only; the hook always has one message) |
| Invokes | `commitlint --config tools/commitlint.config.mjs --edit <msgfile>` (STYNX's form, with a `.cjs` config today [fact: `stynx:.husky/commit-msg:1`]) or `commitlint --config … --from <base> --to HEAD` (21.2.2) |
| Observation | One observation = one message; `expected` = messages; `observed` = messages linted; `evaluated` = `observed` |
| Status | `FAIL`: exit 1 with a parsed rule violation; `UNKNOWN`: `tooling-missing`, config load failure (`lint-config-failed`), message file unreadable (`io`). Because commitlint 21.2.2 also exits 1 for a missing `--config`, a missing `--edit` file and a `cwd` outside git, DEVAI pre-flights the config file, the message file and the git root before invoking and reports those reasons without invoking; an exit 1 without a parseable violation is `runner-crashed` (§0 fifth convention, D-086) |
| Findings | `<sha\|message-file>:1 <rule>: <message> [S-40] type(scope): subject` (parsed from commitlint's text output) |
| Latency / where | A · commit-msg (and F over the range) |
| Needs | — |

### B.16 `generated`

| Row | Contract |
|---|---|
| Standards | S-45, D-033 |
| Inputs | Every `domain/*/generation-manifest.json`, every file it lists, each module's `api/package.json` (the decorators pin, D-074), the **recorded** spec bytes (the blob whose sha256 equals the manifest's `specSha256`, found at HEAD, at the packet `base`, or in `git log --all -- <spec path>`; never "the spec at HEAD" as such), the recorded `options`, the installed DEVAI generator version, any other file whose first line carries `@generated`; for STYNX pairs: the committed `openapi.json`, public-API baselines and SDK outputs with their sources |
| Population | `no generation-manifest.json under domain/` (05 §7); for `code`/`fix`: `no changed @generated file or manifest` (05 §3) |
| Invokes | The DEVAI generator in-process (`devai new module`'s renderer, A.2) in check mode: render the recorded spec bytes with the recorded options to memory, compare bytes and the generated file set (the property STYNX's `--check` has [fact: `stynx:packages/cli/src/generate-module.ts:481-489`]); 09 binds the replay to the manifest. STYNX `:write`/`--check` pairs (02 §2): `stynx verify-api-coverage --strict --json` without `--write-openapi` [fact: `stynx:scripts/verify-api-coverage.mjs:9-11`, `package.json:31`], `stynx verify-public-api-baselines --json` without `--write` [fact: `package.json:34`], and `stynx-sdk-codegen --check --input <openapi.json> --output <dir>` from `@stynx-nyx/sdk` (11 SM-18, P-7-06 → D-059; `tooling-missing` until published) |
| Observation | One observation = one `mode: generated` manifest entry plus one per STYNX pair; `expected` = entries + pairs; `observed` = entries whose file exists and was hashed + pairs whose check ran; `evaluated` = entries rendered and compared + pairs compared. Seeds are read for the manifest's initial digest only and never compared; a `db/*.sql` entry present at the merge base is excluded from `expected` (its bytes are LINT013's, D-043; 09 §3) |
| Status | `FAIL`: byte difference; generated file missing; generated file present but unlisted; hand-edited `@generated` file outside a manifest; a module whose `api/package.json` pins `@devai-nyx/decorators` at a version ≠ its manifest `generatorVersion` (D-074); a STYNX pair whose `--check` reports drift. Never a failure because the spec at HEAD has since changed status or been superseded (05 §4, D-053: old pins stand). `UNKNOWN`: installed generator version ≠ manifest `generatorVersion` (`generator-version-mismatch`, remedy `pnpm add -D @devai-nyx/cli@<version>`); recorded spec bytes or options unresolvable (`generator-unavailable`, locator = the manifest); `tooling-missing`, including the two STYNX pairs while `@stynx-nyx/cli` publishes no write form (`stynx api-docs write`, `stynx public-api-baselines write` are an S10 item), hint `generated: install @stynx-nyx/cli ≥ <v> with the write pair` (D-088, D-029) |
| Findings | `<path>:1 differs from regeneration [S-45] regenerate (devai new module --regenerate) or move the logic to a seed file` · `domain/notes/generation-manifest.json:1 recorded spec bytes not found [S-45] regenerate in a generate packet` · `openapi.json:1 differs from stynx api-docs write [S-45] run the write pair in a generate packet` (D-088) |
| Latency / where | B · P, R |
| Needs | — |

### B.17 `boundary`

| Row | Contract |
|---|---|
| Standards | S-34, S-44 |
| Inputs | Every workspace `package.json`, `.stynxrc.json`, imports of every `*.ts` under the configured roots |
| Population | `no .stynxrc.json` is **not** evidence: the template ships one (04 §7, D-058), so absence is `FAIL`; never `SKIPPED` |
| Invokes | `stynx verify-stynx-boundary --json` (published entry point, D-057; it reads `.stynxrc.json` only, prints the JSON report with a `scanned` census, and reports a missing `.stynxrc.json` as `FAIL` [fact: `P:@stynx-nyx/cli@3.0.0/dist/cli/src/checks.js:96-106`, `engines/stynx-boundary.mjs:9-19`; D-089]). Before invoking, DEVAI validates `.stynxrc.json` against a zod definition of the keys it relies on (`boundary`, `apiCoverage`, `publicApi`), because the published command takes a non-object file with default roots [fact: `stynx-boundary.mjs:9-19,24`] (D-087) |
| Observation | One observation = one source file scanned; `expected` = `*.ts` under the roots; `observed` = files the tool reports scanning; `evaluated` = `observed` |
| Status | `FAIL`: any violation line; `.stynxrc.json` missing; `UNKNOWN`: `.stynxrc.json` present but invalid against the zod definition (`config-invalid`, for every node that reads it, D-087), `tooling-missing`, output not machine-readable or without a scanned-file census, including a `stynx` exit 1 without JSON (`runner-crashed`, §0 fifth convention, D-086) |
| Findings | `<file>:1 imports forbidden <specifier> [S-44] import the public entry point` · `<file>:1 imports undeclared STYNX seam <specifier> [S-34] add it to .stynxrc.json allowedPackages or import the barrel` |
| Latency / where | B · P, R |
| Needs | — |

### B.18 `deadcode`

| Row | Contract |
|---|---|
| Standards | S-42 |
| Inputs | The workspace: every manifest, every source, `tools/knip.config.ts` |
| Population | Always applies |
| Invokes | Per workspace package: `knip --reporter json --no-config-hints --config tools/knip.config.ts --workspace <dir>` [fact: `json` reporter ships, `P:knip@6.35.1/node_modules/knip/dist/reporters/json.js`; `-W, --workspace [filter]` repeatable, `dist/util/cli-arguments.js:26`]; `depcheck <package dir> --json --ignore-patterns='**/*.spec.ts'` [fact: `P:depcheck@1.4.7/node_modules/depcheck/dist/cli.js:59`]; `madge --circular --json --extensions ts,mjs -- <package src>` [fact: `P:madge@8.0.0/node_modules/madge/bin/cli.js:24`]; STYNX's invocations are the model [fact: `stynx:package.json:22-25`] |
| Observation | One observation = one package × tool; `expected` = packages × 3; `observed` = pairs whose JSON parsed; `evaluated` = `observed`. Per-package invocation is the scanned-coverage census: an empty issue list from a tool that was pointed at the package is an observation of that package, which a single workspace-wide call could not establish |
| Status | `FAIL`: any unused file/export/dependency, any missing dependency, any cycle; `UNKNOWN`: a tool missing or crashing (`tooling-missing`/`runner-crashed`; the other pairs still reported) |
| Findings | `<file>:<line> unused export <name> [S-42] remove it or add a knip entry (knip)` · `package.json:1 unused dependency <name> [S-42] remove it (depcheck)` · `<file a>:1 cycle: a → b → a [S-42] break the cycle (madge)` |
| Latency / where | B–C · P, R |
| Needs | — |

### B.19 `openapi`

| Row | Contract |
|---|---|
| Standards | S-20, S-22, S-23, S-40 |
| Inputs | Sources under the API roots (`apps/*/src/**`, `domain/*/api/src/**`, `packages/*/src/**`), `.stynxrc.json`, the committed OpenAPI document, the public-API baseline file, `.changeset/*.md`, `base:` blobs of the baseline, the document and the public-surface sources |
| Population | `no app binding changed and no public-API surface changed` (05 §3's `no app binding changed`, widened: a changed controller, DTO or package `index.ts` whose exported declarations differ from base is a changed surface, 02 §2 row; an unchanged app binding never skips it) |
| Invokes | `stynx verify-api-coverage --strict --json`, `stynx verify-openapi-contract --json`, `stynx verify-public-api-baselines --json` (published entry points, D-057). Their paths are `.stynxrc.json` keys (`apiCoverage`, `publicApi`, `openapiContract`), whose defaults are STYNX's own layout [fact: `P:@stynx-nyx/cli@3.0.0/engines/api-coverage.mjs:22,24`, `dist/cli/src/checks.js:15-16,201-205`; D-089]; the template's `.stynxrc.json` names the 04 roots (`apiCoverage.sourceRoots`, `publicApi.packageRoots`; 09 §1.1, D-087) and is validated as in B.17 before any `stynx` call. Check forms only are published: no write form exists until `stynx api-docs write` and `stynx public-api-baselines write` land (S10, D-088) |
| Observation | One observation = one of the three checks plus the changeset rule; `expected` = 4; `observed` = checks whose output parsed; `evaluated` = `observed`. Changeset rule: baseline at head differs from `base:` baseline by a removed or changed public declaration ⇒ a `.changeset/*.md` naming the fixed group with `major` must exist in the candidate (S-40) |
| Status | `FAIL`: any check failure; breaking baseline without a major changeset; `UNKNOWN`: `tooling-missing` (while the write pair is unpublished, hint `openapi: install @stynx-nyx/cli ≥ <v> with the write pair`, D-088, D-029), `config-invalid` (B.17, D-087), `prerequisite-failed` (typecheck), `base-unreadable`; a `stynx` exit 1 without JSON is `runner-crashed` (§0 fifth convention, D-086) |
| Findings | `<controller>:<line> operation not in openapi.json [S-22] run the write pair (stynx api-docs write) in a generate packet` · `docs/…/public-api-baselines.json:1 breaking change without major changeset [S-40] pnpm changeset (major)` |
| Latency / where | B–C · P, R |
| Needs | — |

### B.20 `db-apply`

| Row | Contract |
|---|---|
| Standards | S-01, S-02, S-13, S-17, S-18 |
| Inputs | `database/ddl/**`, `database/migrations/**`, `domain/*/db/**`, `database/seed/` manifest, `database/apply.sh`, `database/checks.sql`, `devai.json` `runtime`, `DEVAI_RUNTIME` |
| Population | `no database/` |
| Invokes | Preflight: `sh` (or the shebang's interpreter), `psql --version`, docker mode: `docker compose version`, `docker info` (07 §4; STYNX's local CI requires the daemon [fact: `stynx:scripts/ci-local/run.sh:72-75`]). Resolve: bare → `env:DATABASE_URL` (an admin URL on the declared server); docker → `docker compose up -d postgres` then the published port. Name: `devai_<digest12>`, `digest12` = first 12 hex of `sha256(sorted input paths and contents ‖ runtime mode ‖ a per-run nonce)`; the nonce lives only in memory and in the descriptor `.devai/cache/scratch/<digest12>.json`. Via `pg` 8.23.1: `CREATE DATABASE devai_<digest12>`; on `42P04 duplicate_database`, reuse only when a descriptor of this repository names it with the same input digest (edit loop), else `UNKNOWN: scratch-collision` and never `DROP` (Astra). Then host `sh -x database/apply.sh` with `DATABASE_URL=<scratch url>` and the same connection as `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` (the script puts no URL on argv, so the xtrace never prints credentials; 09 §1) and `PSQL="psql -v ON_ERROR_STOP=1"` (the form STYNX uses [fact: `stynx:scripts/db-verify.mjs:11`]); the xtrace on stderr names every `psql … -f <file>` and is the file-run census; then `psql -v ON_ERROR_STOP=1 -f database/checks.sql`; then `stynx verify-rls-negative --json --ddl <roots>` (published entry point; `--ddl` takes comma-separated roots, `*` matching one directory, default `database/ddl` [fact: `stynx verify-rls-negative --help`, engine `P:@stynx-nyx/cli@3.0.0/engines/rls-negative.mjs:4-18`; D-089]); then the schema digest (C.4 canonical form) read through `pg` queries. Cleanup: the database is dropped **after every consumer** (`sql-typed` DB, `spec-tests`, `integration`, `review` counterexamples) at command end under `--full`, also on failure; in the edit loop it is kept and recorded in the descriptor for reuse; `--prune` drops it. A failed drop sets `details.dropped: false`, keeps the descriptor so `--prune` retries, prints one stderr line, and does not change the node's status (the observation was complete). Both modes identical from here (D-011) |
| Observation | One observation = one applied SQL file; `expected` = files the root and seed manifests order; `observed` = files the xtrace shows `psql` ran; `evaluated` = files that completed with exit 0; `observed < expected` (a manifest file never reached) is `FAIL` |
| Status | `FAIL`: `psql` error (file:line from the server message), `checks.sql` assertion, RLS-negative violation, a role connecting as owner in `apply.sh` for app checks (S-18); `UNKNOWN`: `shell-missing`, `psql-missing`, `docker-unreachable` (remedy: start Docker), `postgres-unreachable (bare) — start PostgreSQL for the declared runtime; check DATABASE_URL and CREATE DATABASE privilege`, `CREATE DATABASE` privilege denied (`postgres-unreachable`), `scratch-collision`, `tooling-missing` (rls-negative) |
| Findings | `database/ddl/21-est-rls.sql:14 ERROR: <server message> [S-02] fix the statement` · `database/ddl/03-est-tables.sql:1 est.note: missing FORCE ROW LEVEL SECURITY [S-02] add FORCE in the same file` |
| Latency / where | C · P (SQL changed), R, F |
| Needs | `postgres` |

### B.21 `spec-tests`

| Row | Contract |
|---|---|
| Standards | S-61, S-63, S-65, S-67, D-051 |
| Inputs | The packet (`kind`, `observations.unimplemented`), the pinned spec (`base:` blob), `domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts` (04 §4, D-054), that file's `tsc -b` project closure from `inventory` (the module's sources and every project it references), `apps/*/src/**`, `test/support/**`, `db-apply`'s `schemaDigest`, `vitest.config.ts` (D-076) |
| Population | `no acceptance file for <spec id>` (05 §3) |
| Invokes | `vitest run --config vitest.config.ts --reporter <devai reporter module> -- <acceptance file>` with `TEST_TIER=acceptance`, `DATABASE_URL=<scratch url>`, `DEVAI_RUNTIME=<mode>`; the C.5 adapter |
| Observation | One observation = one top-level `it` whose name matches `^R-(\d+): ` in the derived file. `expected` = `acceptance: "yes"` requirements of the pinned spec; `observed` = such cases collected whose `R-n` is in the spec (a duplicate tag counts once and is a finding; a tag the spec does not know is a finding and not counted; a top-level `it` without a tag is a finding, 06 §5); `evaluated` = cases that reached a terminal state through their own body: `passed` (every assertion ran), or `failed` with an error classified **reached** (C.5: `name === 'AssertionError'` and the first source-mapped frame inside the acceptance file within the `it` body's line range; D-058) |
| Status | Collection error, import failure, `beforeAll`/`beforeEach` failure, app start-up or DB setup failure → `UNKNOWN: setup-failed` with the locator (02 §8). `FAIL`: `observed < expected` (`uncovered R-n`); foreign, duplicate or untagged top-level cases; any non-named case failed; a named expected-red case **passed** (06 §5: the claim is invalid); a case failed without reaching its assertion while not named. `UNKNOWN: expect-red-not-reached` when a named case failed outside its assertion (timeout, `TypeError`, helper error); `UNKNOWN: assertion-unresolved` when the failure carries no name or no source-mapped frame (D-058's "otherwise"). A reached assertion is sufficient because a named case carries no rail assertion (06 §5, D-058). `PASS` iff every non-named case passed and every named case failed at a reached assertion; the line reads `PASS spec-tests expected 6, observed 6, expect-red 3 (R-1, R-2, R-4)` (05 §3). Expected-red applies only when `kind: test` and the list is non-empty (D-051, PL-11) |
| Findings | `<file>:1 uncovered R-3, R-5 [S-65] add it('R-3: …')` · `<file>:<line> R-9 is not a requirement of <spec id> [S-63] remove or retag the case` · `<file>:<line> R-2: <assertion message> [S-61] make the behaviour hold` · `<file>:<line> R-1 expected red but passed [S-67] the behaviour exists or the case is vacuous` · `<file>:<line> R-4 failed before its assertion: <message> [S-67] fix the arrange step` |
| Latency / where | B–C · F, R |
| Needs | `postgres` |

### B.22 `integration`

| Row | Contract |
|---|---|
| Standards | tiers (04 §4), S-02, S-18, S-70 |
| Inputs | Affected `test/integration/*.integration.spec.ts`, `test/db/*.db.spec.ts`, their `tsc -b` project closure from `inventory`, `apps/*/src/**`, `test/support/**`, `db-apply`'s `schemaDigest`, `vitest.config.ts` (D-076) |
| Population | `no test/integration or test/db files affected` |
| Invokes | `vitest run --config vitest.config.ts --reporter <devai reporter module>` once per **populated** tier (`TEST_TIER=integration` when integration files are affected, `TEST_TIER=db` when db files are; never an empty tier run), with `DATABASE_URL=<scratch url>` and `DEVAI_RUNTIME`; no test may start testcontainers (02 §6; STYNX's helper does today [fact: `stynx:packages/testing/src/create-test-app.ts:3,31-38`]) |
| Observation | As `unit` (one observation = one case that ran; a skipped or pending case is a shortfall `FAIL`, D-081); the template-emitted cases are part of the population and their absence is a shortfall `FAIL`: RLS isolation observed as `<product>_app` (S-18), a request without `X-Request-Id` or with a non-UUIDv7 id is rejected with 400, and an id-less `GET`/`HEAD` on `/healthz` or `/readyz` is served (S-70, D-072; STYNX rejects a missing id since SM-15 and exempts only those probes [fact: `stynx:packages/core/src/core.module.ts:55`, `stynx:packages/core/src/request-id-rejection.ts:20-38`]) |
| Status | As `unit`; plus `UNKNOWN: postgres-unreachable`, `prerequisite-failed` (db-apply); a suite that connected as owner for an isolation assertion is `FAIL` [S-18] |
| Findings | `<file>:<line> <fullName>: <message> [S-02\|S-18\|S-70] fix the behaviour under the application role` |
| Latency / where | C · P (affected), R |
| Needs | `postgres` |

### B.23 `e2e`

| Row | Contract |
|---|---|
| Standards | tiers (04 §4) |
| Inputs | `test/e2e/**` (`*.e2e.spec.ts`, `*.playwright.ts`), `playwright.config.ts`, the apps |
| Population | `no test/e2e files` (05 §3) |
| Invokes | `playwright test --config playwright.config.ts --reporter json` (1.60.0); browsers must be provisioned beforehand (07 §5) |
| Observation | One observation = one test; `expected` = tests collected; `observed` = tests with a terminal status (`passed`, `failed`, `timedOut`, `skipped`, `interrupted`); `evaluated` = passed or failed; `timedOut` counts as failed, `interrupted` as not terminal |
| Status | `FAIL`: ≥ 1 failed or timed out; `UNKNOWN`: `browsers-missing` (remedy `pnpm exec playwright install`), app did not start (`setup-failed`), an interrupted run (`runner-crashed`), `tooling-missing` |
| Findings | `<file>:<line> <title>: <error message> [tiers] fix the flow` |
| Latency / where | C · R |
| Needs | — (the app's own services are the config's) |

### B.24 `permissions-pattern`

| Row | Contract |
|---|---|
| Standards | S-12 (D-009, D-025) |
| Inputs | The slice: mounted routes → global (`APP_GUARD`) and route (`@UseGuards`) guards → permission predicates and principal construction → transitive calls through concrete DI bindings, including `@stynx-nyx/*` package files resolved through their `exports` (`src/**` when shipped, else `dist/**.js`); the 02 §4 question text; the model id; `devai.json` `agentic.permissionsPattern` |
| Population | `no mounted routes` (no protected route exists) |
| Invokes | The reviewer command of the candidate's worker family (A.8), or, when no family resolves, the first configured reviewer in `Family` order (`claude`, then `gpt`; the evidence file's `model` records which ran; D-074), stdin transport (D-057), with 07 §6's flag lists and the event stream requested so that tool use is observable. Claude: `claude -p --output-format stream-json --verbose --json-schema <schema> --model <m> --no-session-persistence --setting-sources "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --tools "" --restricted`, the verdict taken from the final `result` event's `structured_output` [fact: `--tools ""` disables all built-in tools, `--restricted` removes command-running tools and settings, `claude --help` 2.1.292 lines 254-258, 194-205, 41]; `--bare` is not passed: it limits authentication to `ANTHROPIC_API_KEY` or `apiKeyHelper`, so an OAuth-authenticated host would be `model-error`, and the flags above carry the isolation (D-101); Codex: `codex exec --json --output-schema <file> --model <m> --ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check --cd <empty scratch dir> --sandbox read-only -`, the verdict taken from the final agent message after `turn.completed` [fact: `codex exec --help` 0.163.0 lines 13-15, 53-56, 90-100, 108]. Wall time 120 s. **No tools is enforced, then checked** (D-082): Claude `--tools ""` removes every built-in tool and Codex `--sandbox read-only` with an empty `--cd` leaves nothing to act on; the stream is read as a second signal and must contain zero tool or command items, else `UNKNOWN: tool-use-observed`; a CLI that rejects the enforcement flags, or whose stream cannot show tool items, is `UNKNOWN: capability-missing` (07 §6). No temperature control: determinism is the verdict cache (D-058) |
| Observation | One observation = one inspected entrypoint; `expected` = mounted protected routes; `observed` = `inspectedEntrypoints` ∩ inventory; `evaluated` = `observed` with every locator validated. Bound: `ceil(utf8Bytes(slice + question) / 3.5)` ≤ `maxInputTokens` before the call, an admission estimate only (D-058; the first real call's reported usage is recorded by 12 as calibration); after the call the CLI-reported input tokens are binding: > bound, or usage absent → `UNKNOWN: input-bound-exceeded`; reported output tokens > 2000 → `UNKNOWN: output-bound-exceeded` (02 §4) |
| Status | `PASS` iff `verdict: compliant`, `unresolved` empty, every locator valid, `observed = expected`, `confidence ≥ minConfidence`; `FAIL` iff `verdict: violation` with ≥ 1 valid finding; else `UNKNOWN` (`slice-too-large` with the file list, `missing-source`, `mount-unresolved`, `schema-invalid`, `model-error`, `timeout`, `verdict-unknown`, `tool-use-observed`, `capability-missing`, `no-reviewer-configured`, `family`, `stale`); message `permissions-pattern UNKNOWN (<reason>): <10 §4 hint>` Cache key: the general C.4 key plus slice digest, prompt digest and model id (D-076); only `PASS` cached. Under `--packet --full` the validated output is also written to `.devai/review/<packet-id>.permissions.json` bound to the slice digest and recording the `minConfidence` in force (02 §11, D-058, D-083); CI recomputes the slice digest from the PR head, never calls a model, and reports the file's verdict as `cached: true` when the digests match, the file's `minConfidence` equals the PR head's `devai.json` value and `output.confidence ≥` it; else `UNKNOWN: stale` |
| Findings | `<path>:<line> <statement> — <evidence> [S-12] decide from the token principal` from the model's validated `findings[]` |
| Latency / where | C + tokens · F, R (R verifies the evidence digest only) |
| Needs | `model` |

### B.25 `protected-paths`

| Row | Contract |
|---|---|
| Standards | S-63; D-019, D-027, D-031, D-046 |
| Inputs | `git diff --name-only --no-renames <base> HEAD` ∪ working-tree adds/deletes/untracked (old **and** new paths, 02 §5), `devai.json` `protected` (template default = 02 §5 table incl. `database/migrations/**` ∈ `infra`), the packet's `protected` list **as committed at the packet's introducing commit** (`git show <introducing>:<path>`, the blob B.26 reads for PL-13; when `--packet`; D-078) |
| Population | Always applies |
| Invokes | `git diff`, `git ls-files`; `ignore` 7.0.5 one matcher per class (gitignore 2.22.1 semantics [fact: `P:ignore@7.0.5/node_modules/ignore/README.md:16`; `ignores()` at `index.d.ts:54`]) |
| Observation | One observation = the classification of the whole diff; `expected` = 1; `observed` = 1 when the diff was acquired; `evaluated` = 1 when every changed path was classified (an empty diff is a complete, successful classification, not zero observations). Touched paths are `details.touched`, not the count |
| Status | `PASS` when evaluated (it is a notice, never a refusal, 02 §5); `UNKNOWN: base-unreadable` when the base is not fetched. `details.touched = [{ class, paths, declared }]`; `declared: false` is what the Action turns into `protected:unplanned` (PL-08) and what makes `review` gating (D-028); a class first declared inside the branch is `declared: false` (D-078) |
| Findings | None; the text report prints `protected:infra — database/ddl/21-est-rls.sql (packet declares: yes)` per class touched |
| Latency / where | A · P (notice), R (label) |
| Needs | — |

### B.26 `packet-scope`

| Row | Contract |
|---|---|
| Standards | 05 §5 PL-01–PL-07, PL-09, PL-11, PL-13, PL-14, PL-17; 06 §4 SL09–SL11; D-052, D-054 |
| Inputs | The packet file, the packet's bytes at its introducing commit (`git show <introducing>:<path>`, PL-13), the global packet-id population (`packets/**` at HEAD plus untracked, PL-02), `base:` blobs of `spec.path` and every changed `specs/**` file, the candidate spec bytes, the changed-path set (`--no-renames`, adds/deletes/untracked), `git merge-base`, `git log --diff-filter=A` for the introducing commit, `.devai/review/<id>.json` history in `base..HEAD` plus the working copy, `generation-manifest.json` paths |
| Population | Always applies under `--packet`; without a packet the node is deferred, not `SKIPPED` (D-044, D-058) |
| Invokes | `git`, `yaml` 2.9.0, zod (packet front matter, closed), `ignore` 7.0.5 — one `allowed` matcher, one `forbidden` matcher; changed ⊆ allowed and changed ∩ forbidden = ∅, forbidden wins (D-052) |
| Observation | One observation = one changed path (PL-07) plus one per PL/SL rule; `expected` = changed paths excluding `.devai/review/<id>.json` and `.devai/review/<id>.permissions.json` + rules; `observed` = paths matched + rules executed; `evaluated` = `observed` |
| Status | PL-01, PL-02, PL-03, PL-06, PL-14 and the "does not exist at base"/"not an ancestor" branches of PL-04/PL-05 run before the DAG and end the command with exit 2 (`packet-invalid`, `base-not-ancestor`); every other rule is a `FAIL` finding (05 §5); SL09 (= PL-17) and SL10 (= PL-04 digest) here because only this node has `base` (D-054); SL11 = PL-11 membership. `UNKNOWN: base-unreadable` |
| Findings | 05 §5's messages verbatim, locator = the packet path or the changed path, e.g. `out of scope: apps/api/src/app.module.ts (edit paths.allowed to widen, then re-run) [05 PL-07]` |
| Latency / where | A · F, R |
| Needs | — |

### B.27 `review`

| Row | Contract |
|---|---|
| Standards | S-64, S-66; D-003, D-028, D-035, D-037, D-042 |
| Inputs | Candidate digest, `specSha256` blob (pinning kinds), the packet (dispositions included), the current `report.json`, the diff `base..candidate`, the reviewer argv prefix, the 02 §9 prompt (≈ 700 tokens), the model id; worker family from `Co-Authored-By` trailers of `base..HEAD` (each trailer: `/\bclaude\b/i` → `claude`, `/\b(gpt|codex|openai)\b/i` → `gpt`, else unknown; the range's family is the one value every trailer resolves to, otherwise mixed; D-079) |
| Population | Always applies under `--packet --full` (every kind, 05 §3); otherwise deferred, not `SKIPPED` (D-058) |
| Invokes | Two invocations of the other-family CLI, stdin transport, 07 §6 flags. **Phase 1** (blind by construction), by kind (05 §3, 06 §5): pinning kinds → the pinned spec + resolved `sources[]` + public contracts; `kind: spec` → the business sources the packet's `context` and the spec's `sources[]` cite, **without** the candidate spec; `kind: standards` → the 03 Part A rows the packet's `## Deliverables` names, without the diff. Claude with `--tools ""`, Codex with `--cd <empty dir>`; output = the frozen `requirements[]` list (for `spec`/`standards`: the kind's deliverable obligations as `R-n`) validated by `ReviewPhase1` (C.2); prompts are 10 §3. **Phase 2**: cwd = `.devai/cache/scratch/<digest>/worktree`, a throwaway copy of the detached worktree at the candidate digest; prompt = phase-1 list + packet + `report.json` + diff (for `spec`: + the candidate spec); Claude `--restricted --tools Read,Grep,Glob,Bash --allowedTools "Read,Grep,Glob,Bash(git log:*),Bash(git diff:*),Bash(git show:*),Bash(node:*),Bash(pnpm exec vitest:*),Bash(psql:*)" --disallowedTools Edit,Write,NotebookEdit,WebFetch,WebSearch --settings '{"sandbox":{"enabled":true,"allowUnsandboxedCommands":false,"network":{"allowedDomains":[],"strictAllowlist":true}}}' --output-format stream-json --verbose` (Claude Code ≥ 2.1.219); Codex `--sandbox workspace-write --cd <scratch worktree> --json`, whose sandbox confines writes to that directory and denies network. Isolation is **enforced by the host CLI, then checked** (D-082; D-058, 07 §6): Claude's sandbox confines Bash children to the scratch copy with no route out and the remaining file tools are read-only by construction; Codex's sandbox does the same for its commands, and DEVAI records that network isolation there is the sandbox's. The stream is the second signal: it must show no write outside the scratch copy and no network item, and the tool-call budget is counted from it; a CLI that rejects an enforcement flag, lacks the sandbox, or cannot show tool items → `UNKNOWN: capability-missing`. Scratch DB from `db-apply`'s digest when present. `structured_output` / final agent message after `turn.completed` extracted and validated with the zod definition that emitted the schema argument (D-057): `ReviewModelOutput` in phase 2 |
| Observation | One observation = one `acceptance: yes` requirement (or one deliverable obligation for `spec`/`standards`); `expected` = those in the pinned spec / phase-1 list; `observed` = `requirements[]` entries returned in phase 2 whose id is in the phase-1 list (a duplicate counts once, a foreign id is dropped); `evaluated` = entries with `implemented` and `tested` set and ≥ 1 valid locator. Budget: ≤ 150k input tokens (proxy `bytes/3.5` on both phase prompts before the call; CLI-reported usage after, missing usage → `input-bound-exceeded`), ≤ 4k output (`output-bound-exceeded`), ≤ 20 tool calls counted from the stream across both phases, ≤ 5 min total. At the 21st call or at 300 s the process is terminated |
| Status | `UNKNOWN`: `family` (equal, unknown or mixed, D-079), `no-reviewer-configured`, `model-error`, `schema-invalid` (parse failure, invalid locator, or an inconsistent verdict: `blockers` with no `severity: blocker` finding, `no-blockers` with one), `verdict-unknown` (the model answered `unknown`), `review-incomplete` (`observed < expected` or an entry lacking `implemented`/`tested`, listing the unexamined ids), phase 2 terminated without output (`budget-exhausted`, every requirement unexamined), `input-bound-exceeded`, `output-bound-exceeded`, `capability-missing`, `stale` (CI: `review.json` `candidateDigest` ≠ PR head's digest). `basis: observed` requires `evidence` to carry the exact command and an output digest matching a command in the stream (02 §9), else it is downgraded to `derived`; counterexample-budget exhaustion leaves findings `derived` (D-042). Otherwise `PASS` (`no-blockers`), `FAIL` (`blockers`). Gating iff `review.mustRun` or `protected-paths` reports an undeclared class (derived, no stored flag, D-058); otherwise reported and tallied, exit code untouched (D-028). PL-10 applied to dispositions. Cache key: the general C.4 key (every prerequisite's `resultDigest`, `toolchainDigest` and `configDigest` included) plus candidate digest, `specSha256`, packet digest, prompt digest and model id (D-076) |
| Findings | `<locator> <statement> (R-n, <severity>, basis: <observed\|derived>) [S-66] fix or dispose with a contract-bound reason` plus `fingerprint = sha256(requirement ‖ locator path ‖ normalised statement)` written to `.devai/review/<packet-id>.json` with `workerFamily` and the `workerTrailers` it was derived from (02 §9 shape, D-079; excluded from the candidate digest, D-054) |
| Latency / where | C + tokens · F; R verifies the digest only |
| Needs | `model` |

### B.28 `accept`

| Row | Contract |
|---|---|
| Standards | S-65; D-005, D-047, D-051 |
| Inputs | Every other planned node's result (never its own), the deferred list, the packet `kind`, the spec machine block (`routes[]`, `queries[]`), the diff, `devai.json` `check.editLoopCeilingMs` and `review.mustRun`, `git log <base>` for PL-12, `packets/**` at HEAD for PL-16 |
| Population | Always applies; always executes; never cached; never blocked by a failed prerequisite (C.1 step 8 does not apply to it) |
| Invokes | Nothing |
| Observation | One observation = one planned node other than `accept`; `expected` = planned nodes − 1; `observed` = nodes with a status; `evaluated` = `observed`. Derives the required set from `kind` (05 §3 table) and applies PL-12, PL-15, PL-16; records class A/B wall time against the ceiling as `details.editLoopMs` (informational, D-047): the wall-clock span of the class A and B nodes that executed, cached hits excluded (D-084); lists the deferred nodes as `details.deferred` without a status (02 §8, D-058) |
| Status | `FAIL`: PL-15 (`required node skipped for kind: <kind>: <node> (<evidence>)`), PL-12, PL-16, or any gating `FAIL`; `UNKNOWN`: any gating `UNKNOWN` and no `FAIL`, carrying the first such node's `reason` verbatim (DAG order), so the report's top row says why the run is red without a new code (D-084), or a planned node without a status (`runner-crashed`); `PASS` otherwise. Exit code = 02 §8 (A.3). Zero-observation rewrite is applied by the runner before `accept` sees results |
| Findings | PL-12/15/16 messages verbatim from 05 §5 with the hint 05 prints; and, each with locator = the node id (D-084), one finding per gating `FAIL` (message `<node id> FAIL (<n> findings)`, `[S-65]`, hint `fix the findings of <node id>`), one per gating `UNKNOWN` (message `<node id> UNKNOWN (<reason>)`, `[S-65]`, hint `fix <node id> first`) and one per planned node without a status (message `<node id> has no status`, `[S-65]`, the 10 §4 `runner-crashed` hint) |
| Latency / where | A · all |
| Needs | — |

## Part C — runner, report, cache

[opinion] The runner is small on purpose: a topological walk over the fixed edge set of 02 §2, a worker pool, one rewrite rule and one report writer. v2's partition and aggregator design is not carried (02 §2); what is carried is v2's content-addressed, PASS-only cache discipline [fact: `devai:packages/cli/src/services/check-runner/cache.ts:143-146`, "Only PASS is ever reusable"], without hand-written input selectors.

### C.1 DAG runner

```text
plan(flags, packet?):
  1. preflight the command: devai.json valid; git repository; packet PL-01..03, 06, 14 and the
     pre-DAG branches of PL-04/05 (exit 2 with reason, nothing else runs).
  2. nodes := subset(flags) ∪ {inventory, accept} ∪ prerequisites(subset)      (02 §2 edges below)
       --packet: + packet-scope, spec-tests and their closure (db-apply, sql-typed(DB));
       --packet --full: every applicable node; --full alone: every node except the packet-bound
       three; --only: named + prerequisites. Nodes outside the plan are deferred (no row; accept
       lists them).
  3. edges := { inventory→*, db-apply→sql-typed(DB), sql-typed(DB)→spec-tests, sql-typed(DB)→integration,
               typecheck→route-contract, typecheck→openapi, route-contract→permissions-pattern,
               every deterministic node→review, permissions-pattern→review, *→accept }   (02 §2)
  4. candidateDigest₀ := digest(C.6; the index snapshot under --hook pre-commit); toolchainDigest
     from inventory.
run:
  5. run inventory alone. It marks each node APPLIES / SKIPPED(evidence) / UNKNOWN(prerequisite).
     If inventory is not PASS, every other node is prerequisite-failed (step 8); otherwise a SKIPPED
     (empty population) beats another prerequisite's failure (D-084).
  6. ready queue in topological order (Kahn); class A and B nodes run concurrently up to
     os.availableParallelism(); class C nodes and every `needs: postgres` node run one at a time
     after db-apply, because they share the scratch database; model nodes run alone. B–C nodes
     (deadcode, openapi, spec-tests) take the class-C lane (D-084).
  7. before a node: compute key (C.4); if a PASS result exists under that key → mark cached, skip
     (db-apply: only while its descriptor's database still exists; never under --full).
  8. a node whose prerequisite is FAIL or UNKNOWN is not run and is reported
     UNKNOWN reason prerequisite-failed, one finding per failed prerequisite
     `<id> prerequisite <id> is <STATUS> [02 §2] fix <id> first; this node did not run` (D-084;
     02 §2: never an omitted row). accept is exempt: it always runs over whatever results exist. review's prerequisites are
     the deterministic nodes and permissions-pattern, never accept.
  9. after a node: if status = PASS and observed = 0 → status := UNKNOWN reason no-observations,
     not cached (S-65). Only PASS is written to the cache.
 10. scratch cleanup after the last consumer (B.20); candidateDigest₁ := digest(C.6); if ≠
     candidateDigest₀ → report.reason candidate-changed, exit 2, cache entries written during the
     run are discarded; the report is printed but not written to reports/ (D-084).
 11. accept aggregates (B.28); report.json validated against C.2 and written (--full always;
     --format json always); text or JSON printed; exit code per A.3.
class partition (D-047, provisional): the edit-loop subset is classes A and B; a node whose warm
     p95 exceeds check.editLoopCeilingMs on the reference machine moves to class C in 02 §2's table
     by a decision, not by the runner; the runner only reports details.editLoopMs on accept.
CI (D-039, 02 §6): the Action runs the deterministic nodes as a job matrix per latency class in the
     declared mode; a PR touching devai.json, compose.yaml, scripts/ci-local/**, tools/** or the
     generator runs the `needs: postgres` nodes in both modes (DEVAI_RUNTIME=bare and =docker);
     a weekly run and every generator release run both; review and permissions-pattern are
     digest-verified from .devai/review/, never executed.
```

### C.2 `report.json` and the two evidence files — zod definitions (one report shape, D-056)

```ts
import { z } from 'zod';
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const Sha1 = z.string().regex(/^[0-9a-f]{40}$/);
const Count = z.number().int().nonnegative();
const Text = z.string().min(1);
export const NodeId = z.enum(['inventory','format','lint','lint-tests','typecheck','layout','sql-lint','spec-lint',
  'route-contract','sql-typed','unit','test-integrity','i18n','actionlint','commitlint','generated','boundary',
  'deadcode','openapi','db-apply','spec-tests','integration','e2e','permissions-pattern','protected-paths',
  'packet-scope','review','accept']);                                               // the 28 of 02 §2
export const Status = z.enum(['PASS', 'FAIL', 'UNKNOWN', 'SKIPPED']);
export const ReasonCode = z.enum([
  // could not run (command level)
  'config-invalid','not-a-repository','packet-invalid','base-not-ancestor','expect-red-nothing-named','no-report',
  'candidate-changed','usage','dir-not-empty','spec-not-approved','spec-invalid','spec-superseded','output-exists','spec-mismatch',
  'config-mismatch',
  // could not observe (node level)
  'no-observations','prerequisite-failed','tooling-missing','engines-mismatch','lint-config-failed','runner-crashed','timeout',
  'base-unreadable','io','parser-unavailable','adapter-unbound','unsupported-oid','unsupported-binding','mount-unresolved',
  'missing-source','postgres-unreachable','docker-unreachable','psql-missing','shell-missing','scratch-collision',
  'browsers-missing','setup-failed','expect-red-not-reached','assertion-unresolved','generator-version-mismatch',
  'generator-unavailable','catalog-unresolved','slice-too-large','input-bound-exceeded','output-bound-exceeded',
  'budget-exhausted','review-incomplete','tool-use-observed','capability-missing','schema-invalid','verdict-unknown',
  'model-error','no-reviewer-configured','family','stale',
]);
export const Finding = z.strictObject({
  locator: Text,                         // <path>:<line>[:<col>] or <path>:1
  message: Text,
  standard: Text,                        // 'S-27', '04 §2', '05 PL-07', 'tests', 'tiers' (02 §8: required)
  hint: Text.max(160),                   // one line (02 §8: required)
});
const Details = z.discriminatedUnion('node', [
  z.strictObject({ node: z.literal('inventory'), toolchainDigest: Sha256, populations: z.record(NodeId, z.strictObject({ predicate: Text, count: Count })) }),
  z.strictObject({ node: z.literal('sql-typed'), phase: z.enum(['static', 'db']), queries: z.array(z.strictObject({ name: Text, path: Text, textSha256: Sha256 })) }),
  z.strictObject({ node: z.literal('db-apply'), schemaDigest: Sha256, database: z.string().regex(/^devai_[0-9a-f]{12}$/), dropped: z.boolean() }),
  z.strictObject({ node: z.literal('spec-tests'), expectRed: z.array(z.string().regex(/^R-[1-9][0-9]*$/)), reached: z.array(Text), uncovered: z.array(Text) }),
  z.strictObject({ node: z.literal('permissions-pattern'), sliceDigest: Sha256, model: Text, inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(), proxyTokens: Count }),
  z.strictObject({ node: z.literal('review'), model: Text, verdict: z.enum(['no-blockers','blockers','unknown']), inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(), toolCalls: Count, unexamined: z.array(Text) }),
  z.strictObject({ node: z.literal('protected-paths'), touched: z.array(z.strictObject({ class: Text, paths: z.array(Text), declared: z.boolean().nullable() })) }),
  z.strictObject({ node: z.literal('accept'), requiredSet: z.array(NodeId), deferred: z.array(NodeId), editLoopMs: Count.nullable() }),
]);
export const NodeResult = z.strictObject({
  id: NodeId,
  status: Status,
  expected: Count, observed: Count, evaluated: Count,
  findings: z.array(Finding),
  reason: ReasonCode.optional(),         // UNKNOWN only
  evidence: z.string().optional(),       // SKIPPED only: inventory's population predicate string (D-044)
  durationMs: Count,
  cached: z.boolean(),
  cacheKey: Sha256.optional(),
  needs: z.array(z.enum(['postgres', 'model'])),
  details: Details.optional(),
}).superRefine((n, ctx) => {             // Astra's invariants, imported
  const bad = (m: string) => ctx.addIssue({ code: 'custom', message: `${n.id}: ${m}` });
  if (n.evaluated > n.observed) bad('evaluated > observed');
  if (n.status === 'PASS' && (n.observed === 0 || n.findings.length > 0)) bad('PASS needs observed > 0 and no findings');
  if (n.status === 'PASS' && (n.evaluated !== n.observed || n.observed !== n.expected)) bad('PASS needs evaluated = observed = expected');   // 08 §0 (D-077)
  if (n.status === 'FAIL' && n.findings.length === 0) bad('FAIL needs a finding');
  if (n.status === 'UNKNOWN' && !n.reason) bad('UNKNOWN needs a reason');
  if (n.status === 'SKIPPED' && (!n.evidence || n.observed !== 0 || n.expected !== 0)) bad('SKIPPED needs evidence and zero counts');
  if (n.cached && n.status !== 'PASS') bad('only PASS is reusable');
  if (n.cached && !n.cacheKey) bad('cached needs cacheKey');                                                            // C.4 (D-077)
  if (n.details && n.details.node !== n.id) bad('details belong to another node');
});
export const Report = z.strictObject({
  schemaVersion: z.literal('3'),
  command: Text,                         // the argv as run, e.g. "devai check --packet … --full"
  packetId: z.string().regex(/^PKT-[A-Z0-9]+-\d{3}$/).nullable(),
  kind: z.enum(['spec','generate','test','code','fix','standards']).nullable(),
  specId: Text.nullable(), specSha256: Sha256.nullable(),                 // null for spec/standards kinds and no-packet runs
  base: Sha1.nullable(),
  head: Sha1.nullable(), candidateDigest: Sha256.nullable(), toolchainDigest: Sha256.nullable(), // null only before acquisition (config-invalid, not-a-repository)
  runtime: z.enum(['bare', 'docker']).nullable(),
  accepted: z.boolean(),                 // true only on --packet --full with exit 0
  exitCode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  reason: ReasonCode.optional(),         // command-level could-not-run
  nodes: z.array(NodeResult),            // every planned node; prerequisite failures included; deferred nodes absent
  durationMs: Count,
}).superRefine((r, ctx) => {
  const bad = (m: string) => ctx.addIssue({ code: 'custom', message: m });
  if (new Set(r.nodes.map((n) => n.id)).size !== r.nodes.length) bad('duplicate node id');
  if (r.nodes.length > 0 && !r.nodes.some((n) => n.id === 'accept')) bad('accept row missing');
  if (r.accepted && (r.exitCode !== 0 || !r.packetId || !r.base || !r.candidateDigest || !r.toolchainDigest || !/\s--full(\s|$)/.test(r.command))) bad('accepted needs a full packet run with exit 0');
  if (r.exitCode === 2 && !r.reason && !r.nodes.some((n) => n.status === 'UNKNOWN')) bad('exit 2 needs a reason or an UNKNOWN row');
  if (r.exitCode === 1 && !r.nodes.some((n) => n.status === 'FAIL')) bad('exit 1 needs a FAIL row');
  if (r.reason && r.exitCode !== 2) bad('a command-level reason is exit 2');
  // D-077: candidate-independent acceptance invariants (08 §0, A.3, PL-15). `review` is exempt here because its gating is
  // derived from devai.json and protected-paths (D-028, D-058), which this schema cannot read; the runner enforces it.
  const other = r.nodes.filter((n) => n.id !== 'review');
  const accept = r.nodes.find((n) => n.id === 'accept');
  if (r.accepted) {
    if (r.nodes.length === 0) bad('accepted needs nodes');
    if (!accept || accept.status !== 'PASS') bad('accepted needs accept PASS');
    if (other.some((n) => n.status !== 'PASS' && n.status !== 'SKIPPED')) bad('accepted needs every node other than review PASS or SKIPPED');
    if (accept?.details?.node === 'accept') {
      for (const id of accept.details.requiredSet) {
        const row = r.nodes.find((n) => n.id === id);
        if (!row || row.status === 'SKIPPED') bad(`accepted needs required node ${id} present and not SKIPPED`);
      }
    }
  }
  if (r.exitCode === 0 && other.some((n) => n.status === 'FAIL' || n.status === 'UNKNOWN')) bad('exit 0 needs no FAIL or UNKNOWN row other than review');
  if (r.exitCode === 1 && !other.some((n) => n.status === 'FAIL') && !(r.nodes.some((n) => n.id === 'review' && n.status === 'FAIL') && !r.accepted)) bad('exit 1 needs a FAIL row other than review, or a gating review FAIL');
});
export type Report = z.infer<typeof Report>;

// The two tracked evidence files under .devai/review/ (02 §11), validated with the same definitions that emit the model schemas.
export const SensorOutput = z.strictObject({                                   // 02 §4 question's JSON
  verdict: z.enum(['compliant','violation','unknown']), inspectedEntrypoints: z.array(Text),
  findings: z.array(z.strictObject({ path: Text, line: z.number().int().positive(), statement: Text, evidence: Text })),
  unresolved: z.array(Text), confidence: z.number().min(0).max(1),
});
export const SensorEvidence = z.strictObject({                                 // .devai/review/<packet-id>.permissions.json (D-058)
  packetId: z.string().regex(/^PKT-[A-Z0-9]+-\d{3}$/), sliceDigest: Sha256, promptDigest: Sha256, model: Text,
  output: SensorOutput, inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(),
  minConfidence: z.number().min(0).max(1),                                      // the threshold in force when judged; CI re-applies the PR head's (D-083)
});
const ReviewShape = {                                                          // .devai/review/<packet-id>.json, 02 §9 shape
  packetId: z.string().regex(/^PKT-[A-Z0-9]+-\d{3}$/), head: Sha1, candidateDigest: Sha256, specSha256: Sha256.nullable(),
  requirements: z.array(z.strictObject({ id: Text, implemented: z.enum(['yes','no','partial']), tested: z.enum(['yes','no','weak']), locators: z.array(Text) })),
  findings: z.array(z.strictObject({ fingerprint: Sha256, severity: z.enum(['blocker','major','minor']), requirement: Text, locator: Text,
    statement: Text, evidence: Text, counterexample: Text.optional(), basis: z.enum(['observed','derived']), confidence: z.number().min(0).max(1) })),
  verdict: z.enum(['no-blockers','blockers','unknown']), inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(), model: Text,
  workerFamily: z.enum(['claude','gpt','unknown']), workerTrailers: z.array(Text),                                       // the declaration the reviewer was selected from (D-079)
};
export const Review = z.strictObject(ReviewShape).superRefine((v, ctx) => {                                                   // D-077: verdict ⇔ findings
  const blocker = v.findings.some((f) => f.severity === 'blocker');
  if (v.verdict === 'blockers' && !blocker) ctx.addIssue({ code: 'custom', message: 'verdict blockers needs a blocker finding' });
  if (v.verdict === 'no-blockers' && blocker) ctx.addIssue({ code: 'custom', message: 'verdict no-blockers with a blocker finding' });
});
export const ReviewPhase1 = z.strictObject({ requirements: z.array(z.strictObject({ id: Text, observable: Text, falsifier: Text })).min(1) });   // phase-1 model output (10 §3.1)
export const ReviewModelOutput = z.strictObject({ requirements: ReviewShape.requirements, verdict: ReviewShape.verdict, findings: z.array(ReviewShape.findings.element.omit({ fingerprint: true })) });   // phase-2 model output (10 §3.2); the runner adds fingerprint, digests, usage
```

[opinion] Gating is derived, not stored (D-058): a row gates unless it is `review` while `devai.json` `review.mustRun` is false and `nodes[protected-paths].details.touched` has no `declared: false` entry (`declared` is judged against the packet's `protected` at its introducing commit, D-078). The schema enforces the candidate-independent invariants (D-077); `accept` enforces the plan-aware ones with `devai.json` in hand, and `report.ts` stays byte-identical to this block. The summary prints `mustRun: <bool>` and `tallied` so the pilot can read the derivation; the exit code is computed from the same rule in A.3.

### C.3 Text report and `--summary` grammar

```text
report (--format text, ≤ 40 lines; 02 §8 example is an instance):
  line 1   devai check <args>   runtime=<mode>   base=<sha1[0:4]>…  head=<sha1[0:4]>…
           untracked: <path> (not in any commit)      ← only when the working-tree digest ≠ HEAD's tree digest; first untracked-not-ignored path (D-076)
  then     one block per node with status FAIL, then UNKNOWN, in DAG order:
             <STATUS padded 7>  <node padded 18>  <n> finding(s)   (expected <e> <unit>, observed <o>[, evaluated <v>])
             <6 spaces><locator>  <message>   [<standard>]  <hint>
             <6 spaces>UNKNOWN <node> <reason>: <10 §4 hint>      ← UNKNOWN row without a finding; command level: devai: <reason> — <hint>
  then     PASS  <n> nodes (<c> cached, <s> s)
  then     SKIPPED <n> nodes: <node>[<evidence>], …                 ← omitted when none
  then     deferred: <node>, …                                      ← omitted when none (02 §8)
  then     review  not run: <reason>  |  review  <verdict> (<n> findings; mustRun: <bool>[, tallied])
  then     devai <stage> <PASS|FAIL|UNKNOWN> — <10 §4 stage text>      ← --hook only
  last     exit <code>
  overflow: findings per node ≤ min(8, max(1, floor((40 − fixed lines) / failing nodes))); a node
           whose findings were cut ends with "+<k> more"; when even one finding per node does not
           fit, the lowest-priority nodes (UNKNOWN before FAIL, later DAG order first) collapse to
           their status line and the report ends with "+<n> more findings: .devai/cache/reports/<digest>.json".
           Machine findings are never dropped from report.json.
summary (--summary, ≤ 10 lines, becomes the PR body; 02 §8 example is an instance):
  1  <packetId>  <title>   spec <specId> @ <sha256[0:4]>… (frozen)        ← pinning kinds
     <packetId>  <title>   spec <specId> (candidate, <draft|approved>)     ← kind: spec
     <packetId>  <title>   standards                                       ← kind: standards
     line 2: <n> = every planned node, `accept` and SKIPPED included, as in report.json `nodes` (28 under `--packet --full`; D-073)
  2  acceptance: <PASS|FAIL|UNKNOWN> (<n> nodes: <p> pass, <s> skipped: <node>[<evidence>], …)   runtime: <mode>
  3  protected paths: none touched | <class> (<path>[, +k], declared|undeclared), …   packet scope: ok | <n> findings   spec tests: <o>/<e> requirements covered[, <k> expected red (R-…)] | deferred
  4  review: no blockers | blockers (<n>) | unknown (<reason>) (<m> minor, <d> disposed: …; mustRun: <bool>[, tallied])   worker: <family>   reviewer: <family>   bound to head <sha1[0:4]>…
  5–10  one line per gating FAIL/UNKNOWN node, FAIL first then DAG order: <node>: <first finding message>
        (only when acceptance ≠ PASS); at most six, the sixth line replaced by "+<k> more nodes" when more exist
```

[opinion] Seven readings of the grammar above (D-084): without a packet, line 1 prints `base=none`; `+<k> more` is appended to the node's last printed finding line; `+<n> more findings: …` is printed just before `exit <code>`, which stays the last line; `<s> s` on the PASS line is the whole run's wall time; a deferred `review` prints `review  not run: deferred`; `<unit>` is the unit each node's Part B Observation row names; `--summary` line 2 omits `, 0 skipped` when no node was skipped.

### C.4 Cache

| Item | Contract |
|---|---|
| Layout | `.devai/cache/nodes/<nodeId>/<key>.json` → `{ resultDigest }`; `.devai/cache/results/<resultDigest>.json` → `NodeResult`; `.devai/cache/reports/<candidateDigest>.json` → `Report`; `.devai/cache/agentic/<node>/<digest>.json` → the validated model output (verdict cache, 02 §11); `.devai/cache/scratch/<digest>/…` worktree and index copies and `<digest12>.json` scratch-DB descriptors. Gitignored; `rm -rf .devai/cache` always safe |
| Key | `sha256(nodeId ‖ nodeVersion ‖ toolchainDigest ‖ configDigest ‖ runtimeMode ‖ sortedInputDigests ‖ dependencyResultDigests)` (02 §2), every component length-framed as `<len>:<bytes>`; a component that is a list (`sortedInputDigests`, `dependencyResultDigests`) frames each element and then frames the concatenation again (D-084). `nodeVersion` = `<cliVersion>+<n>`, `n` the per-node integer in the table below, kept in each node's source file and bumped by the PR that changes the node's contract, which also edits its row (D-084); `configDigest` = the node's config files (`eslint.config.mjs`, `tsconfig*.json`, `vitest.config.ts`, `devai.json`…); `sortedInputDigests` = sha256 of each declared input (Part B "Inputs") as `<path>:<content sha256>`, the C.6 content hash, because an untracked file has no git blob (D-084); `dependencyResultDigests` = `resultDigest` of each prerequisite, in the plan's prerequisite order (D-084). DB-backed nodes use `schemaDigest` instead of `runtimeMode` (mode-independent by construction, 02 §2) and `sql-typed` adds `details.phase`, so a `static` PASS is never a `db` hit. Model nodes use the same key plus their model components: `permissions-pattern` adds slice digest, prompt digest, model id (B.24); `review` adds candidate digest, `specSha256`, packet digest, prompt digest, model id (B.27); so a `review` PASS falls with any prerequisite's `resultDigest`, `toolchainDigest` or `configDigest` (D-076) |
| `resultDigest` | `sha256` of the `NodeResult` JSON with `durationMs`, `cached` and `cacheKey` removed and `findings` sorted by locator then message (canonical key order); so a dependent's key does not change because a prerequisite was cached or took longer |
| `schemaDigest` | `sha256` over the sorted, length-framed rows of: `information_schema.columns` (schema, table, column, ordinal, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default) for non-system schemas; `pg_constraint` as `(schema, table, conname, pg_get_constraintdef(oid))`; `pg_indexes` (schema, table, indexname, indexdef); `pg_policies` (schema, table, policyname, permissive, roles, cmd, qual, with_check); `pg_proc` in non-system schemas as `(schema, name, pg_get_function_identity_arguments, pg_get_functiondef)`; `pg_class` (`relrowsecurity`, `relforcerowsecurity`) per table; `pg_roles` (`rolname`, `rolbypassrls`, `rolsuper`, `rolcanlogin`) for `<product>_{owner,app,reader}`; `information_schema.role_table_grants` for those roles. OIDs, owners, timestamps, statistics and the scratch database name are excluded; references are rendered as qualified names. Equal across modes by construction (D-039 both-mode runs compare it) |
| Reuse | Only `PASS`; the stored `NodeResult` is re-emitted with `cached: true` and its findings (none). `FAIL`, `UNKNOWN`, `SKIPPED` are never stored. `db-apply`'s PASS is reusable only while the descriptor's database exists and re-reads to the same `schemaDigest`; under `--full` it always executes, because its product is the database, not the verdict; a dropped database is a miss, never a PASS. `accept` and `inventory` are never reused |
| Invalidation | Any key component change; a prerequisite's `resultDigest` change; `candidate-changed` discards the run's writes; a corrupt or unparseable entry is a miss; `--prune` keeps the newest 200 entries per node by mtime and drops descriptor-named scratch databases |
| `.devai/review/` | Not a cache: `<packet-id>.json` (review) bound to the candidate digest and `<packet-id>.permissions.json` (sensor) bound to the slice digest and recording the `minConfidence` in force, both tracked and superseded by the next candidate; CI recomputes the digests from the PR head and otherwise reports `review: UNKNOWN (stale)` / `permissions-pattern: UNKNOWN (stale)`; the sensor file is also `stale` when its `minConfidence` differs from the PR head's `devai.json` or `output.confidence` is below it (D-037, D-058, D-083). A review-only commit leaves the candidate digest unchanged (C.6 excludes the folder), so the evidence survives being committed (Astra N-13; 05 §4's "a later commit changes the digest" holds for every other commit) |

`nodeVersion` integers (D-084; every node starts at 1 with R6 W1, devai-v3#55):

| Node | `n` | Node | `n` | Node | `n` | Node | `n` |
|---|---|---|---|---|---|---|---|
| `inventory` | 1 | `format` | 1 | `lint` | 1 | `lint-tests` | 1 |
| `typecheck` | 1 | `layout` | 1 | `sql-lint` | 1 | `spec-lint` | 1 |
| `route-contract` | 1 | `sql-typed` | 1 | `unit` | 1 | `test-integrity` | 1 |
| `i18n` | 1 | `actionlint` | 1 | `commitlint` | 1 | `generated` | 1 |
| `boundary` | 1 | `deadcode` | 1 | `openapi` | 1 | `db-apply` | 1 |
| `spec-tests` | 1 | `integration` | 1 | `e2e` | 1 | `permissions-pattern` | 1 |
| `protected-paths` | 1 | `packet-scope` | 1 | `review` | 1 | `accept` | 1 |

[opinion] The Vitest adapter classifies failures instead of trusting exit codes because expected-red is a claim about *where* a case failed, and neither the process exit code nor the collected count carries that (07 handoff). Vitest 4 hands a reporter each case's terminal result with its error object, and every `expect` matcher throws chai's `AssertionError` with a parsed stack; a failure with that name, raised from a frame inside the acceptance file within the `it` body, is a reached assertion, and anything else (a `TypeError` in the arrange step, a timeout, a helper throwing) is not. The classifier cannot tell a rail assertion from the behavioural one; it does not need to, because 06 §5 now rules that a named expected-red case carries no rail assertion (D-058), so the only assertion such a case can reach is the one about the missing behaviour. A failure the adapter cannot classify at all, because the error carries no name or no source-mapped frame, is `UNKNOWN: assertion-unresolved`.

[opinion] The reviewer's isolation is enforced by the host CLI's sandbox and tool denial and then checked in its stream; a working directory supplies none of it (D-082). Phase 1 runs with no tools and a prompt that contains no candidate bytes. Phase 2 runs in a scratch copy under the sandbox, and the stream is read for three things: tool calls (counted against the budget), writes (none outside the scratch copy) and network (none). A harness that cannot enforce the restriction, or cannot expose those facts in its stream, leaves the node `UNKNOWN: capability-missing` (D-058, D-082, 07 §6); the real candidate's digest is re-taken after the run as a second check (C.1 step 10). A finding confirmed by execution is `observed` only when its command appears in the stream with the output digest the finding cites.

### C.5 Vitest adapter (used by `unit`, `spec-tests`, `integration`)

```text
A Reporter module (Vitest 4.1.11 `Reporter`: onTestModuleCollected, onTestCaseResult, onTestRunEnd
[fact: reporters.d.DtoKVV2s.d.ts:1069,1087,1061]) writing one JSON line per event to a file the runner passes
by path; the runner never parses Vitest's console output.
  collected(module): every TestCase (name, location.line [d.ts:134,158]) → expected/observed accounting.
  result(testCase): TestResult.state passed|failed|skipped|pending [d.ts:354-396]; skipped/pending are terminal
    but not observations (shortfall, D-081); for failed, errors[0] is a TestError { name, message, stacks[] }
    [@vitest/utils types.d.ts:19-32].
  reached(testCase) := state === 'failed' && errors[0].name === 'AssertionError'      (chai's, thrown by every
    expect matcher [fact: @vitest/expect dist/index.js:1179,1211]) && stacks[0].file === the acceptance file
    && stacks[0].line within the `it` body range (TS AST, test-integrity's parser).
  unresolved(testCase) := state === 'failed' && (errors[0].name == null || stacks.length === 0)   → assertion-unresolved
  module import failure → its own event with the module path, mapped per node (D-074): `unit` and `integration` FAIL
    (B.11, B.22), `spec-tests` setup-failed (B.21);
  hook failure, worker crash → setup-failed with the module path; run end without
    onTestRunEnd, or a collected case with no result at run end → runner-crashed.
Rule the adapter relies on and 10's devai-test skill states (06 §5, D-058): a named expected-red case carries
no rail assertion; rail behaviour is its own R-n and stays green, as the fixture's R-3 does.
```

### C.6 Candidate digest

```text
candidateDigest = sha256 of the byte string:
  "base " + <packet base sha1 | "none">                                                   + "\n"
  for each entry in sorted(tracked ∪ untracked-not-ignored) by raw path bytes, excluding .devai/review/** and
  .devai/cache/**:
      <tag> + " " + <mode> + " " + <sha256> + " " + <len(path)> + ":" + <path bytes> + "\n"
        tag F  regular file     mode 100644|100755   sha256 of content
        tag L  symlink          mode 120000          sha256 of the link target bytes, never resolved
        tag G  gitlink          mode 160000          the recorded commit sha1 (the submodule's content is not hashed)
  for each path present in `git ls-tree -r <base>` and absent now, same exclusions:
      "D " + <len(path)> + ":" + <path bytes> + "\n"
Sources: working tree = `git ls-files -z` ∪ `git ls-files -z --others --exclude-standard`, content read from
disk; a tracked path missing from disk is a D entry; an unreadable path or a symlink whose target escapes the
repository is `io` (exit 2) — never hashed as empty; the escaping-symlink rule applies to the working tree only,
and an untracked nested repository (a `dir/` entry from `--others`) is `io` (D-084). Staged (--hook pre-commit):
entries from `git ls-files --stage -z`, content from the index blobs, deletions from `git diff --cached
--diff-filter=D`; an unmerged index entry (stage ≠ 0) is `io` (D-084). Commit (CI,
`packets status`): the same text from `git ls-tree -r <commit>`.
Computed before step 5 and after step 10 of C.1; a difference is candidate-changed (exit 2).
```

## Part D — what we are not building, and open items

[opinion] The list below is the brake applied to this document. Each line names the mechanism that would have needed the thing and says why it does not.

- **No plugin or node registry.** The 28 node ids are a closed zod enum (C.2); a new node is a new line in 02 §2 and a decision, not a drop-in file. v2's `test-tasks.json` (30 hand-maintained nodes) was the registry this replaces (assessment, phase 1).
- **No per-packet node allowlist, no `review: off`, no waiver, no stored gating flag.** The packet carries no node list (05 §2 "not fields"); `--only` never accepts; `review` is gated by `review.mustRun` at repository level and by an undeclared protected class, derived at read time (02 §8, D-028, D-058).
- **No retry, no model fallback, no first-entry fallback for `review`.** A model error, schema failure or timeout is one `UNKNOWN` with its reason; the agent re-runs. For `review`, unknown or equal family is `UNKNOWN (family)`; the sensor follows the reviewer selection, has no backend of its own (07 §6) and, when no family resolves, takes the first configured reviewer in `Family` order (D-074).
- **No network for models in CI.** CI verifies `review.json` and `<packet-id>.permissions.json` by digest; it never calls a model (D-037, D-058). The gitignored verdict cache does not travel; the tracked evidence file does.
- **No tokenizer, no temperature.** Bounds use `bytes / 3.5` as an admission estimate and the CLI's reported usage after the call (D-057, D-058); an over-run or missing usage is `UNKNOWN`, never `PASS`. Neither host CLI exposes a sampling temperature; 02 §4's phrase is struck and determinism is the verdict cache (D-058).
- **No DEVAI database, no state beyond 02 §11.** Scratch databases are named by input digest plus a run nonce and dropped after their consumers; descriptors are files under `.devai/cache/scratch/`; a name collision is `UNKNOWN`, never a `DROP` of something this run did not create.
- **No second reporter format, no colour, no TTY detection.** Text and JSON from the same `Report` object (07 §3); the Vitest adapter writes JSON lines, nothing human-facing.
- **No interactive prompt in `devai check`.** Every missing thing is a line with a remedy; the command never asks (01 "what the pilot is never asked").
- **No `devai doctor`, no `devai new app`, no `--staged`, no `--since-ref`, no `--strict`.** Preflight is a phase (A.6); the template is `devai init` (D-058); the hook stage selects the staged snapshot; posture is not a flag.
- **No `EXPLAIN` heuristic in `sql-typed`.** Struck from 08's obligations by D-058: the one report shape has no warning channel; whether 02 §3 step 3 becomes a finding or is dropped is 02's open, non-blocking item.
- **No i18n extraction, no catalog DB.** Parity over the generator's catalog files (path from 09) and the template lint rule (07 §5).
- **No Ajv, husky, pin file, isomorphic-git, provider SDK** (07 §7).

**Owner items.** None. Every divergence between the two round-4 drafts was ruled by D-058 or is a correction to an existing contract recorded in NOTES for its owning document.
