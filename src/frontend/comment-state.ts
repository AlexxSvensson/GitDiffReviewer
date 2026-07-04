import type { Comment } from "../toon/comments.js";

export type Verdict = "good" | "bad" | null;
export type VerdictMap = Record<string, Exclude<Verdict, null>>;

const VERDICT_BODY: Record<Exclude<Verdict, null>, string> = {
  good: "Looks good",
  bad: "Looks bad",
};

export function materializeVerdicts(verdicts: VerdictMap): Comment[] {
  return Object.entries(verdicts).map(([file, verdict]) => ({
    scope: "file",
    file,
    line: "",
    body: VERDICT_BODY[verdict],
  }));
}

/** All typed comments plus one materialized file-scope comment per active verdict. */
export function combineComments(typed: Comment[], verdicts: VerdictMap): Comment[] {
  return [...typed, ...materializeVerdicts(verdicts)];
}

/** A single entry for a "review your comments so far" list, tagged with how to remove it. */
export type CommentEntry =
  | { kind: "typed"; index: number; comment: Comment }
  | { kind: "verdict"; file: string; comment: Comment };

export function buildCommentEntries(typed: Comment[], verdicts: VerdictMap): CommentEntry[] {
  const typedEntries: CommentEntry[] = typed.map((comment, index) => ({ kind: "typed", index, comment }));
  const verdictEntries: CommentEntry[] = materializeVerdicts(verdicts).map((comment) => ({
    kind: "verdict",
    file: comment.file,
    comment,
  }));
  return [...typedEntries, ...verdictEntries];
}
