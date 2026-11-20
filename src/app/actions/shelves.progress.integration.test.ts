// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { getShelvedBooks, setShelf } from "@/lib/shelves";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/client")>()),
  getDb: () => ctx.db,
}));

import { setCurrentPageAction, setShelfAction } from "./shelves";

const dune = {
  id: "/works/OL45804W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(() => {
  ctx.close();
});

describe("setCurrentPageAction against a real database", () => {
  it("returns { ok: false } and stores nothing for a Want to read book", async () => {
    await setShelf(dune, "want_to_read", ctx.db);

    const result = await setCurrentPageAction({ workId: dune.id, page: 42 });

    expect(result).toStrictEqual({ ok: false });
    const shelves = await getShelvedBooks(ctx.db);
    expect(shelves.want_to_read).toHaveLength(1);
    expect(shelves.want_to_read[0].currentPage).toBeNull();
  });

  it("setShelfAction accepts a ShelvedBook and strips the progress keys", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setCurrentPageAction({ workId: dune.id, page: 7 });
    const shelved = (await getShelvedBooks(ctx.db)).reading[0];
    expect(shelved.currentPage).toBe(7);

    const result = await setShelfAction({ book: shelved, shelf: "finished" });

    expect(result).toStrictEqual({ ok: true, shelf: "finished" });
    const after = await getShelvedBooks(ctx.db);
    expect(after.finished.map((b) => b.id)).toEqual([dune.id]);
    expect(after.finished[0].currentPage).toBe(7);
  });
});
