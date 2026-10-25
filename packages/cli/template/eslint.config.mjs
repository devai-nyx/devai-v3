// S-38: ESLint's flat config is a default export. Blocks by folder over the published STYNX profiles,
// then the DEVAI `devai/*` overlay (08 B.3) with this product's prefix from devai.json.
import { readFileSync } from 'node:fs';
import { createDevaiOverlay } from '@devai-nyx/cli/eslint-overlay';
import {
  createAngularConfig,
  createNestConfig,
  createScriptsConfig,
  createTestConfig,
} from '@stynx-nyx/eslint-config';

const devai = JSON.parse(readFileSync(new URL('./devai.json', import.meta.url), 'utf8'));

export default [
  ...createNestConfig({ files: ['apps/api/src/**/*.ts'], tsconfig: './apps/api/tsconfig.json' }),
  ...createNestConfig({
    files: ['domain/*/api/src/**/*.ts'],
    tsconfig: './domain/*/api/tsconfig.json',
  }),
  ...createAngularConfig({ files: ['apps/web/src/**/*.ts'], tsconfig: './apps/web/tsconfig.json' }),
  ...createAngularConfig({
    files: ['domain/*/web/src/**/*.ts'],
    tsconfig: './domain/*/web/tsconfig.json',
  }),
  ...createScriptsConfig({ files: ['scripts/**/*.mjs', 'tools/**/*.mjs', '*.mjs'] }),
  ...createTestConfig({
    files: [
      'test/**/*.ts',
      'apps/*/test/**/*.ts',
      'domain/*/*/test/**/*.ts',
      '*.ts',
      'tools/**/*.ts',
    ],
  }),
  ...createDevaiOverlay({
    productPrefix: devai.productPrefix,
    files: ['apps/*/src/**/*.ts', 'domain/*/*/src/**/*.ts'],
  }),
];
