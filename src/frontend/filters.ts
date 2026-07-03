/** Pure DOM show/hide by path substring — no backend involvement (README §4). */
export function applyPathFilter(fileListEl: HTMLElement, query: string): void {
  const needle = query.trim().toLowerCase();
  fileListEl.querySelectorAll<HTMLElement>(".review-file").forEach((section) => {
    const path = section.dataset.file?.toLowerCase() ?? "";
    section.hidden = needle.length > 0 && !path.includes(needle);
  });
}
