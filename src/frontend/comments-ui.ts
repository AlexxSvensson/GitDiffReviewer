import type { Comment, CommentScope } from "../toon/comments.js";

export interface CommentsState {
  add(comment: Comment): void;
  getAll(): Comment[];
}

export function createCommentsState(onChange: (comments: Comment[]) => void): CommentsState {
  const comments: Comment[] = [];
  return {
    add(comment) {
      comments.push(comment);
      onChange([...comments]);
    },
    getAll() {
      return [...comments];
    },
  };
}

interface CommentTarget {
  scope: CommentScope;
  file: string;
  line: string;
}

function placeholderFor(target: CommentTarget): string {
  if (target.scope === "change") return `Comment on ${target.file}:${target.line}…`;
  if (target.scope === "file") return `Comment on ${target.file}…`;
  return "Comment on the entire review…";
}

/** Floating form anchored near `anchorEl`, appended to <body> so it never has to nest inside a diff table. */
function openCommentForm(anchorEl: HTMLElement, target: CommentTarget, state: CommentsState): void {
  const existing = document.querySelector(".comment-form");
  existing?.remove();

  const form = document.createElement("div");
  form.className = "comment-form";

  const textarea = document.createElement("textarea");
  textarea.className = "comment-form-input";
  textarea.placeholder = placeholderFor(target);
  textarea.rows = 3;

  const actions = document.createElement("div");
  actions.className = "comment-form-actions";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.textContent = "Add comment";
  submitButton.addEventListener("click", () => {
    const body = textarea.value.trim();
    if (!body) return;
    state.add({ scope: target.scope, file: target.file, line: target.line, body });
    form.remove();
  });

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.className = "comment-form-cancel";
  cancelButton.addEventListener("click", () => form.remove());

  actions.append(submitButton, cancelButton);
  form.append(textarea, actions);

  const rect = anchorEl.getBoundingClientRect();
  form.style.position = "fixed";
  form.style.left = `${Math.max(8, rect.left)}px`;
  form.style.top = `${rect.bottom + window.scrollY + 4}px`;

  document.body.append(form);
  textarea.focus();
}

/** Wires click-to-comment on every annotated diff row within `containerEl` (scope: "change"). */
export function attachRowCommentHandler(containerEl: HTMLElement, state: CommentsState): void {
  containerEl.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("tr[data-file][data-line]");
    if (!row?.dataset.file || !row.dataset.line) return;
    openCommentForm(row, { scope: "change", file: row.dataset.file, line: row.dataset.line }, state);
  });
}

export function createFileCommentButton(file: string, state: CommentsState): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Comment on file";
  button.addEventListener("click", () => openCommentForm(button, { scope: "file", file, line: "" }, state));
  return button;
}

export function createGlobalCommentButton(state: CommentsState): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Comment on entire review";
  button.addEventListener("click", () => openCommentForm(button, { scope: "global", file: "", line: "" }, state));
  return button;
}
