import type { ChangedFile, FileStatus } from "../git/types.js";

export interface FilePayload extends Omit<ChangedFile, "status"> {
  status: FileStatus | "untracked";
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
