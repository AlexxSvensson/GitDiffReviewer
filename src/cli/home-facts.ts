/**
 * Facts shown on the home view. Kept as a pure function so it can be shared
 * with scripts/generate-skill.mjs (single source of truth for CLI usage docs).
 */
export function buildHomeFacts(): Record<string, unknown> {
  return {
    commands: {
      "diff-review <target>": "Render uncommitted diffs and open the review UI",
      "diff-review comments <target>": "Read back saved comments as TOON",
      "diff-review setup hooks": "Install SessionStart hooks",
      "diff-review update": "Self-update",
    },
  };
}
