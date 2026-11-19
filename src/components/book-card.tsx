import Image from "next/image";
import type { ReactNode } from "react";
import { ShelfControl } from "@/components/shelf-control";
import { coverUrl, type Book } from "@/lib/open-library";
import type { Shelf } from "@/lib/shelf";

// `shelf`: a Shelf or null (unshelved) renders the control; `undefined` means
// shelves are unavailable, so no control is rendered.
export function BookCard({
  book,
  shelf,
  children,
}: {
  book: Book;
  shelf: Shelf | null | undefined;
  children?: ReactNode;
}) {
  const authors =
    book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";
  const year = book.year === null ? "Year unknown" : String(book.year);

  return (
    <article className="flex gap-4 rounded-lg border border-zinc-200 p-4">
      {book.coverId === null ? (
        <div
          data-testid="cover-placeholder"
          aria-hidden="true"
          className="flex h-[108px] w-[72px] shrink-0 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-500"
        >
          No cover
        </div>
      ) : (
        <Image
          src={coverUrl(book.coverId, "M")}
          alt={`Cover of ${book.title}`}
          width={72}
          height={108}
          className="h-[108px] w-[72px] shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0">
        <h3 className="font-semibold wrap-anywhere">{book.title}</h3>
        <p className="text-sm text-zinc-600 wrap-anywhere">{authors}</p>
        <p className="text-sm text-zinc-500">{year}</p>
        {shelf !== undefined && (
          <div className="mt-3">
            <ShelfControl book={book} shelf={shelf} />
          </div>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </article>
  );
}
