"use client";

// Deliberately ignores `error`: its text must never be shown to the user.
export default function ShelvesError({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    >
      <p>Couldn&apos;t load your shelves. Please try again.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md bg-red-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-100 dark:text-red-950 dark:hover:bg-red-200"
      >
        Try again
      </button>
    </div>
  );
}
