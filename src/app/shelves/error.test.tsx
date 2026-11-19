import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShelvesError from "./error";

function renderError(retry = vi.fn(), message = "secret db detail: SQLITE_BUSY") {
  const props = { error: new Error(message), retry } as unknown as Parameters<
    typeof ShelvesError
  >[0];
  render(<ShelvesError {...props} />);
  return retry;
}

describe("ShelvesError", () => {
  it("shows the friendly message in an alert", () => {
    renderError();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load your shelves. Please try again.",
    );
  });

  it("never shows the error's own text", () => {
    renderError(vi.fn(), "secret db detail: SQLITE_BUSY");
    expect(screen.queryByText(/SQLITE_BUSY/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
  });

  it("calls retry once when Try again is clicked", async () => {
    const retry = renderError();
    expect(retry).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("calls retry with no arguments", async () => {
    const retry = renderError();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledWith();
  });
});
