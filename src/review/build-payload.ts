import {
  getUnifiedDiff,
  getUntrackedFileDiff,
  isUntrackedFileBinary,
  listChangedFiles,
  listUntrackedFiles,
} from "../git/diff.js";
import type { DiffOptions } from "../git/types.js";
import type { FilePayload, ReviewPayload } from "./types.js";

const HUNK_CONTEXT_LINES = 3;
/** Effectively "whole file as one hunk" — collapses README's context levels 2/3 into one variant. */
const EXPANDED_CONTEXT_LINES = 100_000;
/** Caps concurrent `git` subprocesses so a review touching hundreds of files can't exhaust file descriptors. */
const MAX_CONCURRENT_GIT_CALLS = 8;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (let index = nextIndex++; index < items.length; index = nextIndex++) {
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchDiffVariants(
  getDiff: (contextLines: number) => Promise<string>,
): Promise<{ hunkDiff: string; expandedDiff: string }> {
  const [hunkDiff, expandedDiff] = await Promise.all([
    getDiff(HUNK_CONTEXT_LINES),
    getDiff(EXPANDED_CONTEXT_LINES),
  ]);
  return { hunkDiff, expandedDiff };
}

export async function buildReviewPayload(
  repoRoot: string,
  reviewId: string,
  baseRef: string,
  diffOpts: DiffOptions,
): Promise<ReviewPayload> {
  const [changedFiles, untrackedPaths] = await Promise.all([
    listChangedFiles(repoRoot, diffOpts),
    listUntrackedFiles(repoRoot),
  ]);

  const changedFilePayloads = await mapWithConcurrency(
    changedFiles,
    MAX_CONCURRENT_GIT_CALLS,
    async (file): Promise<FilePayload> => {
      // Renames need BOTH paths in scope or git loses the rename pairing (see getUnifiedDiff docs).
      const scopePaths = file.oldPath ? [file.oldPath, file.path] : [file.path];
      const { hunkDiff, expandedDiff } = await fetchDiffVariants((contextLines) =>
        getUnifiedDiff(repoRoot, { ...diffOpts, contextLines }, scopePaths),
      );
      return {
        status: file.status,
        path: file.path,
        oldPath: file.oldPath,
        binary: file.binary,
        hunkDiff,
        expandedDiff,
      };
    },
  );

  const untrackedFilePayloads = await mapWithConcurrency(
    untrackedPaths,
    MAX_CONCURRENT_GIT_CALLS,
    async (path): Promise<FilePayload> => {
      const [{ hunkDiff, expandedDiff }, binary] = await Promise.all([
        fetchDiffVariants((contextLines) => getUntrackedFileDiff(repoRoot, path, contextLines)),
        isUntrackedFileBinary(repoRoot, path),
      ]);
      return { status: "untracked", path, binary, hunkDiff, expandedDiff };
    },
  );

  return {
    repoRoot,
    baseRef,
    reviewId,
    files: [...changedFilePayloads, ...untrackedFilePayloads],
  };
}
