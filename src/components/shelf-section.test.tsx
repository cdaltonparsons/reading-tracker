import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/app/actions/shelves", () => ({ setShelfAction: vi.fn() }));

import type { Book } from "@/lib/open-library";
import { SHELVES } from "@/lib/shelf";
import { ShelfSection } from "./shelf-section";

function makeBook(n: number, overrides: Partial<Book> = {}): Book {
  return {
    id: `/works/OL${n}W`,
    title: `Book ${n}`,
    authors: [`Author ${n}`],
    year: 2000 + n,
    coverId: null,
    ...overrides,
  };
}

describe("ShelfSection", () => {
  it.each([
    ["want_to_read", "Want to read"],
    ["reading", "Reading"],
    ["finished", "Finished"],
  ] as const)("renders a level-2 heading with label and count for %s", (shelf, label) => {
    render(<ShelfSection shelf={shelf} books={[makeBook(1), makeBook(2)]} />);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h).toHaveTextContent(`${label} (2)`);
  });

  it("shows the empty message and a zero count when there are no books", () => {
    render(<ShelfSection shelf="reading" books={[]} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Reading (0)");
    expect(screen.getByText("No books on this shelf yet.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("does not show the empty message when it has books", () => {
    render(<ShelfSection shelf="reading" books={[makeBook(1)]} />);
    expect(screen.queryByText("No books on this shelf yet.")).not.toBeInTheDocument();
  });

  it("renders one BookCard per book, in the given order", () => {
    render(<ShelfSection shelf="finished" books={[makeBook(3), makeBook(1), makeBook(2)]} />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Book 3", "Book 1", "Book 2"]);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it.each(SHELVES)("passes the current shelf to each card so only %s is pressed", (shelf) => {
    render(<ShelfSection shelf={shelf} books={[makeBook(1), makeBook(2)]} />);
    for (const article of screen.getAllByRole("article")) {
      const pressed = within(article)
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
      expect(pressed[0]).toHaveTextContent(
        { want_to_read: "Want to read", reading: "Reading", finished: "Finished" }[shelf],
      );
    }
  });
});
