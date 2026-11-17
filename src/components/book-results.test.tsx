import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/open-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/open-library")>()),
  searchBooks: vi.fn(),
}));

import { searchBooks, type Book } from "@/lib/open-library";
import { BookResults } from "./book-results";

const mockSearch = vi.mocked(searchBooks);

const books: Book[] = [
  { id: "/works/OL1W", title: "Dune", authors: ["Frank Herbert"], year: 1965, coverId: 1 },
  { id: "/works/OL2W", title: "Dune Messiah", authors: [], year: null, coverId: null },
];

beforeEach(() => {
  mockSearch.mockReset();
  mockSearch.mockResolvedValue(books);
});

describe("BookResults", () => {
  it("renders a level-2 heading with the query and one card per book", async () => {
    render(await BookResults({ q: "dune" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Results for “dune”",
    );
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Dune Messiah")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("calls searchBooks with q exactly once", async () => {
    render(await BookResults({ q: "dune" }));
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("dune");
  });

  it("shows the no-results state when there are no books", async () => {
    mockSearch.mockResolvedValue([]);
    render(await BookResults({ q: "zzzz" }));
    expect(screen.getByText(/No books found for/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("zzzz");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("rejects when searchBooks rejects so an error boundary can catch it", async () => {
    mockSearch.mockRejectedValue(new Error("upstream down"));
    await expect(BookResults({ q: "dune" })).rejects.toThrow("upstream down");
  });
});
