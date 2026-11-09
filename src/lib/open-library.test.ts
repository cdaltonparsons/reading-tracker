import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

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
        { key: "/works/1", author_name: ["A"] },
        { title: "No key" },
        { key: "/works/2", title: "Good" },
        null,
        "junk",
      ],
    });
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe("/works/2");
  });

  it("drops docs with empty-string key or title", () => {
    expect(
      parseSearchResponse({
        docs: [
          { key: "", title: "T" },
          { key: "/works/1", title: "" },
        ],
      }),
    ).toEqual([]);
  });

  it("defaults missing optional fields", () => {
    expect(
      parseSearchResponse({ docs: [{ key: "/works/1", title: "T" }] }),
    ).toEqual([
      { id: "/works/1", title: "T", authors: [], year: null, coverId: null },
    ]);
  });

  it("gives null for non-numeric year and cover", () => {
    const [book] = parseSearchResponse({
      docs: [
        {
          key: "/works/1",
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
        { key: "/works/1", title: "T", first_publish_year: null, cover_i: null },
      ],
    });
    expect(book.year).toBeNull();
    expect(book.coverId).toBeNull();
  });

  it("falls back to [] authors when author_name is not a string array", () => {
    const [a, b] = parseSearchResponse({
      docs: [
        { key: "/works/1", title: "T", author_name: "Frank" },
        { key: "/works/2", title: "T", author_name: ["ok", 5] },
      ],
    });
    expect(a.authors).toEqual([]);
    expect(b.authors).toEqual([]);
  });

  it("handles NaN year (JS-only value) without throwing", () => {
    const [book] = parseSearchResponse({
      docs: [{ key: "/works/1", title: "T", first_publish_year: NaN }],
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
      okResponse({ docs: [{ key: "/works/1", title: "Dune" }] }),
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
    expect(init.headers["User-Agent"]).toMatch(/\S+/);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Dune");
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

  it("throws OpenLibraryError when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    await expect(searchBooks("dune")).rejects.toBeInstanceOf(OpenLibraryError);
  });

  it("throws OpenLibraryError for an invalid payload", async () => {
    fetchMock.mockResolvedValue(okResponse({ nope: true }));
    await expect(searchBooks("dune")).rejects.toBeInstanceOf(OpenLibraryError);
  });

  it("throws OpenLibraryError when the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    await expect(searchBooks("dune")).rejects.toBeInstanceOf(OpenLibraryError);
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
