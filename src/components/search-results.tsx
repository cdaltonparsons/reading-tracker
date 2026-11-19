import type { Book } from "@/lib/open-library";
import type { Shelf } from "@/lib/shelf";
import { BookCard } from "./book-card";

// `shelves` maps work id to shelf (unshelved books are absent). `null` means
// shelves are unavailable, so cards render without a shelf control.
export function SearchResults({
  books,
  query,
  shelves,
}: {
  books: Book[];
  query: string;
  shelves: Record<string, Shelf> | null;
}) {
  if (books.length === 0) {
    return (
      <p className="text-zinc-600 wrap-anywhere">
        No books found for &ldquo;{query}&rdquo;. Try a different title or
        author.
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard
            book={book}
            shelf={shelves === null ? undefined : (shelves[book.id] ?? null)}
          />
        </li>
      ))}
    </ul>
  );
}
