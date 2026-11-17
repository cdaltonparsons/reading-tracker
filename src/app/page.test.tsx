import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("shows the app title", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Reading Tracker" }),
    ).toBeInTheDocument();
  });

  it("links to the search page", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Search books" })).toHaveAttribute(
      "href",
      "/search",
    );
  });
});
