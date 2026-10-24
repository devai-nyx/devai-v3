import { defineConfig } from 'vitest/config';

// test/tsconfig.json turns on legacy decorators, as the generated module tsconfig does (09 §6).
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
