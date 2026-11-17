import { Suspense } from "react";
import { ResultsErrorBoundary } from "@/components/results-error-boundary";
import { BookResults } from "@/components/book-results";
import { normalizeQuery } from "@/lib/open-library";

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

  // Keyed on the query: catchError only clears on a pathname change, and a
  // search-params-only navigation keeps this segment mounted, so a new query
  // needs a fresh boundary instance to drop a previous error.
  return (
    <ResultsErrorBoundary key={q}>
      <Suspense fallback={<ResultsSkeleton />}>
        <BookResults q={q} />
      </Suspense>
    </ResultsErrorBoundary>
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
