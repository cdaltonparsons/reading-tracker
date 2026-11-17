"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeQuery } from "@/lib/query";
import { SearchForm } from "./search-form";

/**
 * Search form that owns the box's text. Lives in the /search layout so it is
 * never remounted (focus survives). Must be inside a Suspense boundary: on a
 * direct visit useSearchParams suspends during prerender.
 *
 * When the URL's q changes, the box follows it (Back/Forward, first render,
 * submit without later edits) unless the change is the result of the user's
 * own submit and they have typed since: then their text wins.
 */
export function SearchBox() {
  const q = normalizeQuery(useSearchParams().get("q") ?? undefined);
  const [text, setText] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  // Normalised query of the last submit still awaiting its URL change.
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  // Adjust state during render when the URL changes (no effect, no flash).
  if (q !== prevQ) {
    setPrevQ(q);
    setSubmitted(null);
    setEdited(false);
    if (!(submitted === q && edited)) setText(q);
  }

  return (
    <SearchForm
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        setEdited(true);
      }}
      onSubmit={() => {
        const n = normalizeQuery(text);
        setSubmitted(n);
        setText(n);
        setEdited(false);
      }}
    />
  );
}
