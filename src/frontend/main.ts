import type { FilePayload, ReviewPayload } from "../review/types.js";
import { annotateFile } from "./annotate.js";
import { createContextToggle } from "./context-levels.js";
import { applyPathFilter } from "./filters.js";

declare global {
  interface Window {
    __DIFF_REVIEW__: ReviewPayload;
  }
}

function fileLabel(file: FilePayload): string {
  const prefix = file.status === "untracked" ? "[untracked] " : "";
  return file.oldPath ? `${prefix}${file.oldPath} → ${file.path}` : `${prefix}${file.path}`;
}

function buildFileSection(file: FilePayload): HTMLElement {
  const section = document.createElement("section");
  section.className = "review-file";
  section.dataset.file = file.path;
  section.dataset.status = file.status;

  const toolbar = document.createElement("div");
  toolbar.className = "review-file-toolbar";

  const label = document.createElement("span");
  label.className = "review-file-label";
  label.textContent = fileLabel(file);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toolbar.append(label, toggle);

  const diffContainer = document.createElement("div");
  diffContainer.className = "review-file-diff";

  createContextToggle(diffContainer, file, toggle);

  section.append(toolbar, diffContainer);
  return section;
}

function renderApp(payload: ReviewPayload): void {
  const app = document.getElementById("app");
  if (!app) return;

  const toolbar = document.createElement("div");
  toolbar.className = "review-toolbar";

  const filterInput = document.createElement("input");
  filterInput.type = "search";
  filterInput.placeholder = "Filter by path…";
  filterInput.className = "review-path-filter";
  toolbar.append(filterInput);

  const fileList = document.createElement("div");
  fileList.className = "review-file-list";

  if (payload.files.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No uncommitted changes found.";
    fileList.append(empty);
  } else {
    for (const file of payload.files) {
      fileList.append(buildFileSection(file));
    }
  }

  filterInput.addEventListener("input", () => applyPathFilter(fileList, filterInput.value));

  app.append(toolbar, fileList);
}

renderApp(window.__DIFF_REVIEW__);
