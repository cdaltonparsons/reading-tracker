import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

const SEARCH_URL = "https://openlibrary.org/search.json";
const COVERS_URL = "https://covers.openlibrary.org/b/id";
const FIELDS = "key,title,author_name,first_publish_year,cover_i";
const USER_AGENT = "ReadingTracker/0.1 (personal project)";
const MAX_QUERY_LENGTH = 200;
const RESULT_LIMIT = 20;
const FETCH_TIMEOUT_MS = 8000;

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
    key: z.string().regex(/^\/works\/OL\d+W$/),
    title: z.string().trim().min(1),
    // Keep valid names, drop bad entries. A non-array gives [].
    author_name: z
      .array(z.unknown())
      .catch([])
      .transform((names) =>
        names
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter((name) => name !== ""),
      ),
    first_publish_year: z.number().int().nullable().catch(null),
    // Goes into a URL via coverUrl, so it must be a positive integer.
    cover_i: z.number().int().positive().nullable().catch(null),
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
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH).trim();
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

// Uncached wrapper around the cached `fetchSearch`. It exists for two reasons:
// (a) Errors thrown inside a "use cache" scope are rebuilt as plain Errors in
//     production, so wrapping into OpenLibraryError must happen outside it.
// (b) Normalising the query before the cached call keeps cache keys
//     consistent ("  dune " and "dune" share an entry). Do not move
//     `normalizeQuery` into `fetchSearch`.
export async function searchBooks(raw: string): Promise<Book[]> {
  const query = normalizeQuery(raw);
  if (query === "") return [];
  try {
    return await fetchSearch(query);
  } catch (cause) {
    // Let Next control-flow errors (notFound, redirect, dynamic bailouts) pass.
    unstable_rethrow(cause);
    throw cause instanceof OpenLibraryError
      ? cause
      : new OpenLibraryError("Open Library search failed", { cause });
  }
}

const TIMEOUT_MESSAGE = "Open Library timed out";

// AbortSignal.timeout() aborts with a DOMException named "TimeoutError".
function isTimeout(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "name" in cause &&
    cause.name === "TimeoutError"
  );
}

async function fetchSearch(query: string): Promise<Book[]> {
  "use cache";
  cacheLife("hours");

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(RESULT_LIMIT));
  url.searchParams.set("fields", FIELDS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    throw isTimeout(cause)
      ? new OpenLibraryError(TIMEOUT_MESSAGE, { cause })
      : new OpenLibraryError("Could not reach Open Library", { cause });
  }
  if (!response.ok) {
    throw new OpenLibraryError(`Open Library returned ${response.status}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    // The abort signal also covers reading the body.
    throw isTimeout(cause)
      ? new OpenLibraryError(TIMEOUT_MESSAGE, { cause })
      : new OpenLibraryError("Open Library returned invalid JSON", { cause });
  }
  return parseSearchResponse(json);
}

export function coverUrl(coverId: number, size: "S" | "M" | "L"): string {
  return `${COVERS_URL}/${coverId}-${size}.jpg`;
}
