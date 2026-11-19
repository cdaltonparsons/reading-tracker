import { connection } from "next/server";
import { SearchResults } from "@/components/search-results";
import { searchBooks } from "@/lib/open-library";
import type { Shelf } from "@/lib/shelf";
import { getShelvesFor } from "@/lib/shelves";

// `q` must already be normalised (see normalizeQuery).
export async function BookResults({ q }: { q: string }) {
  // Not caught: a search failure goes to ResultsErrorBoundary.
  const books = await searchBooks(q);

  // null means the shelves couldn't be loaded. Only this call is caught, so a
  // database problem never shows the Open Library error.
  let shelves: Record<string, Shelf> | null = {};
  if (books.length > 0) {
    // The shelves read is request-time data, but a local database call can
    // finish during prerendering, so Next would treat the page as complete and
    // the client router would ignore the fresh data after refresh() in
    // setShelfAction. Outside the try so Next's own control-flow errors pass.
    await connection();
    try {
      shelves = await getShelvesFor(books.map((b) => b.id));
    } catch (error) {
      console.error("Failed to load shelves for search results", error);
      shelves = null;
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold wrap-anywhere">Results for “{q}”</h2>
      {shelves === null && (
        <p className="text-sm text-zinc-600">
          Shelves are unavailable right now.
        </p>
      )}
      <SearchResults books={books} query={q} shelves={shelves} />
    </section>
  );
}
