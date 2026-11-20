// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { books } from "./db/schema";
import { createTestDb } from "./db/test-db";
import type { Book } from "./open-library";
import { getShelvedBooks, setCurrentPage, setShelf } from "./shelves";

const dune: Book = {
  id: "/works/OL45804W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};
const emma: Book = {
  id: "/works/OL2W",
  title: "Emma",
  authors: ["Jane Austen"],
  year: 1815,
  coverId: 9,
};

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const at = (ms: number) => {
  vi.useFakeTimers();
  vi.setSystemTime(ms);
};

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(() => {
  vi.useRealTimers();
  ctx.close();
});

describe("getShelvedBooks progress fields", () => {
  it("returns currentPage, startedAt and finishedAt from the stored row", async () => {
    await ctx.db.insert(books).values({
      workId: dune.id,
      title: dune.title,
      authors: dune.authors,
      year: dune.year,
      coverId: dune.coverId,
      shelf: "reading",
      addedAt: 1,
      updatedAt: 2,
      currentPage: 120,
      startedAt: 1111,
      finishedAt: 2222,
    });
    const { reading } = await getShelvedBooks(ctx.db);
    expect(reading).toEqual([
      { ...dune, currentPage: 120, startedAt: 1111, finishedAt: 2222 },
    ]);
  });

  it("returns all three as null for a book with no progress", async () => {
    at(1000);
    await setShelf(dune, "want_to_read", ctx.db);
    const { want_to_read } = await getShelvedBooks(ctx.db);
    expect(want_to_read).toEqual([
      { ...dune, currentPage: null, startedAt: null, finishedAt: null },
    ]);
  });

  it("shows the startedAt set by setShelf when moved Want to read to Reading", async () => {
    at(1000);
    await setShelf(dune, "want_to_read", ctx.db);
    at(2000);
    await setShelf(dune, "reading", ctx.db);
    const { reading, want_to_read } = await getShelvedBooks(ctx.db);
    expect(want_to_read).toEqual([]);
    expect(reading[0]).toMatchObject({
      startedAt: 2000,
      finishedAt: null,
      currentPage: null,
    });
  });

  it("shows finishedAt, and startedAt when it was known", async () => {
    at(1000);
    await setShelf(dune, "reading", ctx.db);
    at(3000);
    await setShelf(dune, "finished", ctx.db);
    const { finished } = await getShelvedBooks(ctx.db);
    expect(finished[0]).toMatchObject({ startedAt: 1000, finishedAt: 3000 });
  });

  it("shows finishedAt with null startedAt for a book finished directly", async () => {
    at(3000);
    await setShelf(emma, "finished", ctx.db);
    const { finished } = await getShelvedBooks(ctx.db);
    expect(finished[0]).toMatchObject({ startedAt: null, finishedAt: 3000 });
  });

  it("shows the new currentPage after setCurrentPage", async () => {
    at(1000);
    await setShelf(dune, "reading", ctx.db);
    expect(await setCurrentPage(dune.id, 55, ctx.db)).toBe(true);
    expect((await getShelvedBooks(ctx.db)).reading[0].currentPage).toBe(55);
    await setCurrentPage(dune.id, 80, ctx.db);
    expect((await getShelvedBooks(ctx.db)).reading[0].currentPage).toBe(80);
  });

  it("keeps currentPage null for a Want to read book after a rejected setCurrentPage", async () => {
    await setShelf(dune, "want_to_read", ctx.db);
    expect(await setCurrentPage(dune.id, 55, ctx.db)).toBe(false);
    expect((await getShelvedBooks(ctx.db)).want_to_read[0].currentPage).toBeNull();
  });

  it("keeps ordering unchanged when setCurrentPage is called", async () => {
    at(1000);
    await setShelf(dune, "reading", ctx.db);
    at(2000);
    await setShelf(emma, "reading", ctx.db);
    at(9000);
    await setCurrentPage(dune.id, 10, ctx.db);
    const { reading } = await getShelvedBooks(ctx.db);
    expect(reading.map((b) => b.id)).toEqual([emma.id, dune.id]);
  });

  it("still returns all three shelf keys, with progress on each book", async () => {
    at(1000);
    await setShelf(dune, "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(Object.keys(result).sort()).toEqual([
      "finished",
      "reading",
      "want_to_read",
    ]);
    expect(Object.keys(result.reading[0]).sort()).toEqual([
      "authors",
      "coverId",
      "currentPage",
      "finishedAt",
      "id",
      "startedAt",
      "title",
      "year",
    ]);
  });
});
