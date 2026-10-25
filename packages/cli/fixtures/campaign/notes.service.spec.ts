import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { DemoNotesRepository, NoteRow } from '../src/notes.repository.js';
import { DemoNotesService } from '../src/notes.service.js';

const row: NoteRow = {
  id: '0197a000-0000-7000-8000-0000000000aa',
  title: 'Groceries',
  author_alias: 'Pilot One',
};

const serviceOver = (found: NoteRow | null) =>
  new DemoNotesService({ get: () => Promise.resolve(found) } as unknown as DemoNotesRepository);

describe('DemoNotesService', () => {
  it('maps a zero-row lookup to 404 NOT_FOUND demo.notes.missing', async () => {
    const error: unknown = await serviceOver(null)
      .get({ id: row.id })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      code: 'NOT_FOUND',
      messageKey: 'demo.notes.missing',
    });
  });

  it('returns the row a lookup finds', async () => {
    await expect(serviceOver(row).get({ id: row.id })).resolves.toEqual(row);
  });
});
