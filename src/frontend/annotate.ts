/**
 * Tags each rendered diff2html row with data-file/data-line/data-side so a
 * click on a row can be translated into a `file:line` comment target.
 *
 * diff2html's side-by-side output gives no such hooks itself: each file is
 * `.d2h-file-side-diff` (old, then new, in DOM order) containing `<tr>` rows
 * whose `.d2h-code-side-linenumber` cell holds the line number as plain text
 * — blank for hunk-header rows and alignment placeholder rows, which is what
 * we use to tell "real" line rows apart without depending on diff2html's
 * internal class names for those two row kinds.
 */
export function annotateFile(containerEl: HTMLElement, filePath: string): void {
  // diff2html always wraps rendered output in .d2h-file-wrapper, even for a
  // binary-file placeholder with no .d2h-file-side-diff children (a
  // legitimate, silent no-op case below). Its absence means diff2html's DOM
  // shape no longer matches what this module was built against.
  if (!containerEl.querySelector(".d2h-file-wrapper")) {
    console.warn(`diff-review: expected diff2html output for "${filePath}" but found none — annotation skipped`);
    return;
  }

  const sides = containerEl.querySelectorAll<HTMLElement>(".d2h-file-side-diff");
  sides.forEach((sideEl, index) => {
    const side: "old" | "new" = index === 0 ? "old" : "new";
    sideEl.querySelectorAll<HTMLTableRowElement>("tr").forEach((row) => {
      const lineText = row.querySelector(".d2h-code-side-linenumber")?.textContent?.trim();
      if (!lineText) return;
      row.dataset.file = filePath;
      row.dataset.line = lineText;
      row.dataset.side = side;
    });
  });
}
