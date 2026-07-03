import { getUnifiedDiff, getUntrackedFileDiff, listChangedFiles, listUntrackedFiles } from "../git/diff.js";
import type { DiffOptions } from "../git/types.js";
import type { FilePayload, ReviewPayload } from "./types.js";

/** Effectively "whole file as one hunk" — collapses README's context levels 2/3 into one variant. */
const EXPANDED_CONTEXT_LINES = 100_000;

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

  const changedFilePayloads = await Promise.all(
    changedFiles.map(async (file): Promise<FilePayload> => {
      // Renames need BOTH paths in scope or git loses the rename pairing (see getUnifiedDiff docs).
      const scopePaths = file.oldPath ? [file.oldPath, file.path] : [file.path];
      const [hunkDiff, expandedDiff] = await Promise.all([
        getUnifiedDiff(repoRoot, diffOpts, scopePaths),
        getUnifiedDiff(repoRoot, { ...diffOpts, contextLines: EXPANDED_CONTEXT_LINES }, scopePaths),
      ]);
      return {
        status: file.status,
        path: file.path,
        oldPath: file.oldPath,
        binary: file.binary,
        hunkDiff,
        expandedDiff,
      };
    }),
  );

  const untrackedFilePayloads = await Promise.all(
    untrackedPaths.map(async (path): Promise<FilePayload> => {
      const [hunkDiff, expandedDiff] = await Promise.all([
        getUntrackedFileDiff(repoRoot, path, 3),
        getUntrackedFileDiff(repoRoot, path, EXPANDED_CONTEXT_LINES),
      ]);
      return { status: "untracked", path, binary: false, hunkDiff, expandedDiff };
    }),
  );

  return {
    repoRoot,
    baseRef,
    reviewId,
    files: [...changedFilePayloads, ...untrackedFilePayloads],
  };
}
