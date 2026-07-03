import type { Comment, CommentScope } from "../toon/comments.js";

export type Verdict = "good" | "bad" | null;

const VERDICT_BODY: Record<Exclude<Verdict, null>, string> = {
  good: "Looks good",
  bad: "Looks bad",
};

export interface CommentsState {
  add(comment: Comment): void;
  /** All typed comments plus one materialized file-scope comment per active verdict. */
  getAll(): Comment[];
  setVerdict(file: string, verdict: Verdict): void;
  getVerdict(file: string): Verdict;
}

export function createCommentsState(onChange: (comments: Comment[]) => void): CommentsState {
  const comments: Comment[] = [];
  const verdicts = new Map<string, Exclude<Verdict, null>>();

  function materialize(): Comment[] {
    const verdictComments: Comment[] = [...verdicts.entries()].map(([file, verdict]) => ({
      scope: "file",
      file,
      line: "",
      body: VERDICT_BODY[verdict],
    }));
    return [...comments, ...verdictComments];
  }

  function notify(): void {
    onChange(materialize());
  }

  return {
    add(comment) {
      comments.push(comment);
      notify();
    },
    getAll() {
      return materialize();
    },
    setVerdict(file, verdict) {
      if (verdict === null) {
        verdicts.delete(file);
      } else {
        verdicts.set(file, verdict);
      }
      notify();
    },
    getVerdict(file) {
      return verdicts.get(file) ?? null;
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

/**
 * Toggleable per-file verdict: clicking an already-active button clears it
 * back to no verdict, clicking the other one switches. `onChange` fires with
 * the new verdict so the caller can update filterable DOM state (data-verdict).
 */
export function createVerdictButtons(
  file: string,
  state: CommentsState,
  onChange: (verdict: Verdict) => void,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "verdict-buttons";

  const goodButton = document.createElement("button");
  goodButton.type = "button";
  goodButton.className = "verdict-button verdict-good";
  goodButton.textContent = "👍 Looks good";

  const badButton = document.createElement("button");
  badButton.type = "button";
  badButton.className = "verdict-button verdict-bad";
  badButton.textContent = "👎 Looks bad";

  function refresh(): void {
    const current = state.getVerdict(file);
    goodButton.classList.toggle("active", current === "good");
    badButton.classList.toggle("active", current === "bad");
  }

  function toggle(verdict: Exclude<Verdict, null>): void {
    const next: Verdict = state.getVerdict(file) === verdict ? null : verdict;
    state.setVerdict(file, next);
    refresh();
    onChange(next);
  }

  goodButton.addEventListener("click", () => toggle("good"));
  badButton.addEventListener("click", () => toggle("bad"));

  refresh();
  wrapper.append(goodButton, badButton);
  return wrapper;
}
