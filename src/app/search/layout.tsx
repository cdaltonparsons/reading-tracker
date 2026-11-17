import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { SearchForm } from "@/components/search-form";

// The layout is not re-rendered or remounted on searchParams-only navigations
// (page segments are, layouts are not), so the heading and the search box keep
// their state and focus across searches. Both are part of the static shell;
// the box reads the URL on the client behind Suspense.
export default function SearchLayout({ children }: LayoutProps<"/search">) {
  return (
    <main className="mx-auto flex w-full min-h-screen max-w-3xl flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Search books</h1>
      <Suspense fallback={<SearchForm />}>
        <SearchBox />
      </Suspense>
      {children}
    </main>
  );
}
