import { describe, expect, it, vi } from "vitest";
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
    const button = screen.getByRole("button", { name: "Search" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(form.contains(button)).toBe(true);
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

  it("is empty and uncontrolled with no props", () => {
    render(<SearchForm />);
    expect(getInput().value).toBe("");
    fireEvent.change(getInput(), { target: { value: "typed" } });
    expect(getInput().value).toBe("typed");
  });

  it("shows the value it is given", () => {
    render(<SearchForm value="dune" onChange={() => {}} />);
    expect(getInput().value).toBe("dune");
  });

  it("is controlled: the input follows value, not what was typed", () => {
    const { rerender } = render(<SearchForm value="a" onChange={() => {}} />);
    fireEvent.change(getInput(), { target: { value: "typed" } });
    expect(getInput().value).toBe("a");
    rerender(<SearchForm value="c" onChange={() => {}} />);
    expect(getInput().value).toBe("c");
  });

  it("calls onChange when the user types", () => {
    const onChange = vi.fn();
    render(<SearchForm value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit when the form is submitted", () => {
    const onSubmit = vi.fn();
    render(<SearchForm onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
