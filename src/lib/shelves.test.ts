// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { books } from "./db/schema";
import { createTestDb } from "./db/test-db";
import type { Book } from "./open-library";
import { getShelvesFor, setShelf } from "./shelves";

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
