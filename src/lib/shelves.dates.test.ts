// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { books } from "./db/schema";
import { createTestDb } from "./db/test-db";
import type { Book } from "./open-library";
import { setShelf } from "./shelves";

const dune: Book = {
  id: "/works/OL45804W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const at = (ms: number) => vi.setSystemTime(ms);
const rows = () => ctx.db.select().from(books);
const row = async () => {
  const all = await rows();
  expect(all).toHaveLength(1);
  return all[0];
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  ctx = await createTestDb();
});

afterEach(() => {
  vi.useRealTimers();
  ctx.close();
});

describe("setShelf dates: new books", () => {
  it("new book on Reading gets startedAt = now and finishedAt = null", async () => {
    await setShelf(dune, "reading", ctx.db);
    const r = await row();
    expect(r.startedAt).toBe(1000);
    expect(r.finishedAt).toBeNull();
  });

  it("new book on Finished gets finishedAt = now and startedAt = null", async () => {
    await setShelf(dune, "finished", ctx.db);
    const r = await row();
    expect(r.finishedAt).toBe(1000);
    expect(r.startedAt).toBeNull();
  });

  it("new book on Want to read gets both dates null", async () => {
    await setShelf(dune, "want_to_read", ctx.db);
    const r = await row();
    expect(r.startedAt).toBeNull();
    expect(r.finishedAt).toBeNull();
  });
});

describe("setShelf dates: moves", () => {
  it("Want to read -> Reading sets startedAt to now", async () => {
    await setShelf(dune, "want_to_read", ctx.db);
    at(2000);
    await setShelf(dune, "reading", ctx.db);
    const r = await row();
    expect(r.startedAt).toBe(2000);
    expect(r.finishedAt).toBeNull();
  });

  it("Reading -> Want to read -> Reading keeps the first startedAt", async () => {
    await setShelf(dune, "reading", ctx.db);
    at(2000);
    await setShelf(dune, "want_to_read", ctx.db);
    expect((await row()).startedAt).toBe(1000);
    at(3000);
    await setShelf(dune, "reading", ctx.db);
    expect((await row()).startedAt).toBe(1000);
  });

  it("Reading -> Finished sets finishedAt and keeps startedAt and currentPage", async () => {
    await setShelf(dune, "reading", ctx.db);
    await ctx.db.update(books).set({ currentPage: 123 }).where(eq(books.workId, dune.id));
    at(2000);
    await setShelf(dune, "finished", ctx.db);
    const r = await row();
    expect(r.finishedAt).toBe(2000);
    expect(r.startedAt).toBe(1000);
    expect(r.currentPage).toBe(123);
  });

  it("setShelf(book, 'finished') on an already Finished book keeps finishedAt", async () => {
    await setShelf(dune, "reading", ctx.db);
    at(2000);
    await setShelf(dune, "finished", ctx.db);
    at(9000);
    await setShelf(dune, "finished", ctx.db);
    const r = await row();
    expect(r.finishedAt).toBe(2000);
    expect(r.startedAt).toBe(1000);
    expect(r.updatedAt).toBe(9000);
  });

  it("Finished -> Reading keeps startedAt, finishedAt and currentPage", async () => {
    await setShelf(dune, "reading", ctx.db);
    await ctx.db.update(books).set({ currentPage: 77 }).where(eq(books.workId, dune.id));
    at(2000);
    await setShelf(dune, "finished", ctx.db);
    at(3000);
    await setShelf(dune, "reading", ctx.db);
    const r = await row();
    expect(r.shelf).toBe("reading");
    expect(r.startedAt).toBe(1000);
    expect(r.finishedAt).toBe(2000);
    expect(r.currentPage).toBe(77);
  });

  it("Finished -> Reading -> Finished sets a fresh finishedAt", async () => {
    await setShelf(dune, "finished", ctx.db);
    at(2000);
    await setShelf(dune, "reading", ctx.db);
    at(3000);
    await setShelf(dune, "finished", ctx.db);
    expect((await row()).finishedAt).toBe(3000);
  });

  it("Finished book with null finishedAt gets one when shelved Finished again", async () => {
    await setShelf(dune, "finished", ctx.db);
    await ctx.db.update(books).set({ finishedAt: null }).where(eq(books.workId, dune.id));
    at(2000);
    await setShelf(dune, "finished", ctx.db);
    expect((await row()).finishedAt).toBe(2000);
  });

  it("moving to Want to read never clears dates or progress", async () => {
    await setShelf(dune, "reading", ctx.db);
    await ctx.db.update(books).set({ currentPage: 50 }).where(eq(books.workId, dune.id));
    at(2000);
    await setShelf(dune, "finished", ctx.db);
    at(3000);
    await setShelf(dune, "want_to_read", ctx.db);
    const r = await row();
    expect(r.shelf).toBe("want_to_read");
    expect(r.startedAt).toBe(1000);
    expect(r.finishedAt).toBe(2000);
    expect(r.currentPage).toBe(50);
  });
});

describe("setShelf dates: invariants", () => {
  it("addedAt never changes across moves and there is one row per book", async () => {
    const moves = ["want_to_read", "reading", "finished", "want_to_read", "reading", "finished"] as const;
    let t = 1000;
    for (const shelf of moves) {
      at(t);
      await setShelf(dune, shelf, ctx.db);
      const r = await row();
      expect(r.addedAt).toBe(1000);
      expect(r.updatedAt).toBe(t);
      expect(r.shelf).toBe(shelf);
      t += 1000;
    }
  });

  it("stores dates in milliseconds, the same unit as addedAt and updatedAt", async () => {
    const now = new Date("2026-03-04T05:06:07.089Z").getTime();
    at(now);
    await setShelf(dune, "reading", ctx.db);
    at(now + 5000);
    await setShelf(dune, "finished", ctx.db);
    const r = await row();
    expect(r.startedAt).toBe(now);
    expect(r.finishedAt).toBe(now + 5000);
    expect(r.addedAt).toBe(now);
    expect(r.updatedAt).toBe(now + 5000);
    expect(r.startedAt).toBeGreaterThan(1e12);
    expect(r.finishedAt).toBeGreaterThan(1e12);
  });
});
