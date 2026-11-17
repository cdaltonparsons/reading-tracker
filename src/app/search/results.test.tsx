import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/open-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/open-library")>()),
  searchBooks: vi.fn(),
}));

import { searchBooks, type Book } from "@/lib/open-library";
import { BookResults } from "@/components/book-results";
import { Results, ResultsSkeleton } from "./results";

const mockSearch = vi.mocked(searchBooks);

const books: Book[] = [
  { id: "/works/OL1W", title: "Dune", authors: ["Frank Herbert"], year: 1965, coverId: 1 },
  { id: "/works/OL2W", title: "Dune Messiah", authors: [], year: null, coverId: null },
];

type SP = Parameters<typeof Results>[0]["searchParams"];
const sp = (q?: string | string[]) =>
  Promise.resolve(q === undefined ? {} : { q }) as SP;

beforeEach(() => {
  mockSearch.mockReset();
  mockSearch.mockResolvedValue(books);
});

describe("Results", () => {
  it.each([
    ["missing", undefined],
    ["whitespace-only", "   "],
  ])("shows the prompt and does not search when q is %s", async (_n, q) => {
    render(await Results({ searchParams: sp(q) }));
    expect(screen.getByText("Enter a title or author to search")).toBeInTheDocument();
    expect(mockSearch).not.toHaveBeenCalled();
    expect(screen.queryByText(/No books found/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("keys the error boundary on the normalised query so a new search resets it", async () => {
    const keyOf = async (q: string) =>
      (await Results({ searchParams: sp(q) }) as React.ReactElement).key;
    expect(await keyOf("a")).toBe("a");
    expect(await keyOf(" a ")).toBe("a");
    expect(await keyOf("b")).toBe("b");
  });

  it("passes the normalised query to BookResults", async () => {
    const boundary = (await Results({ searchParams: sp("  dune  ") })) as React.ReactElement<{
      children: React.ReactElement<{ children: React.ReactElement<{ q: string }> }>;
    }>;
    const bookResults = boundary.props.children.props.children;
    expect(bookResults.type).toBe(BookResults);
    expect(bookResults.props.q).toBe("dune");
  });

  // The end-to-end flow (error -> new search -> results) is checked by the
  // browser verifier. This wiring is covered by the key test above plus the
  // ResultsErrorBoundary tests (alert hides the raw message, clears when the
  // key changes, stays when it is unchanged). Async BookResults itself is
  // tested in components/book-results.test.tsx, since it can't resolve nested
  // under jsdom.
});

describe("ResultsSkeleton", () => {
  it("renders a status region with Loading results and no list items", () => {
    render(<ResultsSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
