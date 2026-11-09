import { cacheLife } from "next/cache";
import { z } from "zod";

const SEARCH_URL = "https://openlibrary.org/search.json";
const COVERS_URL = "https://covers.openlibrary.org/b/id";
const FIELDS = "key,title,author_name,first_publish_year,cover_i";
const USER_AGENT = "ReadingTracker/0.1 (personal project)";
const MAX_QUERY_LENGTH = 200;
const RESULT_LIMIT = 20;

export class OpenLibraryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OpenLibraryError";
  }
}

// Response envelope: only `docs` must be an array. Each doc is validated
// separately so one malformed doc can be dropped without failing the rest.
const searchResponseSchema = z.object({ docs: z.array(z.unknown()) });

// Optional fields fall back to a default via `.catch` instead of failing.
// Missing `title` or `key` makes the doc invalid, so it gets dropped.
const docSchema = z
  .object({
    key: z.string().min(1),
    title: z.string().min(1),
    author_name: z.array(z.string()).catch([]),
    first_publish_year: z.number().nullable().catch(null),
    cover_i: z.number().nullable().catch(null),
  })
  .transform((doc) => ({
    id: doc.key,
    title: doc.title,
    authors: doc.author_name,
    year: doc.first_publish_year,
    coverId: doc.cover_i,
  }));

export type Book = z.output<typeof docSchema>;

export function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

export function parseSearchResponse(json: unknown): Book[] {
  const envelope = searchResponseSchema.safeParse(json);
  if (!envelope.success) {
    throw new OpenLibraryError("Unexpected Open Library response shape", {
      cause: envelope.error,
    });
  }
  const books: Book[] = [];
  for (const doc of envelope.data.docs) {
    const result = docSchema.safeParse(doc);
    if (result.success) books.push(result.data);
  }
  return books;
}

export async function searchBooks(query: string): Promise<Book[]> {
  "use cache";
  cacheLife("hours");

  if (query === "") return [];

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(RESULT_LIMIT));
  url.searchParams.set("fields", FIELDS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (cause) {
    throw new OpenLibraryError("Could not reach Open Library", { cause });
  }
  if (!response.ok) {
    throw new OpenLibraryError(`Open Library returned ${response.status}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new OpenLibraryError("Open Library returned invalid JSON", { cause });
  }
  return parseSearchResponse(json);
}

export function coverUrl(coverId: number, size: "S" | "M" | "L"): string {
  return `${COVERS_URL}/${coverId}-${size}.jpg`;
}
