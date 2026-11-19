import Link from "next/link";
import { connection } from "next/server";
import { ShelfSection } from "@/components/shelf-section";
import { SHELVES } from "@/lib/shelf";
import { getShelvedBooks } from "@/lib/shelves";

export default async function ShelvesPage() {
  // The read is request-time data, but a local database call can finish during
  // prerendering. Without this the page could be served stale after a shelf
  // change. Errors from the read go to error.tsx.
  await connection();
  const shelved = await getShelvedBooks();

  if (SHELVES.every((shelf) => shelved[shelf].length === 0)) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-zinc-600 dark:text-zinc-400">
          Your shelves are empty
        </p>
        <Link href="/search" className="font-medium underline">
          Search for books
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {SHELVES.map((shelf) => (
        <ShelfSection key={shelf} shelf={shelf} books={shelved[shelf]} />
      ))}
    </div>
  );
}
