import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readCommentsRaw, readMeta, writeCommentsRaw, writeMeta } from "../../src/review/store.js";

describe("review store", () => {
  let home: string;
  const originalHome = process.env.DIFF_REVIEW_HOME;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "diff-review-store-"));
    process.env.DIFF_REVIEW_HOME = home;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.DIFF_REVIEW_HOME;
    } else {
      process.env.DIFF_REVIEW_HOME = originalHome;
    }
    await rm(home, { recursive: true, force: true });
  });

  it("returns null for a review that was never created", async () => {
    expect(await readMeta("does-not-exist")).toBeNull();
    expect(await readCommentsRaw("does-not-exist")).toBeNull();
  });

  it("round-trips meta.json", async () => {
    const meta = {
      repoRoot: "/some/repo",
      baseRef: "HEAD",
      staged: false,
      createdAt: new Date().toISOString(),
      changedFiles: ["a.txt", "b.txt"],
    };
    await writeMeta("abc123", meta);
    expect(await readMeta("abc123")).toEqual(meta);
  });

  it("round-trips comments.toon as a raw string", async () => {
    const toonText = "comments[1]{scope,file,line,body}:\n  global,,,hello\n";
    await writeCommentsRaw("abc123", toonText);
    expect(await readCommentsRaw("abc123")).toBe(toonText);
  });
});
