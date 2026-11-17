import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { isValidElement, use } from "react";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn(),
}));

// Results is stubbed (it is async and hits the network); ResultsSkeleton is the
// real component so the Suspense fallback test checks the page's actual wiring
// rather than a stub that always renders.
const resultsProps: Array<{ searchParams: unknown }> = [];
let suspend = false;
vi.mock("./results", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./results")>()),
  Results: (props: { searchParams: unknown }) => {
    resultsProps.push(props);
    if (suspend) use(new Promise<never>(() => {}));
    return <div data-testid="results" />;
  },
}));

import SearchPage from "./page";

function makeProps(q?: string) {
  const searchParams = Promise.resolve(q === undefined ? {} : { q });
  // Detect any access to the promise (e.g. awaiting it via .then).
  const then = vi.spyOn(searchParams, "then");
  return {
    searchParams,
    props: { params: Promise.resolve({}), searchParams } as unknown as Parameters<typeof SearchPage>[0],
    then,
  };
}

beforeEach(() => {
  resultsProps.length = 0;
  suspend = false;
});

describe("SearchPage", () => {
  it("is a static shell: synchronous, returns an element, never awaits searchParams", () => {
    const { props, then } = makeProps("dune");
    const out = SearchPage(props);
    expect(out).not.toBeInstanceOf(Promise);
    expect(isValidElement(out)).toBe(true);
    render(out);
    expect(then).not.toHaveBeenCalled();
  });

  it("passes the page's own searchParams promise through to Results", () => {
    const { props, searchParams } = makeProps("dune");
    render(SearchPage(props));
    expect(resultsProps.length).toBeGreaterThan(0);
    expect(resultsProps[0].searchParams).toBe(searchParams);
  });

  it("shows the results skeleton while Results is suspended", () => {
    suspend = true;
    render(SearchPage(makeProps("dune").props));
    expect(screen.getByRole("status")).toHaveTextContent("Loading results");
    expect(screen.queryByTestId("results")).not.toBeInTheDocument();
  });

  it("does not show the skeleton once Results has rendered", () => {
    render(SearchPage(makeProps("dune").props));
    expect(screen.getByTestId("results")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
