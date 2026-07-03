import type { FilePayload } from "../review/types.js";
import type { Verdict } from "./comment-state.js";

export type VerdictFilter = "all" | "good" | "bad" | "none";

/** Pure predicate — no DOM involvement (README §4: filtering is frontend-only). */
export function matchesFilters(
  file: FilePayload,
  verdict: Verdict,
  pathQuery: string,
  verdictFilter: VerdictFilter,
): boolean {
  const needle = pathQuery.trim().toLowerCase();
  const matchesPath = needle.length === 0 || file.path.toLowerCase().includes(needle);

  const verdictKey = verdict ?? "none";
  const matchesVerdict = verdictFilter === "all" || verdictFilter === verdictKey;

  return matchesPath && matchesVerdict;
}
