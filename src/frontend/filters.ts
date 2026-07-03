export type VerdictFilter = "all" | "good" | "bad" | "none";

/** Pure DOM show/hide by path substring and/or verdict — no backend involvement (README §4). */
export function applyFilters(fileListEl: HTMLElement, query: string, verdictFilter: VerdictFilter): void {
  const needle = query.trim().toLowerCase();
  fileListEl.querySelectorAll<HTMLElement>(".review-file").forEach((section) => {
    const path = section.dataset.file?.toLowerCase() ?? "";
    const matchesPath = needle.length === 0 || path.includes(needle);

    const verdict = section.dataset.verdict || "none";
    const matchesVerdict = verdictFilter === "all" || verdictFilter === verdict;

    section.hidden = !(matchesPath && matchesVerdict);
  });
}
