import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SearchForm } from "./search-form";

function getInput() {
  return screen.getByRole("searchbox", { name: "Search books" }) as HTMLInputElement;
}

describe("SearchForm", () => {
  it("renders a search landmark form posting to /search", () => {
    render(<SearchForm />);
    const form = screen.getByRole("search");
    expect(form.tagName).toBe("FORM");
    expect(form.getAttribute("action")).toBe("/search");
  });

  it("renders a labelled search input named q", () => {
    render(<SearchForm />);
    const input = getInput();
    expect(input.getAttribute("type")).toBe("search");
    expect(input.name).toBe("q");
  });

  it("caps length at 200 and does not set required", () => {
    render(<SearchForm />);
    const input = getInput();
    expect(input.maxLength).toBe(200);
    expect(input.required).toBe(false);
  });

  it("renders a submit button inside the form", () => {
    render(<SearchForm />);
    const button = screen.getByRole("button", { name: "Search" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(screen.getByRole("search").contains(button)).toBe(true);
  });

  it("is empty when defaultQuery is omitted", () => {
    render(<SearchForm />);
    expect(getInput().value).toBe("");
  });

  it("pre-fills the input from defaultQuery", () => {
    render(<SearchForm defaultQuery="dune" />);
    expect(getInput().value).toBe("dune");
  });

  it("is empty for an empty-string defaultQuery", () => {
    render(<SearchForm defaultQuery="" />);
    expect(getInput().value).toBe("");
  });

  it("serializes the entered value under q", () => {
    render(<SearchForm defaultQuery="emma" />);
    const data = new FormData(screen.getByRole("search") as HTMLFormElement);
    expect(data.get("q")).toBe("emma");
  });

  describe("when defaultQuery changes on re-render", () => {
    it("replaces text the user typed with the new defaultQuery", () => {
      const { rerender } = render(<SearchForm defaultQuery="a" />);
      fireEvent.change(getInput(), { target: { value: "typed" } });
      expect(getInput().value).toBe("typed");

      rerender(<SearchForm defaultQuery="c" />);
      expect(getInput().value).toBe("c");
    });

    it("keeps what the user typed when defaultQuery is unchanged", () => {
      const { rerender } = render(<SearchForm defaultQuery="a" />);
      const before = getInput();
      fireEvent.change(before, { target: { value: "typed" } });

      rerender(<SearchForm defaultQuery="a" />);
      expect(getInput()).toBe(before);
      expect(getInput().value).toBe("typed");
    });

    it("clears the input when defaultQuery goes from a value to undefined", () => {
      const { rerender } = render(<SearchForm defaultQuery="a" />);
      fireEvent.change(getInput(), { target: { value: "typed" } });

      rerender(<SearchForm />);
      expect(getInput().value).toBe("");
    });
  });
});
