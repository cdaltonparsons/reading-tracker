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
import { unstable_rethrow } from "next/navigation";
import {
  OpenLibraryError,
  coverUrl,
  normalizeQuery,
  parseSearchResponse,
  searchBooks,
} from "./open-library";

describe("normalizeQuery", () => {
  it("returns empty string for undefined", () => {
    expect(normalizeQuery(undefined)).toBe("");
  });

  it("uses the first element of an array", () => {
    expect(normalizeQuery(["dune", "x"])).toBe("dune");
  });

  it("returns empty string for an empty array", () => {
    expect(normalizeQuery([])).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeQuery("  dune \n")).toBe("dune");
  });

  it("returns empty for whitespace-only input", () => {
    expect(normalizeQuery("   \t ")).toBe("");
  });

  it("truncates to 200 characters", () => {
    expect(normalizeQuery("a".repeat(300))).toHaveLength(200);
  });

  it("keeps exactly 200 and 199 characters intact", () => {
    expect(normalizeQuery("a".repeat(200))).toHaveLength(200);
    expect(normalizeQuery("a".repeat(199))).toHaveLength(199);
  });

  it("trims again after slicing so no trailing space remains", () => {
    const result = normalizeQuery("a".repeat(199) + " " + "b".repeat(10));
    expect(result).toHaveLength(199);
    expect(result).not.toMatch(/\s$/);
  });
});

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

  it("drops docs with empty-string key or title", () => {
    expect(
      parseSearchResponse({
        docs: [
          { key: "", title: "T" },
          { key: "/works/OL1W", title: "" },
        ],
      }),
    ).toEqual([]);
  });

  it("defaults missing optional fields", () => {
    expect(
      parseSearchResponse({ docs: [{ key: "/works/OL1W", title: "T" }] }),
    ).toEqual([
      { id: "/works/OL1W", title: "T", authors: [], year: null, coverId: null },
    ]);
  });

  it("gives null for non-numeric year and cover", () => {
    const [book] = parseSearchResponse({
      docs: [
        {
          key: "/works/OL1W",
          title: "T",
          first_publish_year: "1965",
          cover_i: "abc",
        },
      ],
    });
    expect(book.year).toBeNull();
    expect(book.coverId).toBeNull();
  });

  it("gives null for explicit null year and cover", () => {
    const [book] = parseSearchResponse({
      docs: [
        {
          key: "/works/OL1W",
          title: "T",
          first_publish_year: null,
          cover_i: null,
        },
      ],
    });
    expect(book.year).toBeNull();
    expect(book.coverId).toBeNull();
  });

  it("falls back to [] authors when author_name is not an array", () => {
    const [a] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "T", author_name: "Frank" }],
    });
    expect(a.authors).toEqual([]);
  });

  it("keeps only non-empty string author entries", () => {
    const [a, b] = parseSearchResponse({
      docs: [
        { key: "/works/OL1W", title: "T", author_name: ["ok", 5] },
        { key: "/works/OL2W", title: "T", author_name: ["ok", "", "  "] },
      ],
    });
    expect(a.authors).toEqual(["ok"]);
    expect(b.authors).toEqual(["ok"]);
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

  it("gives null for a non-integer year", () => {
    const [book] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "T", first_publish_year: 1.5 }],
    });
    expect(book.year).toBeNull();
  });

  it.each([1.5, -3, 0])("gives null coverId for invalid cover_i %s", (cover) => {
    const [book] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "T", cover_i: cover }],
    });
    expect(book.coverId).toBeNull();
  });

  it("keeps valid integer year and cover", () => {
    const [book] = parseSearchResponse({
      docs: [
        { key: "/works/OL1W", title: "T", first_publish_year: 1999, cover_i: 1 },
      ],
    });
    expect(book.year).toBe(1999);
    expect(book.coverId).toBe(1);
  });

  it("handles NaN year (JS-only value) without throwing", () => {
    const [book] = parseSearchResponse({
      docs: [{ key: "/works/OL1W", title: "T", first_publish_year: NaN }],
    });
    expect(book.year).toBeNull();
  });

  it.each([
    ["missing docs", {}],
    ["docs not an array", { docs: "nope" }],
    ["docs null", { docs: null }],
    ["docs an object", { docs: {} }],
    ["null input", null],
    ["undefined input", undefined],
    ["string input", "hello"],
    ["number input", 42],
    ["array input", []],
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

  it("returns [] without calling fetch for an empty query", async () => {
    await expect(searchBooks("")).resolves.toEqual([]);
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

  it("returns [] without calling fetch for a whitespace-only query", async () => {
    await expect(searchBooks("   ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends at most 200 characters in q for a longer query", async () => {
    fetchMock.mockResolvedValue(okResponse({ docs: [] }));
    await searchBooks("a".repeat(300));
    const q = new URL(fetchMock.mock.calls[0][0]).searchParams.get("q");
    expect(q).toHaveLength(200);
    expect(q).toBe("a".repeat(200));
  });

  it("calls cacheLife with 'hours' when a search runs", async () => {
    vi.mocked(cacheLife).mockClear();
    fetchMock.mockResolvedValue(okResponse({ docs: [] }));
    await searchBooks("dune");
    expect(cacheLife).toHaveBeenCalledWith("hours");
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

  it("passes the caught error to unstable_rethrow", async () => {
    vi.mocked(unstable_rethrow).mockClear();
    fetchMock.mockRejectedValue(new TypeError("network down"));
    const err = await searchBooks("dune").catch((e) => e);
    expect(unstable_rethrow).toHaveBeenCalledTimes(1);
    expect(unstable_rethrow).toHaveBeenCalledWith(err);
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

  it("throws OpenLibraryError for an invalid payload", async () => {
    fetchMock.mockResolvedValue(okResponse({ nope: true }));
    await expect(searchBooks("dune")).rejects.toBeInstanceOf(OpenLibraryError);
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

  it("supports other sizes", () => {
    expect(coverUrl(7, "S")).toBe("https://covers.openlibrary.org/b/id/7-S.jpg");
    expect(coverUrl(7, "L")).toBe("https://covers.openlibrary.org/b/id/7-L.jpg");
  });
});

describe("OpenLibraryError", () => {
  it("is an Error with a name and cause", () => {
    const cause = new Error("x");
    const err = new OpenLibraryError("msg", { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("OpenLibraryError");
    expect(err.cause).toBe(cause);
  });
});
