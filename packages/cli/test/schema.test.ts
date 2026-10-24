// D-056: every artifact schema projects, and the committed projection equals a fresh one.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DevaiConfig } from '../src/config.js';
import { Report, Review, SensorEvidence } from '../src/report.js';
import { projections, render } from '../src/schema.js';

const root = resolve(import.meta.dirname, '..');

describe('schema projections (D-056)', () => {
  it('every artifact schema projects with z.toJSONSchema', () => {
    for (const s of [DevaiConfig, Report, Review, SensorEvidence]) expect(() => z.toJSONSchema(s, { io: 'input' })).not.toThrow();
  });
  it('committed devai.schema.json equals a fresh projection (run `pnpm project` after changing config.ts)', () => {
    for (const [rel, schema] of Object.entries(projections())) {
      expect(readFileSync(resolve(root, rel), 'utf8')).toBe(render(schema));
    }
  });
  it('the projection carries the $schema literal (D-034) and no superRefine constraint', () => {
    const s = JSON.stringify(projections()['schema/devai.schema.json']);
    expect(s).toContain('https://devai.nyx/schema/devai.json/3');
    expect(s).not.toContain('en-US is the default locale');
  });
});
