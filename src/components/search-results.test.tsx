import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.restoreAllMocks();
});

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
  });

  it("renders a single book", () => {
    render(<SearchResults books={[books[0]]} query="dune" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("does not show the empty state when there are results", () => {
    render(<SearchResults books={books} query="zzzz" />);
    expect(screen.queryByText(/No books found/)).toBeNull();
  });

  it("shows an empty state containing the query when there are no books", () => {
    render(<SearchResults books={[]} query="zzzz" />);
    expect(screen.getByText(/zzzz/)).toBeInTheDocument();
    expect(screen.getByText(/No books found/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders HTML-like query text as plain text", () => {
    const query = "<img src=x onerror=alert(1)>";
    const { container } = render(<SearchResults books={[]} query={query} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(query);
  });

  it("does not emit React key warnings for unique ids", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SearchResults books={books} query="x" />);
    expect(spy).not.toHaveBeenCalled();
  });
});
