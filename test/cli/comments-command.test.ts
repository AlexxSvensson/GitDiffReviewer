import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commentsCommand } from "../../src/cli/comments-command.js";
import { computeReviewId } from "../../src/review/hash.js";
import { writeCommentsRaw } from "../../src/review/store.js";

const execFileAsync = promisify(execFile);

describe("comments command", () => {
  let repoRoot: string;
  let home: string;
  const originalHome = process.env.DIFF_REVIEW_HOME;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "diff-review-comments-repo-"));
    await execFileAsync("git", ["init", "-q"], { cwd: repoRoot });
    home = await mkdtemp(join(tmpdir(), "diff-review-comments-home-"));
    process.env.DIFF_REVIEW_HOME = home;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.DIFF_REVIEW_HOME;
    } else {
      process.env.DIFF_REVIEW_HOME = originalHome;
    }
    await rm(repoRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  it("throws a NOT_FOUND AxiError when no review was saved", async () => {
    await expect(commentsCommand([repoRoot], { cwd: process.cwd() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns the saved comments.toon content unchanged", async () => {
    const reviewId = computeReviewId(repoRoot, "HEAD");
    const toonText = 'comments[1]{scope,file,line,body}:\n  global,,,"Looks good"\n';
    await writeCommentsRaw(reviewId, toonText);

    const result = await commentsCommand([repoRoot], { cwd: process.cwd() });
    expect(result).toBe(toonText);
  });

  it("resolves the same review id regardless of --base HEAD being implicit", async () => {
    const reviewId = computeReviewId(repoRoot, "HEAD");
    const toonText = "comments[0]{scope,file,line,body}:\n";
    await writeCommentsRaw(reviewId, toonText);

    const result = await commentsCommand([repoRoot, "--base", "HEAD"], { cwd: process.cwd() });
    expect(result).toBe(toonText);
  });
});
