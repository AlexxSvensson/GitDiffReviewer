import { html as diffToHtml } from "diff2html";
import type { FilePayload } from "../review/types.js";
import { annotateFile } from "./annotate.js";

/**
 * Wires a per-file "show full file" / "show hunks only" toggle. Swaps which
 * precomputed diff string (hunkDiff vs. expandedDiff) feeds diff2html and
 * re-renders just this file's container — no network round trip.
 */
export function createContextToggle(
  container: HTMLElement,
  file: FilePayload,
  toggleButton: HTMLButtonElement,
): void {
  let expanded = false;

  function render(): void {
    const diffText = expanded ? file.expandedDiff : file.hunkDiff;
    container.innerHTML = diffToHtml(diffText, { outputFormat: "side-by-side", drawFileList: false });
    annotateFile(container, file.path);
    toggleButton.textContent = expanded ? "Show hunks only" : "Show full file";
  }

  toggleButton.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  render();
}
