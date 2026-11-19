import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/app/actions/shelves", () => ({ setShelfAction: vi.fn() }));

import type { Book } from "@/lib/open-library";
import { BookCard } from "./book-card";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "/works/OL1W",
    title: "Dune",
    authors: ["Frank Herbert"],
    year: 1965,
    coverId: 123,
    ...overrides,
  };
}

describe("BookCard", () => {
  it("renders the title as a level-3 heading", () => {
    render(<BookCard book={makeBook()} shelf={null} />);
    const heading = screen.getByRole("heading", { name: "Dune" });
    expect(heading.tagName).toBe("H3");
  });

  it("shows the author and year", () => {
    render(<BookCard book={makeBook()} shelf={null} />);
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
    expect(screen.getByText("1965")).toBeInTheDocument();
  });

  it("joins multiple authors with a comma and space", () => {
    render(<BookCard book={makeBook({ authors: ["A", "B", "C", "D", "E"] })} shelf={null} />);
    expect(screen.getByText("A, B, C, D, E")).toBeInTheDocument();
  });

  it("shows 'Unknown author' when authors is empty", () => {
    render(<BookCard book={makeBook({ authors: [] })} shelf={null} />);
    expect(screen.getByText("Unknown author")).toBeInTheDocument();
  });

  it("shows 'Year unknown' when year is null", () => {
    render(<BookCard book={makeBook({ year: null })} shelf={null} />);
    expect(screen.getByText("Year unknown")).toBeInTheDocument();
  });

  // z.number().int() accepts 0 (and negative years), so year 0 is reachable; this guards the `=== null` check in the component.
  it("renders year 0 as a number, not 'Year unknown'", () => {
    render(<BookCard book={makeBook({ year: 0 })} shelf={null} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Year unknown")).not.toBeInTheDocument();
  });

  it("renders a cover image sourced from coverUrl(coverId, 'M') with alt naming the title", () => {
    render(<BookCard book={makeBook({ coverId: 8231 })} shelf={null} />);
    const img = screen.getByRole("img", { name: /Dune/ });
    expect(img).toHaveAttribute("alt", "Cover of Dune");
    expect(img.getAttribute("src")).toContain(
      encodeURIComponent("https://covers.openlibrary.org/b/id/8231-M.jpg"),
    );
    expect(screen.queryByTestId("cover-placeholder")).toBeNull();
  });

  it("renders a placeholder and no img when coverId is null", () => {
    render(<BookCard book={makeBook({ coverId: null })} shelf={null} />);
    expect(screen.getByTestId("cover-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("cover-placeholder")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the shelf control with the current shelf pressed", () => {
    render(<BookCard book={makeBook()} shelf="reading" />);
    const group = screen.getByRole("group", { name: "Shelf for Dune" });
    expect(within(group).getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("shows the shelf control with nothing pressed when the book is unshelved", () => {
    render(<BookCard book={makeBook()} shelf={null} />);
    const group = screen.getByRole("group", { name: "Shelf for Dune" });
    expect(within(group).getAllByRole("button")).toHaveLength(3);
    expect(within(group).queryByRole("button", { pressed: true })).toBeNull();
  });

  it("renders no shelf control when the shelf is unknown", () => {
    render(<BookCard book={makeBook()} shelf={undefined} />);
    expect(screen.queryByRole("group")).toBeNull();
  });
});
