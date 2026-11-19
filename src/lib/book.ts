import { z } from "zod";
import {
  MAX_AUTHOR_LENGTH,
  MAX_AUTHORS,
  MAX_TITLE_LENGTH,
} from "./book-limits";
import type { Book } from "./open-library";

// Validates a Book that arrives from the client (for example a server action
// argument). Same shape as the Book that parseSearchResponse produces, plus
// generous size caps so a bad caller cannot store huge values.
export const bookSchema = z.object({
  id: z.string().regex(/^\/works\/OL\d+W$/),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  authors: z
    .array(z.string().trim().min(1).max(MAX_AUTHOR_LENGTH))
    .max(MAX_AUTHORS),
  year: z.number().int().nullable(),
  coverId: z.number().int().positive().nullable(),
});

// Compile-time check that the schema and the Book type stay in step. If either
// drifts, one of these assignments stops compiling.
type Parsed = z.infer<typeof bookSchema>;
const _schemaMatchesBook: (book: Parsed) => Book = (book) => book;
const _bookMatchesSchema: (book: Book) => Parsed = (book) => book;
void _schemaMatchesBook;
void _bookMatchesSchema;
