// S-40: conventional commits; scopes are computed at load from the workspace (09 §1.1, E-5-09).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const folders = (dir) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
const nameOf = (dir) => {
  try {
    return JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).name;
  } catch {
    return undefined;
  }
};
const modules = folders('domain');
const packages = [
  ...folders('apps').map((app) => `apps/${app}`),
  ...modules.flatMap((m) => [`domain/${m}/api`, `domain/${m}/web`]),
]
  .map(nameOf)
  .filter((name) => typeof name === 'string');
const scopes = [...new Set([...packages, ...modules, 'template', 'packets'])].sort();

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', scopes],
    'header-max-length': [2, 'always', 100],
  },
};
