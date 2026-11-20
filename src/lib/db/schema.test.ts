// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { books, type NewBookRow } from "./schema";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>["db"];
let close: () => void;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});
afterEach(() => close());

const row = (over: Partial<NewBookRow> = {}): NewBookRow => ({
  workId: "/works/OL1W",
  title: "Dune",
  authors: ["A", "B"],
  year: 1965,
  coverId: 123,
  shelf: "reading",
  addedAt: 1,
  updatedAt: 2,
  ...over,
});

describe("books schema", () => {
  it("round-trips a row, with authors as an array", async () => {
    await db.insert(books).values(row());
    const [got] = await db.select().from(books);
    expect(got).toEqual({
      ...row(),
      currentPage: null,
      startedAt: null,
      finishedAt: null,
    });
    expect(got.authors).toEqual(["A", "B"]);
  });

  it("accepts null year and coverId", async () => {
    await db.insert(books).values(row({ year: null, coverId: null }));
    const [got] = await db.select().from(books);
    expect(got.year).toBeNull();
    expect(got.coverId).toBeNull();
  });

  it("round-trips the progress fields as numbers", async () => {
    await db
      .insert(books)
      .values(row({ currentPage: 120, startedAt: 1000, finishedAt: 2000 }));
    const [got] = await db.select().from(books);
    expect(got.currentPage).toBe(120);
    expect(got.startedAt).toBe(1000);
    expect(got.finishedAt).toBe(2000);
  });

  it("defaults the progress fields to null when left out", async () => {
    await db.insert(books).values(row());
    const [got] = await db.select().from(books);
    expect(got.currentPage).toBeNull();
    expect(got.startedAt).toBeNull();
    expect(got.finishedAt).toBeNull();
  });

  it("rejects a duplicate workId", async () => {
    await db.insert(books).values(row());
    await expect(db.insert(books).values(row({ title: "Other" }))).rejects.toThrow();
  });

  it("rejects an unknown shelf at the database level", async () => {
    await expect(
      db.run(sql`INSERT INTO books (work_id, title, authors, shelf, added_at, updated_at)
        VALUES ('/works/OL9W', 'X', '[]', 'abandoned', 1, 1)`),
    ).rejects.toThrow();
    expect(await db.select().from(books)).toHaveLength(0);
  });

  it("accepts each valid shelf at the database level", async () => {
    for (const [i, shelf] of ["want_to_read", "reading", "finished"].entries()) {
      await db.run(sql`INSERT INTO books (work_id, title, authors, shelf, added_at, updated_at)
        VALUES (${`/works/OL${i}W`}, 'X', '[]', ${shelf}, 1, 1)`);
    }
    expect(await db.select().from(books)).toHaveLength(3);
  });

  it("rejects a missing title", async () => {
    await expect(
      db.run(sql`INSERT INTO books (work_id, authors, shelf, added_at, updated_at)
        VALUES ('/works/OL9W', '[]', 'reading', 1, 1)`),
    ).rejects.toThrow();
  });

  describe("isolation", () => {
    it("first test inserts the shared id", async () => {
      await db.insert(books).values(row());
      expect(await db.select().from(books)).toHaveLength(1);
    });
    it("second test can insert the same id", async () => {
      await db.insert(books).values(row());
      expect(await db.select().from(books)).toHaveLength(1);
    });
  });
});
