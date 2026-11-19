import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/open-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/open-library")>()),
  searchBooks: vi.fn(),
}));

vi.mock("@/app/actions/shelves", () => ({ setShelfAction: vi.fn() }));
vi.mock("@/lib/shelves", () => ({ getShelvesFor: vi.fn() }));

import { searchBooks, type Book } from "@/lib/open-library";
import { getShelvesFor } from "@/lib/shelves";
import { BookResults } from "./book-results";

const mockSearch = vi.mocked(searchBooks);
const mockShelves = vi.mocked(getShelvesFor);

const books: Book[] = [
  { id: "/works/OL1W", title: "Dune", authors: ["Frank Herbert"], year: 1965, coverId: 1 },
  { id: "/works/OL2W", title: "Dune Messiah", authors: [], year: null, coverId: null },
];

beforeEach(() => {
  mockSearch.mockReset();
  mockSearch.mockResolvedValue(books);
  mockShelves.mockReset();
  mockShelves.mockResolvedValue({});
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
    expect(mockShelves).not.toHaveBeenCalled();
  });

  it("looks up shelves once, in result order, and shows the shelved book's shelf", async () => {
    mockShelves.mockResolvedValue({ "/works/OL2W": "want_to_read" });
    render(await BookResults({ q: "dune" }));
    expect(mockShelves).toHaveBeenCalledTimes(1);
    expect(mockShelves).toHaveBeenCalledWith(["/works/OL1W", "/works/OL2W"]);
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(second).getByRole("button", { pressed: true })).toBeInTheDocument();
    expect(within(first).queryByRole("button", { pressed: true })).toBeNull();
    expect(screen.queryByText(/unavailable/)).toBeNull();
  });

  it("skips the shelf lookup when there are no books", async () => {
    mockSearch.mockResolvedValue([]);
    render(await BookResults({ q: "zzzz" }));
    expect(mockShelves).not.toHaveBeenCalled();
    expect(screen.getByText(/No books found for/)).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/)).toBeNull();
  });

  it("still shows results with a notice when the shelf lookup fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockShelves.mockRejectedValue(new Error("db down"));
    render(await BookResults({ q: "dune" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("dune");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Shelves are unavailable right now.")).toBeInTheDocument();
    expect(screen.queryAllByRole("group")).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    expect(screen.queryByText(/Couldn.t reach Open Library/)).toBeNull();
    spy.mockRestore();
  });
});
