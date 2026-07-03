import { describe, expect, it } from "vitest";
import { type Comment, coerceComments, decodeComments, encodeComments } from "../../src/toon/comments.js";

describe("comments TOON round-trip", () => {
  const sample: Comment[] = [
    { scope: "change", file: "src/models.py", line: "42", body: "Missing index on FK" },
    { scope: "file", file: "src/views.py", line: "", body: "Whole file needs refactor" },
    { scope: "global", file: "", line: "", body: "Looks good overall" },
  ];

  it("round-trips through encode/decode", () => {
    const encoded = encodeComments(sample);
    expect(decodeComments(encoded)).toEqual(sample);
  });

  it("never emits a literal null for absent fields", () => {
    const encoded = encodeComments(sample);
    expect(encoded).not.toMatch(/\bnull\b/);
  });

  it("decodes an empty comment list", () => {
    expect(decodeComments(encodeComments([]))).toEqual([]);
  });
});

describe("coerceComments", () => {
  it("accepts a well-formed array and fills in '' for absent file/line", () => {
    const result = coerceComments([{ scope: "global", body: "looks good" }]);
    expect(result).toEqual([{ scope: "global", file: "", line: "", body: "looks good" }]);
  });

  it("rejects a non-array payload", () => {
    expect(() => coerceComments({ scope: "global", body: "x" })).toThrow(/array/);
  });

  it("rejects an invalid scope", () => {
    expect(() => coerceComments([{ scope: "bogus", body: "x" }])).toThrow(/scope/);
  });

  it("rejects an empty body", () => {
    expect(() => coerceComments([{ scope: "global", body: "  " }])).toThrow(/body/);
  });
});
