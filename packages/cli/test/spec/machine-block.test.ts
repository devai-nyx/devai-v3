// 06 §2 machine block and 06 §3 use case as zod definitions; the 07 §3 YAML reader. The template
// fixture (06 §7, 10,035 bytes, sha256 12e9041f…) and its use case are the positive oracle.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MachineBlock, readSpec, routePattern, UseCase } from '../../src/spec/machine-block.js';

const template = resolve(import.meta.dirname, '../../template');
const specBytes = readFileSync(resolve(template, 'specs/notes/SPEC-DEMO-001.md'));
const spec = specBytes.toString('utf8');
const useCase = JSON.parse(readFileSync(resolve(template, 'product/use-cases/UC-DEMO-001.json'), 'utf8')) as unknown;

const block = (yaml: string) => `# X\n\n## Purpose\n\n## Scope\n\n## Contract\n\n\`\`\`yaml\n${yaml}\n\`\`\`\n\n## Contract notes\n\n## Acceptance notes\n\n## Open questions\n\nNone.\n`;
const valueOf = (text: string) => {
  const r = readSpec(text);
  if (r.kind !== 'document') throw new Error(JSON.stringify(r.problems));
  return r.value as Record<string, unknown>;
};
const fixture = () => structuredClone(valueOf(spec)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const issues = (v: unknown) => {
  const r = MachineBlock.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('the template fixture', () => {
  it('is the 06 §7 body (10,035 bytes, sha256 12e9041f…)', () => {
    expect(specBytes.length).toBe(10035);
    expect(createHash('sha256').update(specBytes).digest('hex')).toBe('12e9041f6e1637b7e3a55d7e2626b11725381b40f8d5392e32458f6233f7f30a');
  });
  it('SPEC-DEMO-001 parses: one block under ## Contract, every required section, the closed schema', () => {
    const r = readSpec(spec);
    expect(r.kind).toBe('document');
    if (r.kind !== 'document') return;
    expect(r.problems).toEqual([]);
    const parsed = MachineBlock.parse(r.value);
    expect(parsed).toMatchObject({ id: 'SPEC-DEMO-001', status: 'approved', 'approved-by': 'DemoPilot', module: { name: 'Notes', slug: 'notes', namespace: 'demo_notes' } });
    expect(parsed.routes.map((x) => `${x.method} ${x.path}`)).toEqual(['POST /notes', 'GET /notes/:id']);
    expect(parsed.requirements).toHaveLength(6);
    expect(parsed.unimplemented.map((u) => u.requirement)).toEqual(['R-1', 'R-2', 'R-4']);
    // positions are the spec file's lines
    const lines = spec.split('\n');
    expect(lines[r.lineOf(['id']) - 1]).toBe('id: SPEC-DEMO-001');
    expect(lines[r.lineOf(['routes', 1, 'slo']) - 1]).toContain('maxMs: 250');
    expect(lines[r.lineOf(['data', 'tables', 0, 'columns', 3]) - 1]).toContain('- name: author_alias');
  });
  it('UC-DEMO-001 parses', () => {
    expect(UseCase.parse(useCase)).toMatchObject({ id: 'UC-DEMO-001', actor: { roles: ['demo-member'] } });
  });
});

describe('07 §3 YAML reading: malformed readable input', () => {
  const problems = (yaml: string) => {
    const r = readSpec(block(yaml));
    return r.kind === 'malformed' ? r.problems.map((p) => p.reason) : [];
  };
  it('rejects aliases, tags, non-string keys and duplicate keys', () => {
    expect(problems('a: &x 1\nb: *x')).toContain('alias');
    expect(problems('a: !!str 1')).toContain('tag tag:yaml.org,2002:str');
    expect(problems('a: !custom 1').some((p) => p.startsWith('tag !custom'))).toBe(true);
    expect(problems('1: x')).toContain('non-string key');
    expect(problems('true: x')).toContain('non-string key');
    expect(problems('a: 1\na: 2').some((p) => /unique/i.test(p))).toBe(true);
    expect(problems('a: [1, 2').length).toBeGreaterThan(0);
  });
  it('YAML 1.2 core: yes stays a string, so acceptance must be the quoted enum', () => {
    expect(readSpec(block('a: yes'))).toMatchObject({ kind: 'document', value: { a: 'yes' } });
  });
  it('exactly one yaml block, under ## Contract; every required section', () => {
    const two = block('a: 1').replace('## Contract notes', '```yaml\nb: 2\n```\n\n## Contract notes');
    expect(readSpec(two)).toMatchObject({ kind: 'malformed' });
    const outside = block('a: 1').replace('## Scope', '## Scope\n\n```yaml\nb: 2\n```');
    expect((readSpec(outside) as { problems: { reason: string }[] }).problems.map((p) => p.reason)).toContain('yaml block outside ## Contract');
    const r = readSpec(block('a: 1').replace('## Acceptance notes\n', ''));
    expect(r.problems.map((p) => p.reason)).toEqual(['missing section ## Acceptance notes']);
  });
});

describe('06 §2 closed schema and refinements', () => {
  it('no additional keys at any level, no coercion', () => {
    const v = fixture();
    v.extra = 1;
    v.routes[0].slo.unit = 'ms';
    v.routes[0].slo.maxMs = '500';
    expect(issues(v)).toEqual(expect.arrayContaining([expect.stringMatching(/^: Unrecognized key/), expect.stringMatching(/^routes\.0\.slo: Unrecognized key/), expect.stringMatching(/^routes\.0\.slo\.maxMs: /)]));
  });
  it('acceptance is the string enum, never a boolean', () => {
    const v = fixture();
    v.requirements[0].acceptance = true;
    expect(issues(v)[0]).toMatch(/^requirements\.0\.acceptance/);
  });
  it('uniqueness by superRefine: requirement ids, route patterns (parameter names erased), roles', () => {
    const v = fixture();
    v.requirements[1].id = 'R-1';
    v.routes[1].method = 'POST';
    v.routes[1].path = '/notes';
    v.routes[0].roles = ['demo-member', 'demo-member'];
    expect(issues(v)).toEqual(expect.arrayContaining(['requirements.1.id: duplicate requirement R-1', 'routes.1.path: duplicate route POST /notes', 'routes.0.roles: duplicate role']));
    expect(routePattern('GET', '/a/:id')).toBe(routePattern('GET', '/a/:other'));
  });
  it('the use case is closed and its sets are unique', () => {
    expect(UseCase.safeParse({ ...(useCase as object), extra: 1 }).success).toBe(false);
    expect(UseCase.safeParse({ ...(useCase as object), rules: ['RN-DEMO-001', 'RN-DEMO-001'] }).success).toBe(false);
  });
});
