import { describe, expect, it } from "vitest";
import { buildCommentEntries, combineComments, materializeVerdicts } from "../../src/frontend/comment-state.js";

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

describe("buildCommentEntries", () => {
  it("tags typed comments with their array index for removal", () => {
    const typed = [
      { scope: "global" as const, file: "", line: "", body: "first" },
      { scope: "global" as const, file: "", line: "", body: "second" },
    ];
    const entries = buildCommentEntries(typed, {});
    expect(entries).toEqual([
      { kind: "typed", index: 0, comment: typed[0] },
      { kind: "typed", index: 1, comment: typed[1] },
    ]);
  });

  it("tags verdict comments with their file for removal", () => {
    const entries = buildCommentEntries([], { "src/a.ts": "good" });
    expect(entries).toEqual([
      { kind: "verdict", file: "src/a.ts", comment: { scope: "file", file: "src/a.ts", line: "", body: "Looks good" } },
    ]);
  });

  it("combines both kinds in one list", () => {
    const typed = [{ scope: "file" as const, file: "src/b.ts", line: "", body: "needs work" }];
    const entries = buildCommentEntries(typed, { "src/a.ts": "bad" });
    expect(entries).toHaveLength(2);
    expect(entries.filter((e) => e.kind === "typed")).toHaveLength(1);
    expect(entries.filter((e) => e.kind === "verdict")).toHaveLength(1);
  });
});
