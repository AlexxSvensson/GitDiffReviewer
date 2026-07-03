import { describe, expect, it } from "vitest";
import { combineComments, materializeVerdicts } from "../../src/frontend/comment-state.js";

describe("materializeVerdicts", () => {
  it("returns an empty array with no verdicts", () => {
    expect(materializeVerdicts({})).toEqual([]);
  });

  it("materializes a fixed-body file-scope comment per verdict", () => {
    expect(materializeVerdicts({ "src/a.ts": "good", "src/b.ts": "bad" })).toEqual(
      expect.arrayContaining([
        { scope: "file", file: "src/a.ts", line: "", body: "Looks good" },
        { scope: "file", file: "src/b.ts", line: "", body: "Looks bad" },
      ]),
    );
  });
});

describe("combineComments", () => {
  it("concatenates typed comments and materialized verdicts", () => {
    const typed = [{ scope: "change" as const, file: "src/a.ts", line: "10", body: "off by one" }];
    const result = combineComments(typed, { "src/a.ts": "bad" });
    expect(result).toEqual(
      expect.arrayContaining([
        { scope: "change", file: "src/a.ts", line: "10", body: "off by one" },
        { scope: "file", file: "src/a.ts", line: "", body: "Looks bad" },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it("returns just the typed comments when there are no verdicts", () => {
    const typed = [{ scope: "global" as const, file: "", line: "", body: "looks fine overall" }];
    expect(combineComments(typed, {})).toEqual(typed);
  });
});
