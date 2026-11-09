import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

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
    render(<BookCard book={makeBook()} />);
    const heading = screen.getByRole("heading", { name: "Dune" });
    expect(heading.tagName).toBe("H3");
    expect(screen.getByRole("heading", { level: 3 })).toBe(heading);
  });

  it("shows the author and year", () => {
    render(<BookCard book={makeBook()} />);
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
    expect(screen.getByText("1965")).toBeInTheDocument();
  });

  it("joins multiple authors with a comma and space", () => {
    render(<BookCard book={makeBook({ authors: ["A", "B", "C", "D", "E"] })} />);
    expect(screen.getByText("A, B, C, D, E")).toBeInTheDocument();
  });

  it("shows 'Unknown author' when authors is empty", () => {
    render(<BookCard book={makeBook({ authors: [] })} />);
    expect(screen.getByText("Unknown author")).toBeInTheDocument();
  });

  it("shows 'Year unknown' when year is null", () => {
    render(<BookCard book={makeBook({ year: null })} />);
    expect(screen.getByText("Year unknown")).toBeInTheDocument();
  });

  // Task 1's schema never produces year 0; this guards the `=== null` check in the component.
  it("renders year 0 as a number, not 'Year unknown'", () => {
    render(<BookCard book={makeBook({ year: 0 })} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Year unknown")).not.toBeInTheDocument();
  });

  it("renders a cover image sourced from coverUrl(coverId, 'M') with alt naming the title", () => {
    render(<BookCard book={makeBook({ coverId: 8231 })} />);
    const img = screen.getByRole("img", { name: /Dune/ });
    expect(img).toHaveAttribute("alt", "Cover of Dune");
    expect(img.getAttribute("src")).toContain(
      encodeURIComponent("https://covers.openlibrary.org/b/id/8231-M.jpg"),
    );
    expect(screen.queryByTestId("cover-placeholder")).toBeNull();
  });

  it("renders a placeholder and no img when coverId is null", () => {
    render(<BookCard book={makeBook({ coverId: null })} />);
    expect(screen.getByTestId("cover-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("cover-placeholder")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  // Task 1's schema never produces coverId 0; this guards the `!== null` check in the component.
  it("renders coverId 0 as a cover (not a placeholder)", () => {
    render(<BookCard book={makeBook({ coverId: 0 })} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders special characters as text without injecting HTML", () => {
    const title = `<script>alert("x")</script> & <b>Bold</b>`;
    const { container } = render(
      <BookCard book={makeBook({ title, authors: ["<i>Eve</i>"] })} />,
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(title);
    expect(screen.getByText("<i>Eve</i>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("i")).toBeNull();
  });

  it("is an article element", () => {
    render(<BookCard book={makeBook()} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });
});
