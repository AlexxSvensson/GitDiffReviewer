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
