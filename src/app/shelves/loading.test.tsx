import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ShelvesLoading from "./loading";

describe("ShelvesLoading", () => {
  it("shows a status region with the loading text", () => {
    render(<ShelvesLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading shelves");
  });

  it("does not render a heading (the layout owns it)", () => {
    render(<ShelvesLoading />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("hides the skeleton placeholders from assistive tech", () => {
    const { container } = render(<ShelvesLoading />);
    const list = container.querySelector("ul");
    expect(list).toHaveAttribute("aria-hidden", "true");
  });
});
