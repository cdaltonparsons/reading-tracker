import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/shelves", () => ({
  setShelf: vi.fn(),
  removeFromShelf: vi.fn(),
}));

import { refresh } from "next/cache";
import { removeFromShelf, setShelf } from "@/lib/shelves";
import { removeFromShelfAction, setShelfAction } from "./shelves";

const book = {
  id: "/works/OL45883W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};

const mockedSetShelf = vi.mocked(setShelf);
const mockedRemove = vi.mocked(removeFromShelf);
const mockedRefresh = vi.mocked(refresh);

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  mockedSetShelf.mockResolvedValue(undefined as never);
  mockedRemove.mockResolvedValue(undefined as never);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("setShelfAction", () => {
  it("saves a valid book and refreshes once", async () => {
    const result = await setShelfAction({ book, shelf: "reading" });

    expect(mockedSetShelf).toHaveBeenCalledTimes(1);
    expect(mockedSetShelf).toHaveBeenCalledWith(book, "reading");
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, shelf: "reading" });
    expect(Object.keys(result).sort()).toEqual(["ok", "shelf"]);
  });

  it("saves the parsed (trimmed) values", async () => {
    await setShelfAction({
      book: { ...book, title: "  Dune  ", authors: ["  Frank Herbert "] },
      shelf: "finished",
    });

    expect(mockedSetShelf).toHaveBeenCalledWith(
      { ...book, title: "Dune", authors: ["Frank Herbert"] },
      "finished",
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "reading"],
    ["an empty object", {}],
    ["a missing book", { shelf: "reading" }],
    ["a missing shelf", { book }],
    ["an unknown shelf", { book, shelf: "abandoned" }],
    ["a bad book id", { book: { ...book, id: "OL45883W" }, shelf: "reading" }],
    ["an empty title", { book: { ...book, title: "" }, shelf: "reading" }],
    ["a cover id of 0", { book: { ...book, coverId: 0 }, shelf: "reading" }],
  ])("rejects invalid input: %s", async (_name, input) => {
    const result = await setShelfAction(input);

    expect(result).toStrictEqual({ ok: false });
    expect(mockedSetShelf).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("strips unknown extra keys instead of rejecting them", async () => {
    const result = await setShelfAction({
      book: { ...book, evil: "book-extra" },
      shelf: "reading",
      extra: "top-extra",
    });

    expect(result).toEqual({ ok: true, shelf: "reading" });
    expect(mockedSetShelf).toHaveBeenCalledTimes(1);
    const [savedBook, savedShelf] = mockedSetShelf.mock.calls[0];
    expect(savedShelf).toBe("reading");
    expect(savedBook).toEqual(book);
    expect(savedBook).not.toHaveProperty("evil");
  });

  it("returns only { ok: false } when the database fails", async () => {
    mockedSetShelf.mockRejectedValue(
      new Error("SQLITE_CONSTRAINT secret detail"),
    );

    const result = await setShelfAction({ book, shelf: "reading" });

    expect(result).toStrictEqual({ ok: false });
    expect(mockedRefresh).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("SQLITE_CONSTRAINT");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("refreshes once per successful call", async () => {
    await setShelfAction({ book, shelf: "reading" });
    expect(mockedRefresh).toHaveBeenCalledTimes(1);

    await setShelfAction({ book, shelf: "finished" });
    expect(mockedRefresh).toHaveBeenCalledTimes(2);
    expect(mockedSetShelf).toHaveBeenCalledTimes(2);
  });
});

describe("removeFromShelfAction", () => {
  const workId = "/works/OL45883W";

  it("removes a valid work id and refreshes once", async () => {
    const result = await removeFromShelfAction({ workId });

    expect(result).toStrictEqual({ ok: true });
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedRemove).toHaveBeenCalledWith(workId);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", workId],
    ["an empty object", {}],
    ["a missing workId", { id: workId }],
    ["a null workId", { workId: null }],
    ["a numeric workId", { workId: 123 }],
    ["an array workId", { workId: [workId] }],
    ["an object workId", { workId: { id: workId } }],
    ["a workId without the /works/ prefix", { workId: "/abc" }],
    ["the workId /works/abc", { workId: "/works/abc" }],
    ["a bad id format", { workId: "OL45883W" }],
    ["an empty workId", { workId: "" }],
    ["a workId with trailing text", { workId: "/works/OL1W/extra" }],
    ["a workId with a newline suffix", { workId: "/works/OL1W\n" }],
  ])("rejects invalid input: %s", async (_name, input) => {
    const result = await removeFromShelfAction(input);

    expect(result).toStrictEqual({ ok: false });
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("strips extra keys and still succeeds", async () => {
    const result = await removeFromShelfAction({
      workId,
      extra: "x",
      shelf: "reading",
    });

    expect(result).toStrictEqual({ ok: true });
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedRemove.mock.calls[0]).toEqual([workId]);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it("returns only { ok: false } and logs when the database fails", async () => {
    mockedRemove.mockRejectedValue(
      new Error("SQLITE_BUSY secret detail"),
    );

    const result = await removeFromShelfAction({ workId });

    expect(result).toStrictEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("SQLITE_BUSY");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("does not refresh after a database failure", async () => {
    mockedRemove.mockRejectedValue(new Error("boom"));

    await removeFromShelfAction({ workId });

    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("does not throw when the database throws synchronously", async () => {
    mockedRemove.mockImplementation(() => {
      throw new Error("sync boom");
    });

    await expect(removeFromShelfAction({ workId })).resolves.toStrictEqual({
      ok: false,
    });
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it("refreshes once per successful call", async () => {
    await removeFromShelfAction({ workId });
    await removeFromShelfAction({ workId });

    expect(mockedRefresh).toHaveBeenCalledTimes(2);
  });
});
