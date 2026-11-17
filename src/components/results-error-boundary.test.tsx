import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsErrorBoundary } from "./results-error-boundary";

function Thrower(): never {
  throw new Error("secret upstream detail");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResultsErrorBoundary", () => {
  it("shows a friendly message in an alert when a child throws", () => {
    render(
      <ResultsErrorBoundary>
        <Thrower />
      </ResultsErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't reach Open Library",
    );
  });

  it("never shows the raw error message", () => {
    render(
      <ResultsErrorBoundary>
        <Thrower />
      </ResultsErrorBoundary>,
    );
    expect(screen.queryByText(/secret upstream detail/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("secret upstream detail");
  });

  it("renders children and no alert when nothing throws", () => {
    render(
      <ResultsErrorBoundary>
        <p>all good</p>
      </ResultsErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a Try again button", () => {
    render(
      <ResultsErrorBoundary>
        <Thrower />
      </ResultsErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("Try again re-renders the children so a transient failure recovers", async () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("secret upstream detail");
      return <p>recovered</p>;
    }
    render(
      <ResultsErrorBoundary>
        <Flaky />
      </ResultsErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("when the parent re-renders with different children", () => {
    let shouldThrow = true;
    function Flaky({ label }: { label: string }) {
      if (shouldThrow) throw new Error("down");
      return <p>{label}</p>;
    }
    const tree = (key: string, label: string) => (
      <ResultsErrorBoundary key={key}>
        <Flaky label={label} />
      </ResultsErrorBoundary>
    );

    beforeEach(() => {
      shouldThrow = true;
    });

    // This is the original bug: without a changing key the boundary keeps its
    // error state across a re-render, so the old alert stays on screen.
    it("keeps the alert when the key stays the same", () => {
      const { rerender } = render(tree("a", "a results"));
      expect(screen.getByRole("alert")).toBeInTheDocument();

      shouldThrow = false;
      rerender(tree("a", "b results"));

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText("b results")).not.toBeInTheDocument();
    });

    it("clears the alert and renders the children when the key changes", () => {
      const { rerender } = render(tree("a", "a results"));
      expect(screen.getByRole("alert")).toBeInTheDocument();

      shouldThrow = false;
      rerender(tree("b", "b results"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("b results")).toBeInTheDocument();
    });
  });
});
