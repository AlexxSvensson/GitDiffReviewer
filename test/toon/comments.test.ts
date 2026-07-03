import { describe, expect, it } from "vitest";
import { type Comment, decodeComments, encodeComments } from "../../src/toon/comments.js";

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
