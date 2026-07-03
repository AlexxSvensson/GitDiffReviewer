import type { Verdict } from "./comment-state.js";

export interface VerdictButtonsProps {
  verdict: Verdict;
  onChange: (verdict: Verdict) => void;
}

/** Toggleable pair: clicking the active button clears it, clicking the other switches. */
export function VerdictButtons({ verdict, onChange }: VerdictButtonsProps) {
  function toggle(value: Exclude<Verdict, null>): void {
    onChange(verdict === value ? null : value);
  }

  return (
    <div class="verdict-buttons">
      <button
        type="button"
        class={`verdict-button verdict-good${verdict === "good" ? " active" : ""}`}
        onClick={() => toggle("good")}
      >
        👍 Looks good
      </button>
      <button
        type="button"
        class={`verdict-button verdict-bad${verdict === "bad" ? " active" : ""}`}
        onClick={() => toggle("bad")}
      >
        👎 Looks bad
      </button>
    </div>
  );
}
