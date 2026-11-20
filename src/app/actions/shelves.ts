"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { bookSchema } from "@/lib/book";
import { MAX_CURRENT_PAGE } from "@/lib/book-limits";
import { SHELVES, type Shelf } from "@/lib/shelf";
import { removeFromShelf, setCurrentPage, setShelf } from "@/lib/shelves";

const inputSchema = z.object({ book: bookSchema, shelf: z.enum(SHELVES) });

export type SetShelfResult = { ok: true; shelf: Shelf } | { ok: false };

// Server Actions are public endpoints, so `input` is untrusted. Failures come
// back as `{ ok: false }` and never throw: a throw would reach the search
// results error boundary, which blames Open Library.
export async function setShelfAction(input: unknown): Promise<SetShelfResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { book, shelf } = parsed.data;

  try {
    await setShelf(book, shelf);
  } catch (error) {
    console.error("setShelfAction: could not save shelf", error);
    return { ok: false };
  }

  // Outside the try so Next's own errors are never swallowed.
  refresh();
  return { ok: true, shelf };
}

// Reuses the work id rule from bookSchema instead of copying the regex.
const removeInputSchema = z.object({ workId: bookSchema.shape.id });

export type RemoveFromShelfResult = { ok: true } | { ok: false };

// Same contract as setShelfAction: untrusted input, never throws, no error text.
export async function removeFromShelfAction(
  input: unknown,
): Promise<RemoveFromShelfResult> {
  const parsed = removeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  try {
    await removeFromShelf(parsed.data.workId);
  } catch (error) {
    console.error("removeFromShelfAction: could not remove book", error);
    return { ok: false };
  }

  // Outside the try so Next's own errors are never swallowed.
  refresh();
  return { ok: true };
}

const pageInputSchema = z.object({
  workId: bookSchema.shape.id,
  page: z.number().int().min(1).max(MAX_CURRENT_PAGE),
});

export type SetCurrentPageResult = { ok: true; page: number } | { ok: false };

// Same contract as the other actions. A book that is not on Reading is a
// plain `{ ok: false }`, not logged: it is not a database error.
export async function setCurrentPageAction(
  input: unknown,
): Promise<SetCurrentPageResult> {
  const parsed = pageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { workId, page } = parsed.data;

  let changed: boolean;
  try {
    changed = await setCurrentPage(workId, page);
  } catch (error) {
    console.error("setCurrentPageAction: could not save page", error);
    return { ok: false };
  }
  if (!changed) return { ok: false };

  // Outside the try so Next's own errors are never swallowed.
  refresh();
  return { ok: true, page };
}
