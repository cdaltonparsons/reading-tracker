// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { books } from "./db/schema";
import { createTestDb } from "./db/test-db";
import type { Book } from "./open-library";
import { setCurrentPage, setShelf } from "./shelves";

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

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(() => {
  vi.useRealTimers();
  ctx.close();
});

const allRows = () => ctx.db.select().from(books);
const rowFor = async (id: string) =>
  (await ctx.db.select().from(books).where(eq(books.workId, id)))[0];

describe("setCurrentPage", () => {
  it("sets current_page on a Reading book and returns true", async () => {
    await setShelf(dune, "reading", ctx.db);

    expect(await setCurrentPage(dune.id, 42, ctx.db)).toBe(true);
    expect((await rowFor(dune.id)).currentPage).toBe(42);
  });

  it("overwrites an earlier page (42 then 57 gives 57)", async () => {
    await setShelf(dune, "reading", ctx.db);

    expect(await setCurrentPage(dune.id, 42, ctx.db)).toBe(true);
    expect(await setCurrentPage(dune.id, 57, ctx.db)).toBe(true);
    expect((await rowFor(dune.id)).currentPage).toBe(57);
  });

  it("returns true when saving the same page again", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setCurrentPage(dune.id, 42, ctx.db);

    expect(await setCurrentPage(dune.id, 42, ctx.db)).toBe(true);
  });

  it("returns false and changes nothing when the book is not shelved", async () => {
    await setShelf(emma, "reading", ctx.db);
    const before = await allRows();

    expect(await setCurrentPage(dune.id, 10, ctx.db)).toBe(false);
    expect(await allRows()).toEqual(before);
  });

  it.each(["want_to_read", "finished"] as const)(
    "returns false and changes nothing for a book on %s",
    async (shelf) => {
      await setShelf(dune, shelf, ctx.db);
      const before = await allRows();

      expect(await setCurrentPage(dune.id, 10, ctx.db)).toBe(false);
      expect(await allRows()).toEqual(before);
      expect((await rowFor(dune.id)).currentPage).toBeNull();
    },
  );

  it("changes nothing but currentPage (whole-row comparison)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    await setShelf(dune, "want_to_read", ctx.db);
    vi.setSystemTime(2000);
    await setShelf(dune, "reading", ctx.db);
    const before = await rowFor(dune.id);
    vi.setSystemTime(9000);

    await setCurrentPage(dune.id, 42, ctx.db);

    const after = await rowFor(dune.id);
    expect(after).toEqual({ ...before, currentPage: 42 });
    expect(after.updatedAt).toBe(2000);
    expect(after.addedAt).toBe(1000);
    expect(after.startedAt).toBe(2000);
    expect(after.finishedAt).toBeNull();
  });

  it("does not touch other books", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setShelf(emma, "reading", ctx.db);
    const emmaBefore = await rowFor(emma.id);

    await setCurrentPage(dune.id, 42, ctx.db);

    expect(await rowFor(emma.id)).toEqual(emmaBefore);
  });

  it("rejects when the database fails", async () => {
    await setShelf(dune, "reading", ctx.db);
    ctx.close();

    await expect(setCurrentPage(dune.id, 42, ctx.db)).rejects.toThrow();
  });
});
