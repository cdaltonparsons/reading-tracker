import { describe, expect, it } from "vitest";
import { bookSchema } from "./book";
import {
  MAX_AUTHOR_LENGTH,
  MAX_AUTHORS,
  MAX_TITLE_LENGTH,
} from "./book-limits";
import { parseSearchResponse } from "./open-library";

const valid = {
  id: "/works/OL45804W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};

describe("bookSchema", () => {
  it("accepts real output from parseSearchResponse", () => {
    const books = parseSearchResponse({
      docs: [
        {
          key: "/works/OL45804W",
          title: "Dune",
          author_name: ["Frank Herbert"],
          first_publish_year: 1965,
          cover_i: 123,
        },
        { key: "/works/OL1W", title: "Anonymous" },
      ],
    });
    expect(books).toHaveLength(2);
    for (const book of books) {
      expect(bookSchema.parse(book)).toEqual(book);
    }
  });

  it("accepts parser output for a doc over every limit", () => {
    const authors = Array.from(
      { length: MAX_AUTHORS + 20 },
      (_, i) => `Author ${i}`,
    );
    authors[0] = "a".repeat(MAX_AUTHOR_LENGTH + 200);
    const books = parseSearchResponse({
      docs: [
        {
          key: "/works/OL1W",
          title: "t".repeat(MAX_TITLE_LENGTH + 500),
          author_name: authors,
        },
      ],
    });
    expect(books).toHaveLength(1);
    for (const book of books) {
      expect(bookSchema.safeParse(book).success).toBe(true);
    }
  });

  it.each([
    ["id without W", { id: "/works/OL123" }],
    ["id with no prefix", { id: "OL123W" }],
    ["id with trailing segment", { id: "/works/OL123W/extra" }],
    ["empty title", { title: "" }],
    ["whitespace-only title", { title: "   " }],
    ["fractional year", { year: 1999.5 }],
    ["coverId 0", { coverId: 0 }],
    ["negative coverId", { coverId: -1 }],
    ["fractional coverId", { coverId: 1.5 }],
    ["empty author", { authors: [""] }],
    ["whitespace-only author", { authors: ["a", "  "] }],
    ["title of 1001 characters", { title: "a".repeat(1001) }],
    ["51 authors", { authors: Array.from({ length: 51 }, () => "a") }],
    ["author of 501 characters", { authors: ["a".repeat(501)] }],
  ])("rejects %s", (_name, override) => {
    expect(bookSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each([
    ["title of 1000 characters", { title: "a".repeat(1000) }],
    ["50 authors", { authors: Array.from({ length: 50 }, () => "a") }],
    ["author of 500 characters", { authors: ["a".repeat(500)] }],
    ["null year and coverId, no authors", { year: null, coverId: null, authors: [] }],
  ])("accepts %s", (_name, override) => {
    expect(bookSchema.safeParse({ ...valid, ...override }).success).toBe(true);
  });

  it("trims the title and authors in its output", () => {
    const out = bookSchema.parse({
      ...valid,
      title: "  Dune  ",
      authors: ["  Frank Herbert "],
    });
    expect(out.title).toBe("Dune");
    expect(out.authors).toEqual(["Frank Herbert"]);
  });
});
