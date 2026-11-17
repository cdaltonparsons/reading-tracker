import { Suspense } from "react";
import { Results, ResultsSkeleton } from "./results";

// Not async and never awaits searchParams: results read them on the server
// behind their own Suspense boundary. Heading and form live in layout.tsx so
// they persist across searches.
export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}
