export type FileStatus = "modified" | "added" | "deleted" | "renamed" | "copied";

export interface ChangedFile {
  status: FileStatus;
  /** New-side path (or only path for deleted files). */
  path: string;
  /** Set when status is "renamed" or "copied". */
  oldPath?: string;
  binary: boolean;
}

export interface DiffOptions {
  /** Ref the diff is taken against, e.g. "HEAD" or a user-supplied --base <ref>. */
  base: string;
  /** When true, diff staged changes against HEAD instead of working tree vs base. */
  staged?: boolean;
  /** Number of unchanged context lines around each hunk (git diff -U<n>). */
  contextLines?: number;
}
