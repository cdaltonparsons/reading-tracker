import Image from "next/image";
import { coverUrl, type Book } from "@/lib/open-library";

export function BookCard({ book }: { book: Book }) {
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
        <h3 className="font-semibold">{book.title}</h3>
        <p className="text-sm text-zinc-600">{authors}</p>
        <p className="text-sm text-zinc-500">{year}</p>
      </div>
    </article>
  );
}
