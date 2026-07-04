import type { Comment } from "../toon/comments.js";
import type { CommentEntry } from "./comment-state.js";

export interface CommentsPanelProps {
  entries: CommentEntry[];
  onRemoveTyped: (index: number) => void;
  onRemoveVerdict: (file: string) => void;
}

function targetLabel(comment: Comment): string {
  if (comment.scope === "change") return `${comment.file}:${comment.line}`;
  if (comment.scope === "file") return comment.file;
  return "Entire review";
}

function entryKey(entry: CommentEntry): string {
  return entry.kind === "typed" ? `typed-${entry.index}` : `verdict-${entry.file}`;
}

/** Lists every comment collected so far (typed + verdicts), each removable before saving. */
export function CommentsPanel({ entries, onRemoveTyped, onRemoveVerdict }: CommentsPanelProps) {
  if (entries.length === 0) {
    return (
      <div class="comments-panel">
        <p class="comments-panel-empty">No comments yet — click a diff line, a file, or the review to add one.</p>
      </div>
    );
  }

  return (
    <div class="comments-panel">
      {entries.map((entry) => (
        <div class="comments-panel-item" key={entryKey(entry)}>
          <div class="comments-panel-item-meta">
            <span class={`comments-panel-item-scope comments-panel-item-scope-${entry.comment.scope}`}>
              {entry.comment.scope}
            </span>
            <span class="comments-panel-item-target">{targetLabel(entry.comment)}</span>
          </div>
          <p class="comments-panel-item-body">{entry.comment.body}</p>
          <button
            type="button"
            class="comments-panel-item-remove"
            aria-label={`Remove comment on ${targetLabel(entry.comment)}`}
            onClick={() => (entry.kind === "typed" ? onRemoveTyped(entry.index) : onRemoveVerdict(entry.file))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
