// Shared fixtures: the template devai.json (09 §1.1 row `devai.json`) and report builders.
import type { DevaiConfig } from '../src/config.js';

export const templateConfig = (): DevaiConfig => ({
  $schema: 'https://devai.nyx/schema/devai.json/3',
  productPrefix: 'demo',
  locales: ['en-US'],
  lgpd: false,
  runtime: { mode: 'bare', services: { postgres: { bare: 'env:DATABASE_URL', docker: 'compose:postgres' } } },
  protected: {                                                                   // 02 §5 table
    spec: ['specs/**', 'packets/**'],
    product: ['product/**'],
    decisions: ['decisions.md', 'law/**'],
    standards: ['tools/**', 'eslint.config.*', 'tsconfig*.json', 'devai.json', '.stynxrc.json', 'AGENTS.md', 'CLAUDE.md', '.agents/**', '.claude/skills/**'],
    infra: ['infra/**', 'database/ddl/**', 'database/migrations/**', 'compose.yaml'],
    ci: ['.github/**', 'scripts/**'],
    acceptance: ['domain/*/api/test/acceptance/**', 'test/**'],
  },
  review: { mustRun: false, reviewers: { claude: 'codex exec --model gpt-6-astra', gpt: 'claude -p --model claude-opus-5-5' } },
  agentic: { permissionsPattern: { minConfidence: 0.7, maxInputTokens: 60000 } },
  check: { editLoopCeilingMs: 90000 },
});

export const SHA256 = 'a'.repeat(64);
export const SHA1 = 'b'.repeat(40);
export const finding = { locator: 'x.ts:1', message: 'm', standard: 'S-1', hint: 'h' };

export const node = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, status, expected: 1, observed: 1, evaluated: 1, findings: [], durationMs: 1, cached: false, needs: [], ...extra,
});
export const acceptRow = (requiredSet: string[] = ['unit']) =>
  node('accept', 'PASS', { details: { node: 'accept', requiredSet, deferred: [], editLoopMs: null } });

export const fullReport = (nodes: unknown[], extra: Record<string, unknown> = {}) => ({
  schemaVersion: '3', command: 'devai check --packet packets/CMP-DEMO-001/PKT-DEMO-004.md --full',
  packetId: 'PKT-DEMO-004', kind: 'code', specId: 'SPEC-DEMO-001', specSha256: SHA256, base: SHA1, head: SHA1,
  candidateDigest: SHA256, toolchainDigest: SHA256, runtime: 'bare', accepted: true, exitCode: 0, durationMs: 1, nodes, ...extra,
});
