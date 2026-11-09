import type { Book } from "@/lib/open-library";
import { BookCard } from "./book-card";

export function SearchResults({
  books,
  query,
}: {
  books: Book[];
  query: string;
}) {
  if (books.length === 0) {
    return (
      <p className="text-zinc-600">
        No books found for &ldquo;{query}&rdquo;. Try a different title or
        author.
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  );
}
