import { describe, expect, it } from "vitest";
import { normalizeQuery } from "./query";

describe("normalizeQuery", () => {
  it.each([
    ["undefined", undefined, ""],
    ["whitespace-only", "   \t ", ""],
    ["an empty array", [], ""],
    ["an array (first element wins)", ["dune", "x"], "dune"],
    ["surrounding whitespace", "  dune \n", "dune"],
    ["more than 200 characters", "a".repeat(300), "a".repeat(200)],
    [
      "a space at the 200 character cut (trimmed after slicing)",
      "a".repeat(199) + " " + "b".repeat(10),
      "a".repeat(199),
    ],
  ])("normalizes %s", (_label, input, expected) => {
    expect(normalizeQuery(input)).toBe(expected);
  });
});
