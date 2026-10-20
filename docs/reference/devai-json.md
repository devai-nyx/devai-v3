---
title: devai.json
sidebar_position: 5
description: Every key of devai.json as the 08 A.8 zod definition declares it, with constraints, template values and the nodes that read it.
---

# `devai.json`

> **Status:** DEVAI 3.0.0 is in development; this page describes the specified behaviour (docs/framework). Commands are not yet published.

`devai.json` is the one configuration file. It sits at the repository root, is checked in, belongs to protected class `standards`, and contains no executable configuration ([02 §6](../framework/02-architecture.md), [D-034](../../decisions.md)). Its definition is the zod object `DevaiConfig` in [08 A.8](../framework/08-cli-and-nodes.md); `packages/cli/src/config.ts` holds the same text byte for byte. `devai.schema.json` is emitted from it with `z.toJSONSchema(DevaiConfig)` at the DEVAI build ([D-056](../../decisions.md)). Refinements (`superRefine`) do not appear in the emitted JSON Schema.

**Counts:** 9 top-level keys, 20 key paths in all, 13 of them leaf settings. The objects are strict: an unknown key at any level is invalid. Every command validates the file first; an invalid file is exit 2 `config-invalid` ([08 Part A](../framework/08-cli-and-nodes.md)).

## Keys

"Template value" is what `devai init` writes ([09 §2](../framework/09-rail.md)).

| Key path | Type and constraint (zod) | Template value | Read by | Law |
|---|---|---|---|---|
| `$schema` | literal `https://devai.nyx/schema/devai.json/3` | same | every command | [D-034](../../decisions.md) |
| `productPrefix` | string `^[a-z][a-z0-9]*$` | from `--product` | `lint` (`devai/product-prefix`), `new module`, `packet new` (`PKT-<PRODUCT>-nnn`) | [D-032](../../decisions.md) |
| `locales` | array of canonical BCP 47 tags, ≥ 1; refined: first is `en-US`, no duplicates | from `--locales` (default `["en-US"]`) | `spec-lint`, `i18n`, `new module` | [D-014](../../decisions.md) |
| `lgpd` | boolean | from `--lgpd` (default `false`) | `sql-lint` (LINT012), `spec-lint`, `new module` | [D-014](../../decisions.md), S-15 |
| `runtime` | strict object | — | `resolveRuntime()`, `db-apply` | [02 §6](../framework/02-architecture.md), [D-011](../../decisions.md) |
| `runtime.mode` | `bare` \| `docker` | from `--runtime` (default `bare`) | every command; overridden per invocation by `DEVAI_RUNTIME=bare\|docker` | [D-034](../../decisions.md) |
| `runtime.services` | strict object | — | the runtime a node's `needs` resolves against | [02 §6](../framework/02-architecture.md) |
| `runtime.services.postgres` | strict object | — | `provide('postgres')` | [02 §6](../framework/02-architecture.md) |
| `runtime.services.postgres.bare` | string `^env:[A-Z][A-Z0-9_]*$` | `env:DATABASE_URL` | bare mode | [02 §6](../framework/02-architecture.md) |
| `runtime.services.postgres.docker` | string `^compose:[a-z][a-z0-9_-]*$` | `compose:postgres` | docker mode | [02 §6](../framework/02-architecture.md) |
| `protected` | record over the 7 classes → array of globs, each ≥ 1 glob | the seven [02 §5](../framework/02-architecture.md) glob sets (below) | `protected-paths`, PL-06 | [02 §5](../framework/02-architecture.md), [D-046](../../decisions.md) |
| `review` | strict object | — | — | [02 §9](../framework/02-architecture.md) |
| `review.mustRun` | boolean | `false` | gating of `review` (A.3), `accept` | [D-028](../../decisions.md) |
| `review.reviewers` | partial record `claude` \| `gpt` → non-empty string (reviewer argv prefix); refined: must start with `claude` or `codex`, and must be the other family | `{ claude: "codex exec --model gpt-6-astra", gpt: "claude -p --model claude-opus-5-5" }` | `review`, `permissions-pattern` | [D-037](../../decisions.md), [07 §6](../framework/07-dependencies.md) |
| `agentic` | strict object | — | — | [02 §4](../framework/02-architecture.md) |
| `agentic.permissionsPattern` | strict object | — | `permissions-pattern` | [02 §4](../framework/02-architecture.md) |
| `agentic.permissionsPattern.minConfidence` | number, 0.7 ≤ x ≤ 1 | `0.7` | `permissions-pattern` (`PASS` needs `confidence ≥ minConfidence`) | [02 §4](../framework/02-architecture.md) |
| `agentic.permissionsPattern.maxInputTokens` | integer, positive, ≤ 60000 | `60000` | `permissions-pattern` input bound | [02 §4](../framework/02-architecture.md) |
| `check` | strict object | — | — | [D-058](../../decisions.md) |
| `check.editLoopCeilingMs` | integer, positive | `90000` (provisional) | `accept` reports `details.editLoopMs` against it | [D-047](../../decisions.md), [D-058](../../decisions.md) |

## Validation rules

| Rule | Message | Where |
|---|---|---|
| A glob is repo-relative: no leading `/`, no `..`, no braces | `repo-relative gitignore glob, no braces` | `Glob` refine |
| A locale is canonical BCP 47 (`Intl.getCanonicalLocales(l)[0] === l`) | `canonical BCP 47 tag` | `Locale` refine |
| `locales[0]` is `en-US` | `en-US is the default locale (D-014)` | `superRefine` |
| No duplicate locale | `duplicate locale` | `superRefine` |
| A reviewer argv starts with `claude` or `codex` | `reviewer must start with claude or codex (07 §6)` | `superRefine` |
| A reviewer is the other family (`claude` → `gpt` key, `codex` → `claude` key) | `reviewer must be the other family (S-66)` | `superRefine` |

## Protected classes

`ProtectedClass` has 7 values: `spec`, `product`, `decisions`, `standards`, `infra`, `ci`, `acceptance`. The template fills all seven with the [02 §5](../framework/02-architecture.md) globs:

| Class | Template globs | PR label |
|---|---|---|
| `spec` | `specs/**`, `packets/**` | `protected:spec` |
| `product` | `product/**` | `protected:product` |
| `decisions` | `decisions.md`, `law/**` | `protected:decisions` |
| `standards` | `tools/**`, `eslint.config.*`, `tsconfig*.json`, `devai.json`, `.stynxrc.json`, `AGENTS.md`, `CLAUDE.md`, `.agents/**`, `.claude/skills/**` | `protected:standards` |
| `infra` | `infra/**`, `database/ddl/**`, `database/migrations/**`, `compose.yaml` | `protected:infra` |
| `ci` | `.github/**`, `scripts/**` | `protected:ci` |
| `acceptance` | `domain/*/api/test/acceptance/**`, `test/**` | `protected:acceptance` |

Protected paths are a labelling mechanism, never a refusal ([02 §5](../framework/02-architecture.md), [D-019](../../decisions.md)).

## Reviewer commands

`review.reviewers` values are argument-vector prefixes, split on whitespace, never a shell string. The runner appends the fixed flag list of [07 §6](../framework/07-dependencies.md). A model is chosen inside the prefix (`codex exec --model <m>`) or left to the CLI's default; `review.json` records the model the CLI reports. The same selection serves `permissions-pattern`; no field names a sensor backend, and there is no first-entry fallback ([08 A.8](../framework/08-cli-and-nodes.md)). The key is the *worker's* family, read from `Co-Authored-By` trailers; the value runs the other family ([02 §9](../framework/02-architecture.md)).

## The zod definition

Verbatim from [08 A.8](../framework/08-cli-and-nodes.md):

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

> The sample object in [02 §6](../framework/02-architecture.md) is abridged: it shows one protected class and no `check` key. 08 A.8 defines the keys as "exactly those 02 §6 shows plus `check.editLoopCeilingMs`", and requires all seven classes; a file shaped exactly like the 02 §6 sample would not validate.

Source: [08 A.8](../framework/08-cli-and-nodes.md), [02 §4, §5, §6, §9](../framework/02-architecture.md), [09 §2](../framework/09-rail.md), [07 §6](../framework/07-dependencies.md), [D-014](../../decisions.md), [D-032](../../decisions.md), [D-034](../../decisions.md), [D-047](../../decisions.md), [D-056](../../decisions.md), [D-058](../../decisions.md).
