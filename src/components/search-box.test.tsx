import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const url = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(url.query),
}));

import { SearchBox } from "./search-box";

function input() {
  return screen.getByRole("searchbox", { name: "Search books" }) as HTMLInputElement;
}
function type(text: string) {
  fireEvent.change(input(), { target: { value: text } });
}
function submit() {
  fireEvent.submit(screen.getByRole("search"));
}

// Simulates the URL changing, as Next does after a navigation.
function setup(query: string) {
  url.query = query;
  const view = render(<SearchBox />);
  return {
    goto(next: string) {
      url.query = next;
      view.rerender(<SearchBox />);
    },
  };
}

beforeEach(() => {
  url.query = "";
});

describe("SearchBox", () => {
  describe("first render", () => {
    it("shows the normalised q", () => {
      setup("q=%20dune%20");
      expect(input().value).toBe("dune");
    });

    it("is empty without q", () => {
      setup("");
      expect(input().value).toBe("");
    });
  });

  it("keeps the user's correction when their own search finishes (focus and node survive)", () => {
    const { goto } = setup("q=dune");
    const before = input();
    before.focus();
    type("foundation");
    submit();
    type("neuromancer");

    goto("q=foundation");

    expect(input()).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(input().value).toBe("neuromancer");
  });

  it("shows the normalised query when the user submitted and did not edit", () => {
    const { goto } = setup("q=dune");
    type("  foundation ");
    submit();
    goto("q=foundation");
    expect(input().value).toBe("foundation");
  });

  it("normalises the box on submit even when q only differs by whitespace", () => {
    const { goto } = setup("q=dune");
    type("  dune ");
    submit();
    goto("q=++dune+"); // normalised q is unchanged, so the adjust block does not run
    expect(input().value).toBe("dune");
  });

  it("follows Back/Forward over unsubmitted typing", () => {
    const { goto } = setup("q=foundation");
    type("xyz");
    goto("q=dune");
    expect(input().value).toBe("dune");
  });

  it("follows Back/Forward after submit+edit when q differs from submitted", () => {
    const { goto } = setup("q=foundation");
    type("foundation2");
    submit();
    type("neuromancer");
    goto("q=dune");
    expect(input().value).toBe("dune");
  });

  it("clears the box when q is removed", () => {
    const { goto } = setup("q=dune");
    goto("");
    expect(input().value).toBe("");
  });

  it("never remounts the input across query changes", () => {
    const { goto } = setup("q=dune");
    const before = input();
    goto("q=foundation");
    goto("q=neuromancer");
    goto("");
    expect(input()).toBe(before);
  });

  it("does not let a stale edit flag protect text from a later unrelated change", () => {
    const { goto } = setup("q=dune");
    type("foundation");
    submit();
    type("neuromancer");
    goto("q=foundation"); // keeps neuromancer, clears the flags
    goto("q=dune");
    expect(input().value).toBe("dune");
  });
});
