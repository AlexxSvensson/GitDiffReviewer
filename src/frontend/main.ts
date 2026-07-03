import type { FilePayload, ReviewPayload } from "../review/types.js";
import type { Comment } from "../toon/comments.js";
import {
  attachRowCommentHandler,
  type CommentsState,
  createCommentsState,
  createFileCommentButton,
  createGlobalCommentButton,
} from "./comments-ui.js";
import { createContextToggle } from "./context-levels.js";
import { applyPathFilter } from "./filters.js";
import { saveComments, showSavedMessage } from "./save-client.js";

declare global {
  interface Window {
    __DIFF_REVIEW__: ReviewPayload;
  }
}

function fileLabel(file: FilePayload): string {
  const prefix = file.status === "untracked" ? "[untracked] " : "";
  return file.oldPath ? `${prefix}${file.oldPath} → ${file.path}` : `${prefix}${file.path}`;
}

function buildFileSection(file: FilePayload, commentsState: CommentsState): HTMLElement {
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

  toolbar.append(label, createFileCommentButton(file.path, commentsState), toggle);

  const diffContainer = document.createElement("div");
  diffContainer.className = "review-file-diff";

  createContextToggle(diffContainer, file, toggle);
  attachRowCommentHandler(diffContainer, commentsState);

  section.append(toolbar, diffContainer);
  return section;
}

function renderApp(payload: ReviewPayload): void {
  const app = document.getElementById("app");
  if (!app) return;

  const pendingCount = document.createElement("span");
  pendingCount.className = "review-pending-count";
  const commentsState = createCommentsState((comments) => {
    pendingCount.textContent = comments.length === 1 ? "1 comment" : `${comments.length} comments`;
  });
  pendingCount.textContent = "0 comments";

  const toolbar = document.createElement("div");
  toolbar.className = "review-toolbar";

  const filterInput = document.createElement("input");
  filterInput.type = "search";
  filterInput.placeholder = "Filter by path…";
  filterInput.className = "review-path-filter";

  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.className = "review-done-button";
  doneButton.textContent = "Review done";
  doneButton.addEventListener("click", () => {
    void handleReviewDone(doneButton, commentsState.getAll());
  });

  toolbar.append(filterInput, createGlobalCommentButton(commentsState), pendingCount, doneButton);

  const fileList = document.createElement("div");
  fileList.className = "review-file-list";

  if (payload.files.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No uncommitted changes found.";
    fileList.append(empty);
  } else {
    for (const file of payload.files) {
      fileList.append(buildFileSection(file, commentsState));
    }
  }

  filterInput.addEventListener("input", () => applyPathFilter(fileList, filterInput.value));

  app.append(toolbar, fileList);
}

async function handleReviewDone(button: HTMLButtonElement, comments: Comment[]): Promise<void> {
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    await saveComments(comments);
    showSavedMessage();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Review done";
    window.alert(error instanceof Error ? error.message : "Failed to save comments.");
  }
}

renderApp(window.__DIFF_REVIEW__);
