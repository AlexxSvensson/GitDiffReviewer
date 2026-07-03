import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ChangedFile, DiffOptions, FileStatus } from "./types.js";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 1024 * 1024 * 64;

async function git(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot, maxBuffer: MAX_BUFFER });
  return stdout;
}

function diffTargetArgs(opts: DiffOptions): string[] {
  return opts.staged ? ["--staged"] : [opts.base];
}

function statusCharToStatus(code: string): FileStatus {
  switch (code[0]) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return "modified";
  }
}

function parseNameStatus(output: string): ChangedFile[] {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split("\t");
      const status = statusCharToStatus(parts[0]);
      if (status === "renamed" || status === "copied") {
        return { status, oldPath: parts[1], path: parts[2], binary: false };
      }
      return { status, path: parts[1], binary: false };
    });
}

/** Handles both "old.png => new.png" and "dir/{old => new}/file.png" numstat path specs. */
function extractPaths(pathSpec: string): string[] {
  const braceMatch = pathSpec.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (braceMatch) {
    const [, prefix, oldPart, newPart, suffix] = braceMatch;
    return [`${prefix}${oldPart}${suffix}`, `${prefix}${newPart}${suffix}`];
  }
  const arrowMatch = pathSpec.match(/^(.*) => (.*)$/);
  if (arrowMatch) {
    return [arrowMatch[1], arrowMatch[2]];
  }
  return [pathSpec];
}

function parseBinaryPaths(output: string): Set<string> {
  const binary = new Set<string>();
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [added, deleted] = parts;
    if (added === "-" && deleted === "-") {
      for (const path of extractPaths(parts.slice(2).join("\t"))) {
        binary.add(path);
      }
    }
  }
  return binary;
}

export async function listChangedFiles(repoRoot: string, opts: DiffOptions): Promise<ChangedFile[]> {
  const targetArgs = diffTargetArgs(opts);
  const [nameStatusOut, numstatOut] = await Promise.all([
    git(repoRoot, ["diff", "--name-status", "-M", ...targetArgs]),
    git(repoRoot, ["diff", "--numstat", "-M", ...targetArgs]),
  ]);
  const files = parseNameStatus(nameStatusOut);
  const binaryPaths = parseBinaryPaths(numstatOut);
  for (const file of files) {
    file.binary = binaryPaths.has(file.path) || (file.oldPath !== undefined && binaryPaths.has(file.oldPath));
  }
  return files;
}

export async function getUnifiedDiff(repoRoot: string, opts: DiffOptions): Promise<string> {
  const context = opts.contextLines ?? 3;
  const targetArgs = diffTargetArgs(opts);
  return git(repoRoot, ["diff", "-M", `-U${context}`, ...targetArgs]);
}

/**
 * Full file content on one side of the diff.
 * `base` is the ref content is read from for the "old" side ("HEAD" when staged,
 * otherwise the same base the diff was taken against).
 */
export async function getFullFileContent(
  repoRoot: string,
  path: string,
  side: "old" | "new",
  base: string,
): Promise<string | null> {
  if (side === "new") {
    try {
      return await readFile(join(repoRoot, path), "utf8");
    } catch {
      return null;
    }
  }
  try {
    return await git(repoRoot, ["show", `${base}:${path}`]);
  } catch {
    return null;
  }
}

export async function isBinary(repoRoot: string, path: string, opts: DiffOptions): Promise<boolean> {
  const targetArgs = diffTargetArgs(opts);
  const numstatOut = await git(repoRoot, ["diff", "--numstat", "-M", ...targetArgs, "--", path]);
  return parseBinaryPaths(numstatOut).has(path);
}

export async function listUntrackedFiles(repoRoot: string): Promise<string[]> {
  const output = await git(repoRoot, ["ls-files", "--others", "--exclude-standard"]);
  return output.split("\n").filter((line) => line.trim().length > 0);
}

/** Synthesizes an all-lines-added unified diff for a file git doesn't track yet. */
export async function getUntrackedFileDiff(repoRoot: string, path: string, contextLines = 3): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--no-index", `-U${contextLines}`, "/dev/null", path],
      { cwd: repoRoot, maxBuffer: MAX_BUFFER },
    );
    return stdout;
  } catch (error) {
    const execError = error as { code?: number; stdout?: string };
    if (execError.code === 1 && typeof execError.stdout === "string") {
      return execError.stdout;
    }
    throw error;
  }
}
