import { useEffect, useRef, useState } from "preact/hooks";
import type { Comment } from "../toon/comments.js";
import type { CommentEntry } from "./comment-state.js";
import { type CommentTarget, placeholderFor } from "./types.js";

export interface CommentFormProps {
  target: CommentTarget;
  anchorRect: DOMRect;
  /** Already-existing comments for this exact target — at most one typed comment, plus a verdict for file targets. */
  existingEntries: CommentEntry[];
  onSubmit: (comment: Comment) => void;
  onReplaceTyped: (index: number, comment: Comment) => void;
  onRemoveTyped: (index: number) => void;
  onRemoveVerdict: (file: string) => void;
  onCancel: () => void;
}

/** Fixed-position popover anchored near whatever was clicked to open it. One comment per target: editable in place, not appended alongside. */
export function CommentForm({
  target,
  anchorRect,
  existingEntries,
  onSubmit,
  onReplaceTyped,
  onRemoveTyped,
  onRemoveVerdict,
  onCancel,
}: CommentFormProps) {
  const typedEntry = existingEntries.find((entry) => entry.kind === "typed");
  const verdictEntry = existingEntries.find((entry) => entry.kind === "verdict");

  const [body, setBody] = useState(typedEntry?.comment.body ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit(): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    const comment: Comment = { scope: target.scope, file: target.file, line: target.line, body: trimmed };
    if (typedEntry?.kind === "typed") {
      onReplaceTyped(typedEntry.index, comment);
    } else {
      onSubmit(comment);
    }
    onCancel();
  }

  function deleteComment(): void {
    if (typedEntry?.kind === "typed") onRemoveTyped(typedEntry.index);
    onCancel();
  }

  return (
    <div
      class="comment-form"
      style={{ left: `${Math.max(8, anchorRect.left)}px`, top: `${anchorRect.bottom + window.scrollY + 4}px` }}
    >
      {verdictEntry?.kind === "verdict" && (
        <div class="comment-form-existing">
          <p class="comment-form-existing-label">Verdict</p>
          <div class="comment-form-existing-item">
            <p class="comment-form-existing-body">{verdictEntry.comment.body}</p>
            <button
              type="button"
              class="comment-form-existing-remove"
              onClick={() => onRemoveVerdict(verdictEntry.file)}
            >
              Remove
            </button>
          </div>
        </div>
      )}
      <textarea
        ref={textareaRef}
        class="comment-form-input"
        rows={3}
        placeholder={placeholderFor(target)}
        value={body}
        onInput={(event) => setBody((event.target as HTMLTextAreaElement).value)}
      />
      <div class="comment-form-actions">
        <button type="button" onClick={submit}>
          {typedEntry ? "Update comment" : "Add comment"}
        </button>
        {typedEntry && (
          <button type="button" class="comment-form-delete" onClick={deleteComment}>
            Delete
          </button>
        )}
        <button type="button" class="comment-form-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
