import { SearchResults } from "@/components/search-results";
import { normalizeQuery, searchBooks } from "@/lib/open-library";

type Props = Pick<PageProps<"/search">, "searchParams">;

export async function Results({ searchParams }: Props) {
  const q = normalizeQuery((await searchParams).q);

  if (!q) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Enter a title or author to search
      </p>
    );
  }

  const books = await searchBooks(q);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold wrap-anywhere">Results for “{q}”</h2>
      <SearchResults books={books} query={q} />
    </section>
  );
}

export function ResultsSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading results</span>
      <ul aria-hidden="true" className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </ul>
    </div>
  );
}
