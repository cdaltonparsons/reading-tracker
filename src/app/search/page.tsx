import { Suspense } from "react";
import { Results, ResultsSkeleton } from "./results";

// Not async and never awaits searchParams: results read them on the server
// behind their own Suspense boundary, so the skeleton stays in the static
// shell. Heading and form live in layout.tsx so they persist across searches.
// The error boundary lives in Results, keyed on the query, so a new search
// clears a previous error.
export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}
