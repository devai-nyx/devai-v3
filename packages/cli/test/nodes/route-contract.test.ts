// 08 B.9 `route-contract` on a hand-written copy of 09 §6's notes module, mounted in `apps/api`, against
// the template's SPEC-DEMO-001 (06 §7). Real `stynx list-routes` from `@stynx-nyx/cli` 3.0.0.
import { chmodSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInventory } from '../../src/nodes/inventory.js';
import { workingTree } from '../../src/candidate/digest.js';
import { plan } from '../../src/runner/plan.js';
import { templateConfig } from '../fixtures.js';
import { commitAll, templateWorkspace, write } from '../repo.js';
import { linkToolchain, runOnly } from './helpers.js';

export const CONTROLLER = `import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { NoIdempotent } from '@stynx-nyx/core';
import { parseDto } from '@stynx-nyx/flow';
import { RequireRoles } from '@stynx-nyx/backend';
import { ErrorContract, Slo, UseCase } from '@devai-nyx/decorators';
import { createNoteBody, type CreateNoteResponse } from './dto/create-note.dto.js';
import { emptyQuery, getNoteParams } from './dto/get-note.dto.js';
import { DemoNotesService } from './notes.service.js';

@Controller()
export class DemoNotesController {
  constructor(private readonly service: DemoNotesService) {}

  @Post('/notes')
  @HttpCode(201)
  @NoIdempotent()
  @RequireRoles(['demo-member'], 'all')
  @ErrorContract([
    { status: 400, code: 'VALIDATION', messageKey: 'demo.notes.invalid' },
    { status: 401, code: 'UNAUTHENTICATED', messageKey: 'demo.notes.unauthenticated' },
    { status: 403, code: 'FORBIDDEN', messageKey: 'demo.notes.forbidden' },
    { status: 503, code: 'UNAVAILABLE', messageKey: 'demo.notes.unavailable' },
  ])
  @UseCase('UC-DEMO-001')
  @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 500 })
  async create(@Body() body: unknown, @Query() query: unknown): Promise<CreateNoteResponse> {
    const input = parseDto(createNoteBody, body);
    parseDto(emptyQuery, query);
    return this.service.create(input);
  }

  @Get('/notes/:id')
  @HttpCode(200)
  @NoIdempotent()
  @RequireRoles(['demo-member'], 'all')
  @ErrorContract([
    { status: 400, code: 'VALIDATION', messageKey: 'demo.notes.invalid' },
    { status: 401, code: 'UNAUTHENTICATED', messageKey: 'demo.notes.unauthenticated' },
    { status: 403, code: 'FORBIDDEN', messageKey: 'demo.notes.forbidden' },
    { status: 404, code: 'NOT_FOUND', messageKey: 'demo.notes.missing' },
    { status: 503, code: 'UNAVAILABLE', messageKey: 'demo.notes.unavailable' },
  ])
  @UseCase('UC-DEMO-001')
  @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 250 })
  async get(@Param() params: unknown, @Query() query: unknown): Promise<CreateNoteResponse> {
    const { id } = parseDto(getNoteParams, params);
    parseDto(emptyQuery, query);
    return this.service.get(id);
  }
}
`;

export const APP_MODULE = (imports = 'StynxCoreModule.forRoot(), DemoNotesModule') => `import { Module } from '@nestjs/common';
import { StynxCoreModule } from '@stynx-nyx/core';
import { DemoNotesModule } from '@demo/notes-api';

@Module({ imports: [${imports}] })
export class AppModule {}
`;

/** The template workspace with 09 §6's notes module mounted in apps/api (09 §2 mount lines applied). */
export function notesWorkspace(files: Record<string, string> = {}): string {
  const dir = templateWorkspace({
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'domain/*/api'\n",
    'apps/api/package.json': JSON.stringify({ name: '@demo/api', private: true, type: 'module', dependencies: { '@demo/notes-api': 'workspace:*' } }),
    'apps/api/src/app.module.ts': APP_MODULE(),
    'domain/notes/api/package.json': JSON.stringify({ name: '@demo/notes-api', private: true, type: 'module', exports: { '.': './dist/index.js' } }),
    'domain/notes/api/src/index.ts': "export { DemoNotesModule } from './notes.module.js';\n",
    'domain/notes/api/src/notes.module.ts': "import { Module } from '@nestjs/common';\nimport { DemoNotesController } from './notes.controller.js';\nimport { DemoNotesService } from './notes.service.js';\n\n@Module({ controllers: [DemoNotesController], providers: [DemoNotesService] })\nexport class DemoNotesModule {}\n",
    'domain/notes/api/src/notes.controller.ts': CONTROLLER,
    ...files,
  });
  linkToolchain(dir);
  return dir;
}

const mutate = (dir: string, from: string | RegExp, to: string): void => {
  write(dir, 'domain/notes/api/src/notes.controller.ts', CONTROLLER.replace(from, to));
  commitAll(dir, 'mutation');
};

const CTRL = 'domain/notes/api/src/notes.controller.ts';

describe('B.9 route-contract', () => {
  it('the 09 §6 controller, fully declared: UNKNOWN tooling-missing per route (D-087: list-routes 3.0.0 does not read RequireRoles)', async () => {
    const { row } = await runOnly(notesWorkspace(), 'route-contract');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing', expected: 2, observed: 2, evaluated: 2 });
    expect(row.findings).toEqual([
      { locator: `${CTRL}:14`, message: 'POST /notes: tooling-missing — route-contract: install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles', standard: 'S-28', hint: 'install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles (D-087)' },
      { locator: `${CTRL}:32`, message: 'GET /notes/:id: tooling-missing — route-contract: install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles', standard: 'S-28', hint: 'install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles (D-087)' },
    ]);
  });

  describe('09 §4 N1: one contract decorator removed (five runs)', () => {
    it.each([
      ['NoIdempotent', /  @NoIdempotent\(\)\n/, 'POST /notes lacks @NoIdempotent', 'S-28', 'add @NoIdempotent()'],
      ['RequireRoles', /  @RequireRoles\(.*\n/, 'POST /notes lacks @RequireRoles', 'S-28', "add @RequireRoles(['demo-member'], 'all')"],
      ['ErrorContract', /  @ErrorContract\(\[\n[\s\S]*?  \]\)\n/, 'POST /notes lacks @ErrorContract', 'S-28', 'add @ErrorContract(<value from the spec route>)'],
      ['UseCase', /  @UseCase\(.*\n/, 'POST /notes lacks @UseCase', 'S-28', "add @UseCase('UC-DEMO-001')"],
      // 08 B.9 gives @Slo its own form (`@Slo missing (spec: p95 500 ms) [S-25]`), not N1's `lacks @Slo [S-28]` (Open).
      ['Slo', /  @Slo\(.*\n/, 'POST /notes @Slo missing (spec: p95 500 ms)', 'S-25', "add @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 500 })"],
    ])('@%s removed from POST /notes → FAIL', async (_name, from, message, standard, hint) => {
      const dir = notesWorkspace();
      mutate(dir, from, '');
      const { row } = await runOnly(dir, 'route-contract');
      expect(row.status).toBe('FAIL');
      const contract = row.findings.filter((x) => !x.message.includes('tooling-missing') && !x.message.includes('neither role-bound'));
      expect(contract).toEqual([{ locator: `${CTRL}:14`, message, standard, hint }]);
    });
  });

  it('09 §4 N2: parseDto removed from the POST body parameter → FAIL "@Body() without parseDto [S-26]"', async () => {
    const dir = notesWorkspace();
    mutate(dir, '    const input = parseDto(createNoteBody, body);\n', '    const input = body as never;\n');
    const { row } = await runOnly(dir, 'route-contract');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toContainEqual({ locator: `${CTRL}:14`, message: 'POST /notes @Body() without parseDto', standard: 'S-26', hint: 'parseDto(<zod schema>, body)' });
  });

  it('a field mismatch and a non-literal argument are FAIL', async () => {
    const dir = notesWorkspace();
    mutate(dir, "  @UseCase('UC-DEMO-001')\n  @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 500 })", "  @UseCase(ID)\n  @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 500 })");
    write(dir, CTRL, CONTROLLER.replace("@UseCase('UC-DEMO-001')", '@UseCase(ID)').replace('percentile: 95, maxMs: 250', 'percentile: 99, maxMs: 250'));
    commitAll(dir);
    const { row } = await runOnly(dir, 'route-contract');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toEqual(expect.arrayContaining([
      { locator: `${CTRL}:14`, message: 'POST /notes @UseCase argument not statically readable', standard: 'S-28', hint: 'write the decorator argument as a literal' },
      { locator: `${CTRL}:32`, message: 'GET /notes/:id @Slo differs from the spec route', standard: 'S-28', hint: "set @Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 250 })" },
    ]));
  });

  it('unmounted module: each spec route is "spec route not mounted" (a spec with routes is FAIL, not SKIPPED)', async () => {
    const dir = notesWorkspace({ 'apps/api/src/app.module.ts': APP_MODULE('StynxCoreModule.forRoot()') });
    const { row } = await runOnly(dir, 'route-contract');
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 0 });
    expect(row.findings.map((f) => `${f.message} [${f.standard}] ${f.hint}`)).toEqual([
      'GET /notes/:id spec route not mounted [S-25] add the handler or remove the spec route',
      'POST /notes spec route not mounted [S-25] add the handler or remove the spec route',
    ]);
    expect(row.findings[0]!.locator).toMatch(/^specs\/notes\/SPEC-DEMO-001\.md:\d+$/);
  });

  it('S-70: an app root module without StynxCoreModule is "request-id middleware not mounted"', async () => {
    const dir = notesWorkspace({ 'apps/api/src/app.module.ts': APP_MODULE('DemoNotesModule') });
    const { row } = await runOnly(dir, 'route-contract');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toContainEqual({ locator: 'apps/api/src/app.module.ts:1', message: 'request-id middleware not mounted', standard: 'S-70', hint: 'import StynxCoreModule' });
  });

  it('09 §4 N12: @stynx-nyx/cli absent → UNKNOWN tooling-missing with the install line', async () => {
    const dir = notesWorkspace();
    const fs = await import('node:fs');
    fs.rmSync(resolve(dir, 'node_modules/.bin/stynx'));
    const { row } = await runOnly(dir, 'route-contract');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(row.findings).toEqual([{ locator: 'package.json:1', message: 'stynx not resolvable from node_modules/.bin', standard: 'S-28', hint: 'install with pnpm add -D @stynx-nyx/cli@3.0.0' }]);
  });

  it('D-086: a stynx exit 1 without the JSON report (a usage error) is runner-crashed, stderr first line as message', async () => {
    const dir = notesWorkspace();
    const p = resolve(dir, 'node_modules/.bin/stynx');
    writeFileSync(p, "#!/bin/sh\necho \"error: unknown option '--roots'\" >&2\nexit 1\n");
    chmodSync(p, 0o755);
    const { row } = await runOnly(dir, 'route-contract');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed' });
    expect(row.findings[0]).toMatchObject({ message: "error: unknown option '--roots'", hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' });
  });

  it('SKIPPED with the population string when no domain controller is declared', async () => {
    const { row } = await runOnly(templateWorkspace(), 'route-contract');
    expect(row).toMatchObject({ status: 'SKIPPED', evidence: 'no mounted routes in domain/<m>' });
  });

  it('mount-unresolved (inventory) makes route-contract prerequisite-failed', async () => {
    const dir = notesWorkspace({ 'apps/api/src/app.module.ts': APP_MODULE('StynxCoreModule.forRoot(), DemoNotesModule.forRoot()') });
    const { row, rows } = await runOnly(dir, 'route-contract');
    expect(rows[0]).toMatchObject({ id: 'inventory', status: 'UNKNOWN', reason: 'mount-unresolved' });
    expect(rows[0]!.findings[0]).toEqual({ locator: 'apps/api/src/app.module.ts:5', message: 'imports element DemoNotesModule.forRoot() is not a static reference', standard: 'S-06', hint: "make the module's imports/controllers arrays static at the locator" });
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'prerequisite-failed' });
  });
});

describe('B.1 mount census (D-084 item 9)', () => {
  const census = async (dir: string) => {
    const ctx = { root: dir, config: templateConfig(), runtime: 'bare' as const, cliVersion: '3.0.0', listing: await workingTree(dir, null), base: null, head: 'b'.repeat(40), plan: plan({ packet: false, full: false, only: ['inventory'] }) };
    return runInventory(ctx);
  };
  it('apps/api/src/app.module.ts with static imports: [] is a complete census with no controller', async () => {
    const dir = templateWorkspace({ 'apps/api/src/app.module.ts': "import { Module } from '@nestjs/common';\n\n@Module({ imports: [] })\nexport class AppModule {}\n" });
    const { outcome, data } = await census(dir);
    expect(outcome.status).toBe('PASS');
    expect(data.mounts).toEqual({ apps: [{ app: 'api', file: 'apps/api/src/app.module.ts', imports: [] }], controllers: [], read: ['apps/api/src/app.module.ts'], unresolved: [] });
  });
  it('follows a workspace package barrel to the module and its controllers; installed packages are not followed', async () => {
    const { outcome, data } = await census(notesWorkspace());
    expect(outcome.status).toBe('PASS');
    expect(data.mounts.controllers).toEqual([{ app: 'api', file: CTRL, name: 'DemoNotesController' }]);
    expect(data.mounts.read).toEqual(['apps/api/src/app.module.ts', 'domain/notes/api/src/notes.module.ts']);
    expect(data.mounts.apps[0]!.imports.map((i) => `${i.name} ${i.from}`)).toEqual(['StynxCoreModule @stynx-nyx/core', 'DemoNotesModule @demo/notes-api']);
  });
  it('a computed imports array is mount-unresolved with its locator', async () => {
    const dir = templateWorkspace({ 'apps/api/src/app.module.ts': "import { Module } from '@nestjs/common';\nconst list = [];\n@Module({ imports: list })\nexport class AppModule {}\n" });
    const { outcome } = await census(dir);
    expect(outcome).toMatchObject({ status: 'UNKNOWN', reason: 'mount-unresolved' });
    expect(outcome.findings[0]).toMatchObject({ locator: 'apps/api/src/app.module.ts:3', message: 'imports is not a static array' });
  });
});
