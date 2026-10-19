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
