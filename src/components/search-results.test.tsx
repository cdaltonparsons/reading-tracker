import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

import type { Book } from "@/lib/open-library";
import { SearchResults } from "./search-results";

const books: Book[] = [
  { id: "/works/1", title: "Dune", authors: ["Frank Herbert"], year: 1965, coverId: 1 },
  { id: "/works/2", title: "Emma", authors: ["Jane Austen"], year: null, coverId: null },
  { id: "/works/3", title: "Anon", authors: [], year: 1900, coverId: null },
];

describe("SearchResults", () => {
  it("renders one list item per book with title and author", () => {
    render(<SearchResults books={books} query="x" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Dune")).toBeInTheDocument();
    expect(within(items[0]).getByText("Frank Herbert")).toBeInTheDocument();
    expect(within(items[1]).getByText("Emma")).toBeInTheDocument();
    expect(within(items[1]).getByText("Jane Austen")).toBeInTheDocument();
    expect(within(items[2]).getByText("Unknown author")).toBeInTheDocument();
    expect(screen.queryByText(/No books found/)).toBeNull();
  });

  it("shows an empty state containing the query when there are no books", () => {
    render(<SearchResults books={[]} query="zzzz" />);
    expect(screen.getByText(/zzzz/)).toBeInTheDocument();
    expect(screen.getByText(/No books found/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
