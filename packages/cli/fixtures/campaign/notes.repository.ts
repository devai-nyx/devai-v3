import { Injectable } from '@nestjs/common';
import { Database, defineQuery, sql } from '@stynx-nyx/data';
import { z } from 'zod';

const noteRow = z.strictObject({
  id: z.string().uuid(),
  title: z.string().min(1).max(80),
  author_alias: z.string().min(1).max(40),
});

export type NoteRow = z.infer<typeof noteRow>;

/** @public */
export const insertNote = defineQuery({
  name: 'demo_notes.note.insert',
  text: sql`insert into demo_notes.note (title, author_alias) values ($1, $2) returning id, title, author_alias`,
  params: z.tuple([z.string().min(1).max(80), z.string().min(1).max(40)]),
  row: noteRow,
  expects: 'one',
});
/** @public */
export const getNote = defineQuery({
  name: 'demo_notes.note.get',
  text: sql`select id, title, author_alias from demo_notes.note where id = $1`,
  params: z.tuple([z.string().uuid()]),
  row: noteRow,
  expects: 'zero-or-one',
});

/** Both queries run inside Database.tx(): the tenant comes from the verified request context, never from SQL input. */
@Injectable()
export class DemoNotesRepository {
  constructor(private readonly db: Database) {}

  insert(title: string, authorAlias: string): Promise<NoteRow> {
    return this.db.tx((trx) => trx.run(insertNote, [title, authorAlias]));
  }

  get(id: string): Promise<NoteRow | null> {
    return this.db.tx((trx) => trx.run(getNote, [id]));
  }
}
