import { inArray } from "drizzle-orm";
import { getDb, type Db } from "./db/client";
import { books } from "./db/schema";
import type { Book } from "./open-library";
import type { Shelf } from "./shelf";

// Puts a book on a shelf. One atomic upsert: a new work is inserted, an
// existing one gets the new shelf and the latest snapshot. `addedAt` is left
// out of the update set, so it keeps the value from the first insert.
// Database errors are thrown, not swallowed.
export async function setShelf(
  book: Book,
  shelf: Shelf,
  db: Db = getDb(),
): Promise<void> {
  const now = Date.now();
  const snapshot = {
    title: book.title,
    authors: book.authors,
    year: book.year,
    coverId: book.coverId,
    shelf,
    updatedAt: now,
  };
  await db
    .insert(books)
    .values({ workId: book.id, ...snapshot, addedAt: now })
    .onConflictDoUpdate({ target: books.workId, set: snapshot });
}

// Maps work id to shelf for the ids that are shelved. Unshelved ids are absent.
export async function getShelvesFor(
  ids: string[],
  db: Db = getDb(),
): Promise<Record<string, Shelf>> {
  if (ids.length === 0) return {};
  const rows = await db
    .select({ workId: books.workId, shelf: books.shelf })
    .from(books)
    .where(inArray(books.workId, ids));
  return Object.fromEntries(rows.map((row) => [row.workId, row.shelf]));
}
