// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { getShelvesFor, setShelf } from "@/lib/shelves";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/client")>()),
  getDb: () => ctx.db,
}));

import { removeFromShelfAction } from "./shelves";

const dune = {
  id: "/works/OL45804W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};
const emma = {
  id: "/works/OL2W",
  title: "Emma",
  authors: ["Jane Austen"],
  year: 1815,
  coverId: 9,
};

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(() => {
  ctx.close();
});

describe("removeFromShelfAction against a real database", () => {
  it("leaves getShelvesFor([id]) empty after a successful call", async () => {
    await setShelf(dune, "reading", ctx.db);

    const result = await removeFromShelfAction({ workId: dune.id });

    expect(result).toStrictEqual({ ok: true });
    expect(await getShelvesFor([dune.id], ctx.db)).toEqual({});
  });

  it("does not remove other books on other shelves", async () => {
    await setShelf(dune, "reading", ctx.db);
    await setShelf(emma, "finished", ctx.db);

    await removeFromShelfAction({ workId: dune.id });

    expect(await getShelvesFor([dune.id, emma.id], ctx.db)).toEqual({
      [emma.id]: "finished",
    });
  });

  it("succeeds for an id that is not shelved", async () => {
    await expect(
      removeFromShelfAction({ workId: "/works/OL999W" }),
    ).resolves.toStrictEqual({ ok: true });
  });
});
