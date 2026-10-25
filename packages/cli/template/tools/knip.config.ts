// S-42: knip's entry points per workspace package (08 B.18 runs it with --workspace <package>).
export default {
  workspaces: {
    'apps/api': { entry: ['src/main.ts'] },
    'apps/web': { entry: ['src/main.ts'] },
    'domain/*/api': { entry: ['src/index.ts'] },
    'domain/*/web': { entry: ['src/index.ts'] },
  },
};
