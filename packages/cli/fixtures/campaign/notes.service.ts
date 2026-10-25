import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateNoteBody, CreateNoteResponse } from './dto/create-note.dto.js';
import type { GetNoteParams, GetNoteResponse } from './dto/get-note.dto.js';
import { DemoNotesRepository } from './notes.repository.js';

@Injectable()
export class DemoNotesService {
  constructor(private readonly repository: DemoNotesRepository) {}

  /** R-1, R-2: every valid submission is a new row; the body is stored as given. */
  create(body: CreateNoteBody): Promise<CreateNoteResponse> {
    return this.repository.insert(body.title, body.author_alias);
  }

  /** R-1, R-4: RLS hides another tenant's row, so a foreign id and a missing id are the same 404. */
  async get(params: GetNoteParams): Promise<GetNoteResponse> {
    const row = await this.repository.get(params.id);
    if (row === null) {
      throw new NotFoundException({ code: 'NOT_FOUND', messageKey: 'demo.notes.missing' });
    }
    return row;
  }
}
