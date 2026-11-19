"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { bookSchema } from "@/lib/book";
import { SHELVES, type Shelf } from "@/lib/shelf";
import { setShelf } from "@/lib/shelves";

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
