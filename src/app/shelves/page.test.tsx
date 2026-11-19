import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/app/actions/shelves", () => ({ setShelfAction: vi.fn() }));

const calls: string[] = [];
const connection = vi.fn(async () => {
  calls.push("connection");
});
const getShelvedBooks = vi.fn();
vi.mock("next/server", () => ({ connection: () => connection() }));
vi.mock("@/lib/shelves", () => ({
  getShelvedBooks: () => getShelvedBooks(),
}));

import type { Book } from "@/lib/open-library";
import type { Shelf } from "@/lib/shelf";
import ShelvesPage from "./page";

function makeBook(n: number): Book {
  return {
    id: `/works/OL${n}W`,
    title: `Book ${n}`,
    authors: [`Author ${n}`],
    year: 2000 + n,
    coverId: null,
  };
}

function data(partial: Partial<Record<Shelf, Book[]>> = {}): Record<Shelf, Book[]> {
  return { want_to_read: [], reading: [], finished: [], ...partial };
}

async function renderPage() {
  render(await ShelvesPage());
}

beforeEach(() => {
  calls.length = 0;
  connection.mockClear();
  getShelvedBooks.mockReset();
  getShelvedBooks.mockImplementation(async () => {
    calls.push("getShelvedBooks");
    return data();
  });
});

describe("ShelvesPage", () => {
  it("calls connection() before getShelvedBooks()", async () => {
    await renderPage();
    expect(calls).toEqual(["connection", "getShelvedBooks"]);
  });

  it("does not read the database until connection() resolves", async () => {
    let release!: () => void;
    connection.mockImplementationOnce(
      () => new Promise<void>((r) => (release = r)),
    );
    const pending = ShelvesPage();
    await Promise.resolve();
    expect(getShelvedBooks).not.toHaveBeenCalled();
    release();
    await pending;
    expect(getShelvedBooks).toHaveBeenCalledTimes(1);
  });

  it("renders three sections in order with label and count", async () => {
    getShelvedBooks.mockResolvedValue(
      data({
        want_to_read: [makeBook(1)],
        reading: [makeBook(2), makeBook(3)],
        finished: [makeBook(4), makeBook(5), makeBook(6)],
      }),
    );
    await renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Want to read (1)", "Reading (2)", "Finished (3)"]);
  });

  it("renders each book on its own shelf with that shelf pressed", async () => {
    getShelvedBooks.mockResolvedValue(
      data({
        want_to_read: [makeBook(1)],
        reading: [makeBook(2)],
        finished: [makeBook(3)],
      }),
    );
    await renderPage();
    const expected = { "Book 1": "Want to read", "Book 2": "Reading", "Book 3": "Finished" };
    for (const [title, label] of Object.entries(expected)) {
      const group = screen.getByRole("group", { name: `Shelf for ${title}` });
      const pressed = within(group)
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
      expect(pressed[0]).toHaveTextContent(label);
    }
  });

  it("shows the empty message only in empty sections when some have books", async () => {
    getShelvedBooks.mockResolvedValue(data({ reading: [makeBook(1)] }));
    await renderPage();
    expect(screen.getAllByText("No books on this shelf yet.")).toHaveLength(2);
    expect(screen.queryByText("Your shelves are empty")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });

  it("shows the all-empty state with a link to /search and no section headings", async () => {
    await renderPage();
    expect(screen.getByText("Your shelves are empty")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText("No books on this shelf yet.")).not.toBeInTheDocument();
  });

  it("propagates a database failure so error.tsx handles it", async () => {
    getShelvedBooks.mockRejectedValue(new Error("db down"));
    await expect(ShelvesPage()).rejects.toThrow("db down");
  });

  it("propagates a connection() failure", async () => {
    connection.mockRejectedValueOnce(new Error("no request"));
    await expect(ShelvesPage()).rejects.toThrow("no request");
    expect(getShelvedBooks).not.toHaveBeenCalled();
  });
});
