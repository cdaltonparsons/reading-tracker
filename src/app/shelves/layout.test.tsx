import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ShelvesLayout from "./layout";

function renderLayout() {
  const props = {
    children: <div data-testid="child" />,
    params: Promise.resolve({}),
  } as unknown as Parameters<typeof ShelvesLayout>[0];
  return render(ShelvesLayout(props));
}

describe("ShelvesLayout", () => {
  it("renders the My shelves level-1 heading", () => {
    renderLayout();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My shelves");
  });

  it("renders the heading and then its children inside main", () => {
    renderLayout();
    const main = screen.getByRole("main");
    const h1 = screen.getByRole("heading", { level: 1 });
    const child = screen.getByTestId("child");
    expect(main).toContainElement(h1);
    expect(main).toContainElement(child);
    expect(h1.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
