import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

/**
 * Deterministic review id derived from (repo path, base ref) rather than diff
 * content, so `<target>` and `comments <target>` independently recompute the
 * same id even if the working tree changed in between.
 */
export function computeReviewId(repoRoot: string, baseRef: string): string {
  const resolved = realpathSync(repoRoot);
  return createHash("sha256").update(`${resolved}\0${baseRef}`).digest("hex").slice(0, 16);
}
