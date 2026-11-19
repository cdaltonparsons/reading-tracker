// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { books } from "./db/schema";
import { createTestDb } from "./db/test-db";
import type { Book } from "./open-library";
import { bookSchema } from "./book";
import { getShelvedBooks, getShelvesFor, setShelf } from "./shelves";

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

describe("setShelf", () => {
  it("creates one row with every mapped field and addedAt === updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    await setShelf(dune, "reading", ctx.db);
    expect(await ctx.db.select().from(books)).toEqual([
      {
        workId: dune.id,
        title: "Dune",
        authors: ["Frank Herbert"],
        year: 1965,
        coverId: 123,
        shelf: "reading",
        addedAt: 1000,
        updatedAt: 1000,
      },
    ]);
  });

  it("updates in place: new shelf and snapshot, new updatedAt, same addedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    await setShelf(dune, "reading", ctx.db);
    vi.setSystemTime(2000);
    await setShelf(
      { ...dune, title: "Dune (2nd)", authors: ["F. Herbert", "X"], year: 1966 },
      "finished",
      ctx.db,
    );
    expect(await ctx.db.select().from(books)).toEqual([
      {
        workId: dune.id,
        title: "Dune (2nd)",
        authors: ["F. Herbert", "X"],
        year: 1966,
        coverId: 123,
        shelf: "finished",
        addedAt: 1000,
        updatedAt: 2000,
      },
    ]);
  });

  it("round-trips null year and coverId and empty authors", async () => {
    await setShelf(
      { ...dune, year: null, coverId: null, authors: [] },
      "want_to_read",
      ctx.db,
    );
    const [row] = await ctx.db.select().from(books).where(eq(books.workId, dune.id));
    expect(row.year).toBeNull();
    expect(row.coverId).toBeNull();
    expect(row.authors).toEqual([]);
  });

  it("stores two different books as two rows", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setShelf(emma, "reading", ctx.db);
    expect(await ctx.db.select().from(books)).toHaveLength(2);
  });

  it("rejects when the database fails", async () => {
    ctx.close();
    await expect(setShelf(dune, "reading", ctx.db)).rejects.toThrow();
  });
});

describe("getShelvesFor", () => {
  it("returns {} for an empty array without querying", async () => {
    ctx.close();
    await expect(getShelvesFor([], ctx.db)).resolves.toEqual({});
  });

  it("returns only shelved ids across different shelves", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setShelf(emma, "finished", ctx.db);
    expect(
      await getShelvesFor([dune.id, emma.id, "/works/OL999W"], ctx.db),
    ).toEqual({ [dune.id]: "reading", [emma.id]: "finished" });
  });

  it("returns {} when none of the ids are shelved", async () => {
    await setShelf(dune, "reading", ctx.db);
    expect(await getShelvesFor(["/works/OL999W"], ctx.db)).toEqual({});
  });

  it("reflects a shelf change made through setShelf", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setShelf(dune, "finished", ctx.db);
    expect(await getShelvesFor([dune.id], ctx.db)).toEqual({
      [dune.id]: "finished",
    });
  });
});

describe("getShelvedBooks", () => {
  const at = (ms: number) => {
    vi.useFakeTimers();
    vi.setSystemTime(ms);
  };
  const mk = (n: number): Book => ({
    id: `/works/OL${n}W`,
    title: `Book ${n}`,
    authors: [`Author ${n}`],
    year: 2000 + n,
    coverId: n,
  });

  it("returns all three empty shelves for an empty database", async () => {
    expect(await getShelvedBooks(ctx.db)).toEqual({
      want_to_read: [],
      reading: [],
      finished: [],
    });
  });

  it("keeps every key when only one shelf has books", async () => {
    await setShelf(dune, "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(Object.keys(result).sort()).toEqual(
      ["finished", "reading", "want_to_read"],
    );
    expect(result.want_to_read).toEqual([]);
    expect(result.finished).toEqual([]);
  });

  it("returns books with id, title, authors, year and coverId that pass bookSchema", async () => {
    await setShelf(dune, "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.reading).toEqual([dune]);
    expect(bookSchema.parse(result.reading[0])).toEqual(dune);
  });

  it("round-trips null year and coverId and empty authors", async () => {
    const sparse = { ...dune, year: null, coverId: null, authors: [] };
    await setShelf(sparse, "finished", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.finished).toEqual([sparse]);
    expect(bookSchema.parse(result.finished[0])).toEqual(sparse);
  });

  it("does not include extra row fields on returned books", async () => {
    await setShelf(dune, "reading", ctx.db);
    const [book] = (await getShelvedBooks(ctx.db)).reading;
    expect(Object.keys(book).sort()).toEqual(
      ["authors", "coverId", "id", "title", "year"],
    );
  });

  it("puts each book only under its own shelf", async () => {
    await setShelf(mk(1), "want_to_read", ctx.db);
    await setShelf(mk(2), "reading", ctx.db);
    await setShelf(mk(3), "finished", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.want_to_read.map((b) => b.id)).toEqual([mk(1).id]);
    expect(result.reading.map((b) => b.id)).toEqual([mk(2).id]);
    expect(result.finished.map((b) => b.id)).toEqual([mk(3).id]);
  });

  it("orders by updatedAt descending within a shelf", async () => {
    at(1000);
    await setShelf(mk(1), "reading", ctx.db);
    at(3000);
    await setShelf(mk(2), "reading", ctx.db);
    at(2000);
    await setShelf(mk(3), "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.reading.map((b) => b.id)).toEqual([
      mk(2).id,
      mk(3).id,
      mk(1).id,
    ]);
  });

  it("breaks updatedAt ties by work id ascending", async () => {
    at(5000);
    await setShelf(mk(30), "reading", ctx.db);
    await setShelf(mk(10), "reading", ctx.db);
    await setShelf(mk(20), "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.reading.map((b) => b.id)).toEqual(
      [mk(10).id, mk(20).id, mk(30).id].sort(),
    );
  });

  it("orders newer updatedAt first even when work id sorts later", async () => {
    at(1000);
    await setShelf(mk(1), "reading", ctx.db);
    at(2000);
    await setShelf(mk(9), "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.reading.map((b) => b.id)).toEqual([mk(9).id, mk(1).id]);
  });

  it("shows a moved book only on its new shelf, as the newest entry", async () => {
    at(1000);
    await setShelf(mk(1), "want_to_read", ctx.db);
    await setShelf(mk(2), "reading", ctx.db);
    at(2000);
    await setShelf(mk(1), "reading", ctx.db);
    const result = await getShelvedBooks(ctx.db);
    expect(result.want_to_read).toEqual([]);
    expect(result.reading.map((b) => b.id)).toEqual([mk(1).id, mk(2).id]);
  });

  it("rejects when the database fails", async () => {
    ctx.close();
    await expect(getShelvedBooks(ctx.db)).rejects.toThrow();
  });

  it("passes through the error from a db whose query throws", async () => {
    const boom = new Error("boom");
    const failing = {
      select: () => {
        throw boom;
      },
    } as unknown as typeof ctx.db;
    await expect(getShelvedBooks(failing)).rejects.toBe(boom);
  });
});
