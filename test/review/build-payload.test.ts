import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildReviewPayload } from "../../src/review/build-payload.js";

const execFileAsync = promisify(execFile);

async function git(repoRoot: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: repoRoot });
}

async function commitAll(repoRoot: string, message: string): Promise<void> {
  await git(repoRoot, ["add", "-A"]);
  await git(repoRoot, ["commit", "-q", "--allow-empty", "-m", message]);
}

describe("buildReviewPayload", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "diff-review-payload-"));
    await git(repoRoot, ["init", "-q"]);
    await git(repoRoot, ["config", "user.email", "test@example.com"]);
    await git(repoRoot, ["config", "user.name", "Test"]);
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("assembles hunk + expanded diffs for changed and untracked files", async () => {
    const twentyLines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
    await writeFile(join(repoRoot, "spread.txt"), twentyLines);
    await commitAll(repoRoot, "init");

    const edited = twentyLines
      .split("\n")
      .map((line, i) => (i === 0 ? "line 1 CHANGED" : i === 19 ? "line 20 CHANGED" : line))
      .join("\n");
    await writeFile(join(repoRoot, "spread.txt"), edited);
    await writeFile(join(repoRoot, "untracked.txt"), "brand new\n");

    const payload = await buildReviewPayload(repoRoot, "test-review-id", "HEAD", { base: "HEAD" });

    expect(payload.repoRoot).toBe(repoRoot);
    expect(payload.reviewId).toBe("test-review-id");
    expect(payload.files).toHaveLength(2);

    const spread = payload.files.find((f) => f.path === "spread.txt");
    expect(spread).toBeDefined();
    expect(spread?.status).toBe("modified");
    // Two far-apart edits produce two separate hunks at -U3...
    expect(spread?.hunkDiff.match(/^@@/gm)?.length).toBe(2);
    // ...but collapse into a single hunk once context covers the whole file.
    expect(spread?.expandedDiff.match(/^@@/gm)?.length).toBe(1);
    expect(spread?.expandedDiff).toContain("line 1 CHANGED");
    expect(spread?.expandedDiff).toContain("line 20 CHANGED");

    const untracked = payload.files.find((f) => f.path === "untracked.txt");
    expect(untracked).toBeDefined();
    expect(untracked?.status).toBe("untracked");
    expect(untracked?.hunkDiff).toContain("+brand new");
  });

  it("reports untracked binary files as binary in the assembled payload", async () => {
    await commitAll(repoRoot, "init empty");
    await writeFile(join(repoRoot, "new-image.bin"), Buffer.from([0, 1, 2, 0, 255, 254]));
    await writeFile(join(repoRoot, "new-text.txt"), "hello\n");

    const payload = await buildReviewPayload(repoRoot, "id", "HEAD", { base: "HEAD" });
    expect(payload.files.find((f) => f.path === "new-image.bin")?.binary).toBe(true);
    expect(payload.files.find((f) => f.path === "new-text.txt")?.binary).toBe(false);
  });

  it("keeps rename pairing intact in the assembled payload", async () => {
    await writeFile(join(repoRoot, "old.txt"), "same content\n".repeat(5));
    await commitAll(repoRoot, "init");
    await execFileAsync("git", ["mv", "old.txt", "renamed.txt"], { cwd: repoRoot });
    await git(repoRoot, ["add", "-A"]);

    const payload = await buildReviewPayload(repoRoot, "id", "HEAD", { base: "HEAD", staged: true });
    const renamed = payload.files.find((f) => f.path === "renamed.txt");
    expect(renamed?.status).toBe("renamed");
    expect(renamed?.oldPath).toBe("old.txt");
    expect(renamed?.hunkDiff).toContain("rename from old.txt");
  });
});
