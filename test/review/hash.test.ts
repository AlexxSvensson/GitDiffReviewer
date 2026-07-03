import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeReviewId } from "../../src/review/hash.js";

const execFileAsync = promisify(execFile);

describe("computeReviewId", () => {
  let repoA: string;
  let repoB: string;

  beforeEach(async () => {
    repoA = await mkdtemp(join(tmpdir(), "diff-review-hash-a-"));
    repoB = await mkdtemp(join(tmpdir(), "diff-review-hash-b-"));
    await execFileAsync("git", ["init", "-q"], { cwd: repoA });
    await execFileAsync("git", ["init", "-q"], { cwd: repoB });
  });

  afterEach(async () => {
    await rm(repoA, { recursive: true, force: true });
    await rm(repoB, { recursive: true, force: true });
  });

  it("is deterministic for the same repo + base ref", () => {
    expect(computeReviewId(repoA, "HEAD")).toBe(computeReviewId(repoA, "HEAD"));
  });

  it("differs for different repos", () => {
    expect(computeReviewId(repoA, "HEAD")).not.toBe(computeReviewId(repoB, "HEAD"));
  });

  it("differs for different base refs on the same repo", () => {
    expect(computeReviewId(repoA, "HEAD")).not.toBe(computeReviewId(repoA, "main"));
  });

  it("produces a 16-character hex id", () => {
    const id = computeReviewId(repoA, "HEAD");
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});
