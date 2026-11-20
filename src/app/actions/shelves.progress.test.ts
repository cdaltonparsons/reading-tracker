import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/shelves", () => ({
  setShelf: vi.fn(),
  removeFromShelf: vi.fn(),
  setCurrentPage: vi.fn(),
}));

import { refresh } from "next/cache";
import { MAX_CURRENT_PAGE } from "@/lib/book-limits";
import { setCurrentPage } from "@/lib/shelves";
import { setCurrentPageAction } from "./shelves";

const workId = "/works/OL45883W";

const mockedSetPage = vi.mocked(setCurrentPage);
const mockedRefresh = vi.mocked(refresh);

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  mockedSetPage.mockResolvedValue(true);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("setCurrentPageAction", () => {
  it("saves a valid page, refreshes once and returns the page", async () => {
    const result = await setCurrentPageAction({ workId, page: 42 });

    expect(mockedSetPage).toHaveBeenCalledTimes(1);
    expect(mockedSetPage).toHaveBeenCalledWith(workId, 42);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({ ok: true, page: 42 });
  });

  it("is exact at the upper bound: 100000 accepted", async () => {
    expect(MAX_CURRENT_PAGE).toBe(100_000);
    const result = await setCurrentPageAction({ workId, page: 100000 });

    expect(result).toStrictEqual({ ok: true, page: 100000 });
    expect(mockedSetPage).toHaveBeenCalledWith(workId, 100000);
  });

  it("accepts the lower bound, page 1", async () => {
    const result = await setCurrentPageAction({ workId, page: 1 });

    expect(result).toStrictEqual({ ok: true, page: 1 });
  });

  it.each([
    ["null input", null],
    ["undefined input", undefined],
    ["a string input", "42"],
    ["page 0", { workId, page: 0 }],
    ["page -1", { workId, page: -1 }],
    ["page 1.5", { workId, page: 1.5 }],
    ["page 100001", { workId, page: 100001 }],
    ["page as string \"42\"", { workId, page: "42" }],
    ["page NaN", { workId, page: NaN }],
    ["page Infinity", { workId, page: Infinity }],
    ["page null", { workId, page: null }],
    ["a missing page", { workId }],
    ["a missing workId", { page: 42 }],
    ["a bad workId", { workId: "/works/abc", page: 42 }],
    ["a workId without the /works/ prefix", { workId: "OL45883W", page: 42 }],
    ["an empty workId", { workId: "", page: 42 }],
  ])("rejects invalid input without side effects: %s", async (_name, input) => {
    const result = await setCurrentPageAction(input);

    expect(result).toStrictEqual({ ok: false });
    expect(mockedSetPage).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("strips unknown extra keys instead of rejecting them", async () => {
    const result = await setCurrentPageAction({
      workId,
      page: 42,
      extra: "nope",
    });

    expect(result).toStrictEqual({ ok: true, page: 42 });
    expect(mockedSetPage).toHaveBeenCalledTimes(1);
    expect(mockedSetPage.mock.calls[0]).toEqual([workId, 42]);
  });

  it("returns { ok: false } for a book not on Reading, with no refresh and no log", async () => {
    mockedSetPage.mockResolvedValue(false);

    const result = await setCurrentPageAction({ workId, page: 42 });

    expect(result).toStrictEqual({ ok: false });
    expect(mockedSetPage).toHaveBeenCalledTimes(1);
    expect(mockedRefresh).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns { ok: false }, logs and does not refresh when the database fails", async () => {
    mockedSetPage.mockRejectedValue(new Error("SECRET db failure"));

    const result = await setCurrentPageAction({ workId, page: 42 });

    expect(result).toStrictEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("never puts error text in the result", async () => {
    mockedSetPage.mockRejectedValue(new Error("SECRET db failure"));

    const result = await setCurrentPageAction({ workId, page: 42 });

    expect(Object.keys(result)).toEqual(["ok"]);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});
