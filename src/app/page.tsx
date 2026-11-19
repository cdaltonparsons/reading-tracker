import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full min-h-screen max-w-3xl flex-col gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Reading Tracker</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Track what you want to read, what you are reading, and what you have
        finished. Features are on the way, built one at a time by a team of
        AI subagents.
      </p>
      <Link
        href="/search"
        className="w-fit font-medium underline underline-offset-4"
      >
        Search books
      </Link>
      <Link
        href="/shelves"
        className="w-fit font-medium underline underline-offset-4"
      >
        My shelves
      </Link>
    </main>
  );
}
