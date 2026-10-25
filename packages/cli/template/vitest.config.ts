// One root config (04 §4). TEST_TIER selects a tier; a tier is enabled iff its patterns match a file,
// so an empty tier never runs (S-62). SWC keeps Nest's decorator metadata (D-057).
import { globSync } from 'node:fs';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const tiers: Record<string, string[]> = {
  unit: ['domain/*/api/test/*.spec.ts', 'domain/*/web/test/*.spec.ts', 'apps/*/test/*.spec.ts'],
  acceptance: ['domain/*/api/test/acceptance/*.acceptance.spec.ts'],
  integration: ['test/integration/*.integration.spec.ts'],
  db: ['test/db/*.db.spec.ts'],
};

const tier = process.env['TEST_TIER'] ?? 'unit';
const patterns = tiers[tier];
if (patterns === undefined)
  throw new Error(`TEST_TIER=${tier}: expected one of ${Object.keys(tiers).join(', ')}`);
// The unit tier excludes acceptance files (D-054).
const files = patterns
  .flatMap((p) => globSync(p))
  .filter((f) => tier !== 'unit' || !f.endsWith('.acceptance.spec.ts'));
// D-105: web specs run in their own project, with the Angular test environment as setup file.
const isWeb = (f: string) => f.startsWith('domain/') && f.includes('/web/test/');
const web = files.filter(isWeb);
const rest = files.filter((f) => !isWeb(f));
const project = (name: string, include: string[], setupFiles: string[] = []) => ({
  extends: true,
  test: { name, include, setupFiles },
});

export default defineConfig({
  plugins: [
    swc.vite({
      swcrc: false,
      configFile: false,
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
        keepClassNames: true,
      },
      module: { type: 'es6' },
    }),
  ],
  test:
    web.length > 0
      ? {
          passWithNoTests: false,
          projects: [
            ...(rest.length > 0 ? [project(tier, rest)] : []),
            project(`${tier}-web`, web, ['test/support/angular.setup.ts']),
          ],
        }
      : { include: files.length > 0 ? files : [], passWithNoTests: false },
});
