import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/open-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/open-library")>()),
  searchBooks: vi.fn(),
}));

import { searchBooks, type Book } from "@/lib/open-library";
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

  it("searches and renders heading plus cards for q=dune", async () => {
    render(await Results({ searchParams: sp("dune") }));
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("dune");
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2).toHaveTextContent("Results for “dune”");
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Dune Messiah")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Enter a title or author to search")).not.toBeInTheDocument();
  });

  it("normalises the query before searching", async () => {
    render(await Results({ searchParams: sp("  dune  ") }));
    expect(mockSearch).toHaveBeenCalledWith("dune");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Results for “dune”");
  });

  it("shows the empty state when there are no results", async () => {
    mockSearch.mockResolvedValue([]);
    render(await Results({ searchParams: sp("zzzz") }));
    expect(screen.getByText(/No books found for/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("zzzz");
  });

  it("does not swallow search errors", async () => {
    mockSearch.mockRejectedValue(new Error("boom"));
    await expect(Results({ searchParams: sp("dune") })).rejects.toThrow("boom");
  });
});

describe("ResultsSkeleton", () => {
  it("renders a status region with Loading results and no list items", () => {
    render(<ResultsSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
