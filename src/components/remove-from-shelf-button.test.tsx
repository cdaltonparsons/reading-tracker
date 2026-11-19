import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoveFromShelfResult } from "@/app/actions/shelves";
import { removeFromShelfAction } from "@/app/actions/shelves";
import { RemoveFromShelfButton } from "./remove-from-shelf-button";

vi.mock("@/app/actions/shelves", () => ({
  removeFromShelfAction: vi.fn(),
  setShelfAction: vi.fn(),
}));

const mockAction = vi.mocked(removeFromShelfAction);

function deferred() {
  let resolve!: (r: RemoveFromShelfResult) => void;
  const promise = new Promise<RemoveFromShelfResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function removeButton(title = "Dune") {
  return screen.getByRole("button", { name: `Remove ${title} from your shelves` });
}

beforeEach(() => {
  mockAction.mockReset();
  vi.restoreAllMocks();
});

describe("RemoveFromShelfButton", () => {
  it("shows the text 'Remove' with an accessible name naming the title", () => {
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);
    const b = removeButton();
    expect(b).toHaveTextContent("Remove");
    expect(b.textContent).toBe("Remove");
    expect(b).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls the action once with exactly { workId } on click", async () => {
    const d = deferred();
    mockAction.mockReturnValue(d.promise);
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());

    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(mockAction.mock.calls[0]).toEqual([{ workId: "/works/OL1W" }]);
    expect(Object.keys(mockAction.mock.calls[0][0] as object)).toEqual(["workId"]);

    await act(async () => d.resolve({ ok: true }));
  });

  it("is disabled and reads 'Removing…' while pending", async () => {
    const d = deferred();
    mockAction.mockReturnValue(d.promise);
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());

    const b = removeButton();
    expect(b).toBeDisabled();
    expect(b).toHaveTextContent("Removing…");

    await act(async () => d.resolve({ ok: true }));
  });

  it("does not call the action again when clicked while pending", async () => {
    const d = deferred();
    mockAction.mockReturnValue(d.promise);
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());
    await user.click(removeButton());

    expect(mockAction).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve({ ok: true }));
  });

  it("shows an alert and re-enables the button when the action returns ok: false", async () => {
    mockAction.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove. Please try again.");
    await waitFor(() => expect(removeButton()).toBeEnabled());
    expect(removeButton()).toHaveTextContent("Remove");
    expect(removeButton().textContent).toBe("Remove");
  });

  it("shows the same alert and re-enables the button when the action rejects", async () => {
    mockAction.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't remove. Please try again.");
    await waitFor(() => expect(removeButton()).toBeEnabled());
    expect(removeButton().textContent).toBe("Remove");
  });

  it("clears the alert while a retry is pending and leaves none after a successful retry", async () => {
    const d = deferred();
    mockAction.mockResolvedValueOnce({ ok: false });
    mockAction.mockReturnValueOnce(d.promise);
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() => expect(removeButton()).toBeEnabled());

    await user.click(removeButton());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(removeButton()).toBeDisabled();

    await act(async () => d.resolve({ ok: true }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockAction).toHaveBeenCalledTimes(2);
  });

  it("shows no alert after a successful remove", async () => {
    mockAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());

    await waitFor(() => expect(removeButton()).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it("opens no confirmation dialog when clicked", async () => {
    const confirmSpy = vi.fn(() => true);
    const alertSpy = vi.fn();
    const promptSpy = vi.fn();
    vi.stubGlobal("confirm", confirmSpy);
    vi.stubGlobal("alert", alertSpy);
    vi.stubGlobal("prompt", promptSpy);
    mockAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL1W" title="Dune" />);

    await user.click(removeButton());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockAction).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("uses the given workId and title for each instance", async () => {
    mockAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RemoveFromShelfButton workId="/works/OL99W" title="Emma" />);

    await user.click(removeButton("Emma"));

    expect(mockAction).toHaveBeenCalledWith({ workId: "/works/OL99W" });
  });
});
