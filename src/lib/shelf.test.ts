import { describe, expect, it } from "vitest";
import { SHELF_LABELS, SHELVES } from "./shelf";

describe("shelves", () => {
  it("has a non-empty label for every shelf and no extras", () => {
    expect(Object.keys(SHELF_LABELS).sort()).toEqual([...SHELVES].sort());
    for (const s of SHELVES) expect(SHELF_LABELS[s].length).toBeGreaterThan(0);
  });
});
