import { describe, expect, it } from "vitest";
import { matchesFilters } from "../../src/frontend/filters.js";
import type { FilePayload } from "../../src/review/types.js";

function file(path: string): FilePayload {
  return { status: "modified", path, binary: false, hunkDiff: "", expandedDiff: "" };
}

describe("matchesFilters", () => {
  it("matches everything with an empty query and verdictFilter=all", () => {
    expect(matchesFilters(file("src/a.ts"), null, "", "all")).toBe(true);
    expect(matchesFilters(file("src/a.ts"), "good", "", "all")).toBe(true);
  });

  it("filters by path substring case-insensitively", () => {
    expect(matchesFilters(file("src/Handlers/A.ts"), null, "handlers", "all")).toBe(true);
    expect(matchesFilters(file("src/other.ts"), null, "handlers", "all")).toBe(false);
  });

  it("filters by verdict, treating an unset verdict as 'none'", () => {
    expect(matchesFilters(file("a.ts"), "good", "", "good")).toBe(true);
    expect(matchesFilters(file("a.ts"), "bad", "", "good")).toBe(false);
    expect(matchesFilters(file("a.ts"), null, "", "none")).toBe(true);
    expect(matchesFilters(file("a.ts"), "good", "", "none")).toBe(false);
  });

  it("requires both path and verdict to match (AND logic)", () => {
    expect(matchesFilters(file("src/a.ts"), "good", "a.ts", "good")).toBe(true);
    expect(matchesFilters(file("src/a.ts"), "bad", "a.ts", "good")).toBe(false);
    expect(matchesFilters(file("src/a.ts"), "good", "nomatch", "good")).toBe(false);
  });
});
