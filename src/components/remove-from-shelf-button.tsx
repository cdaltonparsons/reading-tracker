"use client";

import { useState, useTransition } from "react";
import { removeFromShelfAction } from "@/app/actions/shelves";

export function RemoveFromShelfButton({
  workId,
  title,
}: {
  workId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function remove() {
    setFailed(false);
    startTransition(async () => {
      let ok = false;
      try {
        ok = (await removeFromShelfAction({ workId })).ok;
      } catch {
        // Network or server failure: treat like { ok: false }.
      }
      // On success the action's refresh() re-renders the page and this card
      // unmounts, so there is nothing to update here.
      if (!ok) setFailed(true);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${title} from your shelves`}
        onClick={remove}
        className="rounded-lg border border-zinc-500 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Couldn&apos;t remove. Please try again.
        </p>
      )}
    </div>
  );
}
