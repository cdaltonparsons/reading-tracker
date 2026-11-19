import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SetShelfResult } from "@/app/actions/shelves";
import { setShelfAction } from "@/app/actions/shelves";
import type { Book } from "@/lib/open-library";
import { ShelfControl } from "./shelf-control";

vi.mock("@/app/actions/shelves", () => ({ setShelfAction: vi.fn() }));

const mockAction = vi.mocked(setShelfAction);

const book: Book = {
  id: "/works/OL45883W",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: 1965,
  coverId: 123,
};

type Deferred = { promise: Promise<SetShelfResult>; resolve: (r: SetShelfResult) => void };

function deferred(): Deferred {
  let resolve!: (r: SetShelfResult) => void;
  const promise = new Promise<SetShelfResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

function pressedNames() {
  return screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent);
}

beforeEach(() => {
  mockAction.mockReset();
});

describe("ShelfControl", () => {
  it("renders a named group with three shelf buttons, none pressed when unshelved", () => {
    render(<ShelfControl book={book} shelf={null} />);
    const group = screen.getByRole("group", { name: "Shelf for Dune" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Want to read", "Reading", "Finished"]);
    expect(pressedNames()).toEqual([]);
  });

  it("marks only the current shelf as pressed", () => {
    render(<ShelfControl book={book} shelf="reading" />);
    expect(pressedNames()).toEqual(["Reading"]);
  });

  it("shows the clicked shelf as pressed before the save resolves and calls the action once", async () => {
    const d = deferred();
    mockAction.mockReturnValue(d.promise);
    const user = userEvent.setup();
    render(<ShelfControl book={book} shelf={null} />);

    await user.click(button("Finished"));

    expect(pressedNames()).toEqual(["Finished"]);
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(mockAction).toHaveBeenCalledWith({ book, shelf: "finished" });

    await act(async () => d.resolve({ ok: true, shelf: "finished" }));
  });

  it("announces success, shows no alert, and keeps the shelf once the server refreshes", async () => {
    const d = deferred();
    mockAction.mockReturnValue(d.promise);
    const user = userEvent.setup();
    const { rerender } = render(<ShelfControl book={book} shelf={null} />);

    await user.click(button("Finished"));
    await act(async () => d.resolve({ ok: true, shelf: "finished" }));

    expect(await screen.findByText("Saved to Finished")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved to Finished");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<ShelfControl book={book} shelf="finished" />);
    expect(pressedNames()).toEqual(["Finished"]);
  });

  it.each([
    ["the action returns ok: false", () => mockAction.mockResolvedValue({ ok: false })],
    ["the action rejects", () => mockAction.mockRejectedValue(new Error("network down"))],
  ])("shows an alert and reverts the pressed state when %s", async (_label, setup) => {
    setup();
    const user = userEvent.setup();
    render(<ShelfControl book={book} shelf="reading" />);

    await user.click(button("Finished"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save. Please try again.");
    await waitFor(() => expect(pressedNames()).toEqual(["Reading"]));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("clears the alert when a later save succeeds", async () => {
    mockAction.mockResolvedValueOnce({ ok: false });
    mockAction.mockResolvedValueOnce({ ok: true, shelf: "finished" });
    const user = userEvent.setup();
    render(<ShelfControl book={book} shelf={null} />);

    await user.click(button("Finished"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(button("Finished"));
    expect(await screen.findByText("Saved to Finished")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not call the action when the current shelf is clicked", async () => {
    const user = userEvent.setup();
    render(<ShelfControl book={book} shelf="reading" />);

    await user.click(button("Reading"));

    expect(mockAction).not.toHaveBeenCalled();
    expect(pressedNames()).toEqual(["Reading"]);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  describe("overlapping clicks", () => {
    async function clickReadingThenFinished() {
      const first = deferred();
      const second = deferred();
      mockAction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const user = userEvent.setup();
      render(<ShelfControl book={book} shelf={null} />);
      await user.click(button("Reading"));
      await user.click(button("Finished"));
      return { first, second };
    }

    it("shows the latest click as the only pressed button while both saves are pending", async () => {
      const { first, second } = await clickReadingThenFinished();

      expect(mockAction).toHaveBeenCalledTimes(2);
      expect(pressedNames()).toEqual(["Finished"]);

      await act(async () => {
        first.resolve({ ok: true, shelf: "reading" });
        second.resolve({ ok: true, shelf: "finished" });
      });
    });

    it("ends with the message for the last click when saves resolve in order", async () => {
      const { first, second } = await clickReadingThenFinished();

      await act(async () => first.resolve({ ok: true, shelf: "reading" }));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      await act(async () => second.resolve({ ok: true, shelf: "finished" }));
      expect(screen.getByRole("status")).toHaveTextContent("Saved to Finished");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("ignores a slow earlier success that resolves after the later save", async () => {
      const { first, second } = await clickReadingThenFinished();

      await act(async () => second.resolve({ ok: true, shelf: "finished" }));
      await act(async () => first.resolve({ ok: true, shelf: "reading" }));

      expect(screen.getByRole("status")).toHaveTextContent("Saved to Finished");
      expect(screen.queryByText("Saved to Reading")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("ignores a slow earlier failure that resolves after the later save", async () => {
      const { first, second } = await clickReadingThenFinished();

      await act(async () => second.resolve({ ok: true, shelf: "finished" }));
      await act(async () => first.resolve({ ok: false }));

      expect(screen.getByRole("status")).toHaveTextContent("Saved to Finished");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("does not disable any button while a save is pending", async () => {
    const d = deferred();
    mockAction.mockReturnValue(d.promise);
    const user = userEvent.setup();
    render(<ShelfControl book={book} shelf={null} />);

    await user.click(button("Reading"));

    for (const b of screen.getAllByRole("button")) {
      expect(b).toBeEnabled();
    }

    await act(async () => d.resolve({ ok: true, shelf: "reading" }));
  });

  it("renders an empty status live region before any click", () => {
    render(<ShelfControl book={book} shelf={null} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
