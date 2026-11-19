"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { setShelfAction } from "@/app/actions/shelves";
// Type-only: open-library.ts imports next/cache, which must stay out of the client bundle.
import type { Book } from "@/lib/open-library";
import { SHELF_LABELS, SHELVES, type Shelf } from "@/lib/shelf";

const BUTTON_BASE =
  "rounded-lg border px-3 py-1.5 text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2";
const BUTTON_ON = "border-zinc-800 bg-zinc-800 text-white";
const BUTTON_OFF = "border-zinc-500 bg-white text-zinc-800 hover:bg-zinc-100";

export function ShelfControl({
  book,
  shelf,
}: {
  book: Book;
  shelf: Shelf | null;
}) {
  // Shows the prop, overridden by the latest optimistic value while any
  // transition is pending. Overlapping clicks each call the setter, so the
  // last click wins; when every transition settles it falls back to the prop.
  const [current, setCurrent] = useOptimistic(shelf);
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState("");
  const [failed, setFailed] = useState(false);
  // Only the newest save may update the messages, so a slow earlier save
  // can't overwrite the result of a later click.
  const latestSave = useRef(0);

  function choose(next: Shelf) {
    if (next === current) return;
    const id = ++latestSave.current;
    setSaved("");
    startTransition(async () => {
      setCurrent(next);
      let ok = false;
      try {
        ok = (await setShelfAction({ book, shelf: next })).ok;
      } catch {
        // Network or server failure: treat like { ok: false }.
      }
      if (id !== latestSave.current) return;
      setFailed(!ok);
      setSaved(ok ? `Saved to ${SHELF_LABELS[next]}` : "");
    });
  }

  return (
    <div>
      <div
        role="group"
        aria-label={`Shelf for ${book.title}`}
        className="flex flex-wrap gap-2"
      >
        {SHELVES.map((s) => {
          const pressed = s === current;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(s)}
              className={`${BUTTON_BASE} ${pressed ? BUTTON_ON : BUTTON_OFF}`}
            >
              {SHELF_LABELS[s]}
            </button>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {saved}
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Couldn&apos;t save. Please try again.
        </p>
      )}
    </div>
  );
}
