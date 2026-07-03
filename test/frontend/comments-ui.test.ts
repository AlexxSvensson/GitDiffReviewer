import { describe, expect, it } from "vitest";
import { createCommentsState } from "../../src/frontend/comments-ui.js";

describe("createCommentsState", () => {
  it("starts empty", () => {
    const state = createCommentsState(() => {});
    expect(state.getAll()).toEqual([]);
  });

  it("add() appends a typed comment and notifies onChange", () => {
    const changes: number[] = [];
    const state = createCommentsState((comments) => changes.push(comments.length));

    state.add({ scope: "global", file: "", line: "", body: "looks fine overall" });

    expect(state.getAll()).toEqual([{ scope: "global", file: "", line: "", body: "looks fine overall" }]);
    expect(changes).toEqual([1]);
  });

  it("setVerdict materializes a file-scope comment with a fixed body", () => {
    const state = createCommentsState(() => {});

    state.setVerdict("src/a.ts", "good");
    expect(state.getAll()).toEqual([{ scope: "file", file: "src/a.ts", line: "", body: "Looks good" }]);

    state.setVerdict("src/b.ts", "bad");
    expect(state.getAll()).toEqual(
      expect.arrayContaining([
        { scope: "file", file: "src/a.ts", line: "", body: "Looks good" },
        { scope: "file", file: "src/b.ts", line: "", body: "Looks bad" },
      ]),
    );
  });

  it("setVerdict(file, null) clears a previously set verdict", () => {
    const state = createCommentsState(() => {});
    state.setVerdict("src/a.ts", "good");
    state.setVerdict("src/a.ts", null);
    expect(state.getAll()).toEqual([]);
    expect(state.getVerdict("src/a.ts")).toBeNull();
  });

  it("switching from good to bad replaces rather than duplicates", () => {
    const state = createCommentsState(() => {});
    state.setVerdict("src/a.ts", "good");
    state.setVerdict("src/a.ts", "bad");
    expect(state.getAll()).toEqual([{ scope: "file", file: "src/a.ts", line: "", body: "Looks bad" }]);
  });

  it("getVerdict defaults to null for a file with no verdict set", () => {
    const state = createCommentsState(() => {});
    expect(state.getVerdict("never-touched.ts")).toBeNull();
  });

  it("combines typed comments and verdicts in getAll()", () => {
    const state = createCommentsState(() => {});
    state.add({ scope: "change", file: "src/a.ts", line: "10", body: "off by one" });
    state.setVerdict("src/a.ts", "bad");
    expect(state.getAll()).toEqual(
      expect.arrayContaining([
        { scope: "change", file: "src/a.ts", line: "10", body: "off by one" },
        { scope: "file", file: "src/a.ts", line: "", body: "Looks bad" },
      ]),
    );
    expect(state.getAll()).toHaveLength(2);
  });
});
