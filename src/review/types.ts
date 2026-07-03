import type { FileStatus } from "../git/types.js";

export interface FilePayload {
  status: FileStatus | "untracked";
  path: string;
  oldPath?: string;
  binary: boolean;
  /** Default git diff context (-U3). */
  hunkDiff: string;
  /** Very large context — renders as the full file with changes highlighted. */
  expandedDiff: string;
}

export interface ReviewPayload {
  repoRoot: string;
  baseRef: string;
  reviewId: string;
  files: FilePayload[];
}
