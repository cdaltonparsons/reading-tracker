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

  it("links to the shelves page", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "My shelves" })).toHaveAttribute(
      "href",
      "/shelves",
    );
  });

  it("shows Search books before My shelves", () => {
    render(<Home />);
    const names = screen.getAllByRole("link").map((l) => l.textContent);
    expect(names.indexOf("Search books")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("My shelves")).toBeGreaterThan(
      names.indexOf("Search books"),
    );
  });
});
