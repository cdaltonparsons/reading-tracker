import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

// Stands in for a Next control-flow error (notFound, redirect, ...).
const SENTINEL = new Error("next control flow");
vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn((e: unknown) => {
    if (e === SENTINEL) throw e;
  }),
}));

import { cacheLife } from "next/cache";
import {
  OpenLibraryError,
  coverUrl,
  parseSearchResponse,
  searchBooks,
} from "./open-library";

describe("parseSearchResponse", () => {
  it("maps a valid payload to books", () => {
    const books = parseSearchResponse({
      docs: [
        {
          key: "/works/OL1W",
          title: "Dune",
          author_name: ["Frank Herbert"],
          first_publish_year: 1965,
          cover_i: 123,
        },
      ],
    });
    expect(books).toEqual([
      {
        id: "/works/OL1W",
        title: "Dune",
        authors: ["Frank Herbert"],
        year: 1965,
        coverId: 123,
      },
    ]);
  });

  it("returns [] for an empty docs array", () => {
    expect(parseSearchResponse({ docs: [] })).toEqual([]);
  });

  it("drops docs missing title or key but keeps others", () => {
    const books = parseSearchResponse({
      docs: [
        { key: "/works/OL1W", author_name: ["A"] },
        { title: "No key" },
        { key: "/works/OL2W", title: "Good" },
        null,
        "junk",
      ],
    });
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe("/works/OL2W");
  });

  it("drops docs whose key is not a /works/OL<digits>W key", () => {
    const books = parseSearchResponse({
      docs: [
        { key: "/works/1", title: "Bad numeric" },
        { key: "/books/OL1M", title: "Bad type" },
        { key: "/works/OL1W/extra", title: "Bad suffix" },
        { key: "OL1W", title: "No prefix" },
        { key: "/works/OLW", title: "No digits" },
        { key: "/works/OL1W", title: "Valid one" },
        { key: "/works/OL123W", title: "Valid two" },
      ],
    });
    expect(books.map((b) => b.id)).toEqual(["/works/OL1W", "/works/OL123W"]);
  });

  it("defaults missing optional fields", () => {
    expect(
      parseSearchResponse({ docs: [{ key: "/works/OL1W", title: "T" }] }),
    ).toEqual([
      { id: "/works/OL1W", title: "T", authors: [], year: null, coverId: null },
    ]);
  });

  it.each([
    ["string year", { first_publish_year: "1965" }, "year"],
    ["non-integer year", { first_publish_year: 1.5 }, "year"],
    ["string cover_i", { cover_i: "abc" }, "coverId"],
    ["non-integer cover_i", { cover_i: 1.5 }, "coverId"],
    ["negative cover_i", { cover_i: -3 }, "coverId"],
    ["zero cover_i", { cover_i: 0 }, "coverId"],
  ] as const)("invalid numbers become null: %s", (_label, extra, field) => {
    const [book] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "T", ...extra }],
    });
    expect(book[field]).toBeNull();
  });

  it("falls back to [] authors when author_name is not an array", () => {
    const [a] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "T", author_name: "Frank" }],
    });
    expect(a.authors).toEqual([]);
  });

  it("drops a doc whose title is only whitespace", () => {
    expect(
      parseSearchResponse({ docs: [{ key: "/works/OL1W", title: "   " }] }),
    ).toEqual([]);
  });

  it("trims the title", () => {
    const [book] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "  Dune " }],
    });
    expect(book.title).toBe("Dune");
  });

  it("trims author names and drops blanks and non-strings", () => {
    const [book] = parseSearchResponse({
      docs: [
        {
          key: "/works/OL1W",
          title: "T",
          author_name: ["  Frank Herbert ", "   ", 5],
        },
      ],
    });
    expect(book.authors).toEqual(["Frank Herbert"]);
  });

  it.each([
    ["missing docs", {}],
    ["docs not an array", { docs: "nope" }],
    ["null input", null],
  ])("throws OpenLibraryError for %s", (_label, input) => {
    expect(() => parseSearchResponse(input)).toThrow(OpenLibraryError);
  });
});

describe("searchBooks", () => {
  const fetchMock = vi.fn();

  function okResponse(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["an empty", ""],
    ["a whitespace-only", "   "],
  ])("returns [] without calling fetch for %s query", async (_label, q) => {
    await expect(searchBooks(q)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls fetch once with the expected URL and User-Agent", async () => {
    fetchMock.mockResolvedValue(
      okResponse({ docs: [{ key: "/works/OL1W", title: "Dune" }] }),
    );
    const books = await searchBooks("dune");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg, init] = fetchMock.mock.calls[0];
    const url = new URL(urlArg);
    expect(url.origin + url.pathname).toBe("https://openlibrary.org/search.json");
    expect(url.searchParams.get("q")).toBe("dune");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("fields")).toBe(
      "key,title,author_name,first_publish_year,cover_i",
    );
    expect(init.headers["User-Agent"]).toContain("ReadingTracker");
    expect(init.headers["User-Agent"]).not.toContain("@");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Dune");
  });

  it("trims the query before sending it", async () => {
    fetchMock.mockResolvedValue(okResponse({ docs: [] }));
    await searchBooks("  dune  ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("q")).toBe(
      "dune",
    );
  });

  it("encodes special characters in q", async () => {
    fetchMock.mockResolvedValue(okResponse({ docs: [] }));
    const q = "war & peace #1 +é";
    await searchBooks(q);
    const urlArg: string = fetchMock.mock.calls[0][0];
    expect(urlArg).not.toContain("war & peace");
    expect(urlArg).not.toContain("#1");
    expect(new URL(urlArg).searchParams.get("q")).toBe(q);
    expect(new URL(urlArg).searchParams.get("limit")).toBe("20");
  });

  it("throws OpenLibraryError for a non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(searchBooks("dune")).rejects.toBeInstanceOf(OpenLibraryError);
  });

  it("reports 'Could not reach Open Library' when fetch rejects", async () => {
    const boom = new TypeError("network down");
    fetchMock.mockRejectedValue(boom);
    const err = await searchBooks("dune").catch((e) => e);
    expect(err).toBeInstanceOf(OpenLibraryError);
    expect(err.message).toBe("Could not reach Open Library");
    expect(err.cause).toBe(boom);
  });

  it("reports a timeout with the cause when fetch times out", async () => {
    const timeout = new DOMException("", "TimeoutError");
    fetchMock.mockRejectedValue(timeout);
    const err = await searchBooks("dune").catch((e) => e);
    expect(err).toBeInstanceOf(OpenLibraryError);
    expect(err.message).toBe("Open Library timed out");
    expect(err.cause).toBe(timeout);
  });

  it("reports a timeout when reading the body times out", async () => {
    const timeout = new DOMException("", "TimeoutError");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw timeout;
      },
    });
    const err = await searchBooks("dune").catch((e) => e);
    expect(err).toBeInstanceOf(OpenLibraryError);
    expect(err.message).toBe("Open Library timed out");
    expect(err.message).not.toBe("Open Library returned invalid JSON");
    expect(err.cause).toBe(timeout);
  });

  it("wraps a non-OpenLibraryError from the cached function", async () => {
    // In production, errors out of a "use cache" scope arrive as plain Errors.
    const boom = new Error("x");
    vi.mocked(cacheLife).mockImplementationOnce(() => {
      throw boom;
    });
    const err = await searchBooks("dune").catch((e) => e);
    expect(err).toBeInstanceOf(OpenLibraryError);
    expect(err.message).toBe("Open Library search failed");
    expect(err.cause).toBe(boom);
  });

  it("rethrows Next control-flow errors unwrapped", async () => {
    vi.mocked(cacheLife).mockImplementationOnce(() => {
      throw SENTINEL;
    });
    await expect(searchBooks("dune")).rejects.toBe(SENTINEL);
  });

  it("throws OpenLibraryError when the body is not valid JSON", async () => {
    const bad = new SyntaxError("bad json");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw bad;
      },
    });
    const err = await searchBooks("dune").catch((e) => e);
    expect(err).toBeInstanceOf(OpenLibraryError);
    expect(err.message).toBe("Open Library returned invalid JSON");
    expect(err.cause).toBe(bad);
  });
});

describe("coverUrl", () => {
  it("builds the cover URL", () => {
    expect(coverUrl(123, "M")).toBe(
      "https://covers.openlibrary.org/b/id/123-M.jpg",
    );
  });
});
