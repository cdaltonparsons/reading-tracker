"use client";

import { useFormStatus } from "react-dom";

export function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        data-pending={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:outline-hidden data-[pending=true]:opacity-60"
      >
        {pending ? "Searching…" : "Search"}
      </button>
      {/* Always rendered so the live region exists before its text changes.
          Focus stays in the input after Enter, so the button label alone
          would not be announced. */}
      <span role="status" className="sr-only">
        {pending ? "Searching…" : ""}
      </span>
    </>
  );
}
