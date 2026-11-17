import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const status = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({
      pending: status.pending,
      data: null,
      method: null,
      action: null,
    }),
  };
});

import { SearchButton } from "./search-button";

function renderInForm() {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <SearchButton />
    </form>,
  );
  return onSubmit;
}

describe("SearchButton", () => {
  beforeEach(() => {
    status.pending = false;
  });

  describe("when idle", () => {
    it("shows a submit button labelled Search that is not aria-disabled", () => {
      renderInForm();
      const button = screen.getByRole("button", { name: "Search" });
      expect(button.getAttribute("type")).toBe("submit");
      expect(button.getAttribute("aria-disabled")).not.toBe("true");
    });

    it("submits the form when clicked", () => {
      const onSubmit = renderInForm();
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("when pending", () => {
    beforeEach(() => {
      status.pending = true;
    });

    it("is named Searching… and is neither aria-disabled nor disabled", () => {
      renderInForm();
      const button = screen.getByRole("button", {
        name: "Searching…",
      }) as HTMLButtonElement;
      expect(button.getAttribute("aria-disabled")).not.toBe("true");
      expect(button.disabled).toBe(false);
      expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    });

    it("still submits the form when clicked", () => {
      const onSubmit = renderInForm();
      fireEvent.click(screen.getByRole("button", { name: "Searching…" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("announces Searching… in the status region", () => {
      renderInForm();
      expect(screen.getByRole("status").textContent).toBe("Searching…");
    });
  });

  describe("status region", () => {
    it("exists and is empty when idle", () => {
      renderInForm();
      const region = screen.getByRole("status");
      expect(region).toBeTruthy();
      expect(region.textContent).toBe("");
    });

    it("is outside the button", () => {
      renderInForm();
      const button = screen.getByRole("button", { name: "Search" });
      expect(button.contains(screen.getByRole("status"))).toBe(false);
    });
  });
});
