import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/search-box", () => ({
  SearchBox: () => <div data-testid="search-box" />,
}));

import SearchLayout from "./layout";

function renderLayout() {
  const props = {
    children: <div data-testid="child" />,
    params: Promise.resolve({}),
  } as unknown as Parameters<typeof SearchLayout>[0];
  return render(SearchLayout(props));
}

describe("SearchLayout", () => {
  it("renders the page heading", () => {
    renderLayout();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search books");
  });

  it("renders the search box and then its children, inside main", () => {
    renderLayout();
    const main = screen.getByRole("main");
    const box = screen.getByTestId("search-box");
    const child = screen.getByTestId("child");
    expect(main).toContainElement(box);
    expect(main).toContainElement(child);
    expect(box.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("falls back to a plain search form while the box is suspended", async () => {
    vi.resetModules();
    vi.doMock("@/components/search-box", () => ({
      SearchBox: () => {
        throw new Promise(() => {});
      },
    }));
    const { default: Layout } = await import("./layout");
    render(
      Layout({ children: null, params: Promise.resolve({}) } as unknown as Parameters<typeof Layout>[0]),
    );
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search books" })).toHaveValue("");
    vi.doUnmock("@/components/search-box");
  });
});
