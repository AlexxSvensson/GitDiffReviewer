import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getFullFileContent,
  getUntrackedFileDiff,
  getUnifiedDiff,
  listChangedFiles,
  listUntrackedFiles,
} from "../../src/git/diff.js";

const execFileAsync = promisify(execFile);

async function git(repoRoot: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: repoRoot });
}

async function initRepo(): Promise<string> {
  const repoRoot = await mkdtemp(join(tmpdir(), "diff-review-test-"));
  await git(repoRoot, ["init", "-q"]);
  await git(repoRoot, ["config", "user.email", "test@example.com"]);
  await git(repoRoot, ["config", "user.name", "Test"]);
  return repoRoot;
}

async function commitAll(repoRoot: string, message: string): Promise<void> {
  await git(repoRoot, ["add", "-A"]);
  await git(repoRoot, ["commit", "-q", "--allow-empty", "-m", message]);
}

describe("git diff layer", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await initRepo();
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("detects a modified file", async () => {
    await writeFile(join(repoRoot, "a.txt"), "line1\nline2\n");
    await commitAll(repoRoot, "init");
    await writeFile(join(repoRoot, "a.txt"), "line1\nchanged\n");

    const files = await listChangedFiles(repoRoot, { base: "HEAD" });
    expect(files).toEqual([{ status: "modified", path: "a.txt", binary: false }]);

    const diff = await getUnifiedDiff(repoRoot, { base: "HEAD" });
    expect(diff).toContain("-line2");
    expect(diff).toContain("+changed");
  });

  it("detects a staged added file", async () => {
    await commitAll(repoRoot, "init empty");
    await writeFile(join(repoRoot, "b.txt"), "new content\n");
    await git(repoRoot, ["add", "b.txt"]);

    const files = await listChangedFiles(repoRoot, { base: "HEAD", staged: true });
    expect(files).toEqual([{ status: "added", path: "b.txt", binary: false }]);
  });

  it("detects a deleted file", async () => {
    await writeFile(join(repoRoot, "c.txt"), "bye\n");
    await commitAll(repoRoot, "init");
    await rm(join(repoRoot, "c.txt"));

    const files = await listChangedFiles(repoRoot, { base: "HEAD" });
    expect(files).toEqual([{ status: "deleted", path: "c.txt", binary: false }]);
  });

  it("detects a renamed file", async () => {
    await writeFile(join(repoRoot, "old.txt"), "same content for rename detection\n".repeat(5));
    await commitAll(repoRoot, "init");
    await execFileAsync("git", ["mv", "old.txt", "renamed.txt"], { cwd: repoRoot });

    const files = await listChangedFiles(repoRoot, { base: "HEAD", staged: true });
    expect(files).toEqual([
      { status: "renamed", oldPath: "old.txt", path: "renamed.txt", binary: false },
    ]);
  });

  it("detects a binary file", async () => {
    await writeFile(join(repoRoot, "img.bin"), Buffer.from([0, 1, 2, 0, 255, 254]));
    await commitAll(repoRoot, "init");
    await writeFile(join(repoRoot, "img.bin"), Buffer.from([9, 9, 9, 0, 1, 2]));

    const files = await listChangedFiles(repoRoot, { base: "HEAD" });
    expect(files).toEqual([{ status: "modified", path: "img.bin", binary: true }]);
  });

  it("reads full file content on both sides", async () => {
    await writeFile(join(repoRoot, "d.txt"), "old\n");
    await commitAll(repoRoot, "init");
    await writeFile(join(repoRoot, "d.txt"), "new\n");

    expect(await getFullFileContent(repoRoot, "d.txt", "old", "HEAD")).toBe("old\n");
    expect(await getFullFileContent(repoRoot, "d.txt", "new", "HEAD")).toBe("new\n");
  });

  it("returns null for full file content that doesn't exist on that side", async () => {
    await commitAll(repoRoot, "init empty");
    await writeFile(join(repoRoot, "e.txt"), "brand new\n");

    expect(await getFullFileContent(repoRoot, "e.txt", "old", "HEAD")).toBeNull();

    await mkdir(join(repoRoot, "sub"), { recursive: true });
    await writeFile(join(repoRoot, "sub/f.txt"), "will be deleted\n");
    await commitAll(repoRoot, "add f");
    await rm(join(repoRoot, "sub/f.txt"));
    expect(await getFullFileContent(repoRoot, "sub/f.txt", "new", "HEAD")).toBeNull();
  });

  it("lists untracked files and synthesizes an all-added diff for them", async () => {
    await commitAll(repoRoot, "init empty");
    await writeFile(join(repoRoot, "untracked.txt"), "hello\nworld\n");

    const untracked = await listUntrackedFiles(repoRoot);
    expect(untracked).toEqual(["untracked.txt"]);

    const diff = await getUntrackedFileDiff(repoRoot, "untracked.txt");
    expect(diff).toContain("+hello");
    expect(diff).toContain("+world");
  });
});
