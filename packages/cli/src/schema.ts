// D-056: JSON Schemas are emitted from the zod definitions and committed; the build verifies the
// committed files equal a fresh projection (test/schema.test.ts). superRefine constraints do not project.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { DevaiConfig } from './config.js';

/** Committed path (relative to the package root) → projected JSON Schema. The use-case schema joins when 06 §2's zod definition lands (W2, spec-lint). */
export function projections(): Record<string, unknown> {
  return {
    'schema/devai.schema.json': z.toJSONSchema(DevaiConfig, { target: 'draft-2020-12', io: 'input' }),
  };
}

export const render = (schema: unknown): string => JSON.stringify(schema, null, 2) + '\n';

export function writeProjections(packageRoot: string): string[] {
  const written: string[] = [];
  for (const [rel, schema] of Object.entries(projections())) {
    const path = resolve(packageRoot, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, render(schema));
    written.push(rel);
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === 'write') {
  for (const rel of writeProjections(resolve(dirname(process.argv[1]), '..'))) process.stdout.write(`${rel}\n`);
}
