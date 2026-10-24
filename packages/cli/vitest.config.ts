import { defineConfig } from 'vitest/config';

// 12 §5: R6 adds the CLI's own tests; integration tests spawn dist/main.js, so `build` runs first (ci.yml).
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 } });
