import { SearchResults } from "@/components/search-results";
import { searchBooks } from "@/lib/open-library";

// `q` must already be normalised (see normalizeQuery).
export async function BookResults({ q }: { q: string }) {
  const books = await searchBooks(q);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold wrap-anywhere">Results for “{q}”</h2>
      <SearchResults books={books} query={q} />
    </section>
  );
}
