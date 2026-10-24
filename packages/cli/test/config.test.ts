// 08 A.8: the template devai.json validates; the refinements reject what the law names.
import { describe, expect, it } from 'vitest';
import { DevaiConfig } from '../src/config.js';
import { templateConfig } from './fixtures.js';

describe('DevaiConfig (08 A.8)', () => {
  it('accepts the 09 §1.1 template value', () => expect(DevaiConfig.safeParse(templateConfig()).success).toBe(true));
  it('requires en-US first (D-014)', () => {
    const c = templateConfig(); c.locales = ['pt-BR', 'en-US'];
    expect(DevaiConfig.safeParse(c).success).toBe(false);
  });
  it('rejects a reviewer of the same family (S-66) and an unknown binary (07 §6)', () => {
    const same = templateConfig(); same.review.reviewers = { claude: 'claude -p' };
    const other = templateConfig(); other.review.reviewers = { claude: 'gemini -p' };
    expect(DevaiConfig.safeParse(same).success).toBe(false);
    expect(DevaiConfig.safeParse(other).success).toBe(false);
  });
  it('rejects brace globs in protected classes (07 §3)', () => {
    const c = templateConfig(); c.protected.ci = ['.github/{workflows,actions}/**'];
    expect(DevaiConfig.safeParse(c).success).toBe(false);
  });
  it('rejects unknown keys (strict, D-034)', () => {
    expect(DevaiConfig.safeParse({ ...templateConfig(), extra: 1 }).success).toBe(false);
  });
  it('keeps minConfidence at or above 0.7 (02 §4)', () => {
    const c = templateConfig(); c.agentic.permissionsPattern.minConfidence = 0.5;
    expect(DevaiConfig.safeParse(c).success).toBe(false);
  });
});
