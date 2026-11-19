import { desc, asc, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "./db/client";
import { books } from "./db/schema";
import type { Book } from "./open-library";
import { SHELVES, type Shelf } from "./shelf";

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

// Takes a book off its shelf. Removing an id that is not shelved does nothing.
// Database errors are thrown, not swallowed.
export async function removeFromShelf(
  workId: string,
  db: Db = getDb(),
): Promise<void> {
  await db.delete(books).where(eq(books.workId, workId));
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

// Every shelved book, grouped by shelf. All three keys are always present.
// One query, newest update first, work id breaking ties so the order is stable.
// Database errors are thrown, not swallowed.
export async function getShelvedBooks(
  db: Db = getDb(),
): Promise<Record<Shelf, Book[]>> {
  const rows = await db
    .select()
    .from(books)
    .orderBy(desc(books.updatedAt), asc(books.workId));
  const grouped = Object.fromEntries(
    SHELVES.map((shelf) => [shelf, [] as Book[]]),
  ) as Record<Shelf, Book[]>;
  for (const row of rows) {
    grouped[row.shelf].push({
      id: row.workId,
      title: row.title,
      authors: row.authors,
      year: row.year,
      coverId: row.coverId,
    });
  }
  return grouped;
}
