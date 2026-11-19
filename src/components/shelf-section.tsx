import { BookCard } from "@/components/book-card";
import type { Book } from "@/lib/open-library";
import { SHELF_LABELS, type Shelf } from "@/lib/shelf";

export function ShelfSection({
  shelf,
  books,
}: {
  shelf: Shelf;
  books: Book[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">
        {SHELF_LABELS[shelf]} ({books.length})
      </h2>
      {books.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No books on this shelf yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {books.map((book) => (
            <li key={book.id}>
              <BookCard book={book} shelf={shelf} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
