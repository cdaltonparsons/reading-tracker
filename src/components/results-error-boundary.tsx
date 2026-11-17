"use client";

import { catchError, type ErrorInfo } from "next/error";

// Deliberately ignores `error`: its text may be stripped or generic, and it
// must never be shown to the user.
function ResultsError(_props: object, { retry }: ErrorInfo) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    >
      <p>Couldn&apos;t reach Open Library. Please try again.</p>
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

export const ResultsErrorBoundary = catchError(ResultsError);
