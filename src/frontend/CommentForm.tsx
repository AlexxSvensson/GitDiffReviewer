import { useEffect, useRef, useState } from "preact/hooks";
import type { Comment } from "../toon/comments.js";
import type { CommentEntry } from "./comment-state.js";
import { type CommentTarget, placeholderFor } from "./types.js";

export interface CommentFormProps {
  target: CommentTarget;
  anchorRect: DOMRect;
  /** Already-existing comments for this exact target, shown above the add-new input. */
  existingEntries: CommentEntry[];
  onSubmit: (comment: Comment) => void;
  onRemoveTyped: (index: number) => void;
  onRemoveVerdict: (file: string) => void;
  onCancel: () => void;
}

function entryKey(entry: CommentEntry): string {
  return entry.kind === "typed" ? `typed-${entry.index}` : `verdict-${entry.file}`;
}

/** Fixed-position popover anchored near whatever was clicked to open it. */
export function CommentForm({
  target,
  anchorRect,
  existingEntries,
  onSubmit,
  onRemoveTyped,
  onRemoveVerdict,
  onCancel,
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit(): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit({ scope: target.scope, file: target.file, line: target.line, body: trimmed });
  }

  return (
    <div
      class="comment-form"
      style={{ left: `${Math.max(8, anchorRect.left)}px`, top: `${anchorRect.bottom + window.scrollY + 4}px` }}
    >
      {existingEntries.length > 0 && (
        <div class="comment-form-existing">
          {existingEntries.map((entry) => (
            <div class="comment-form-existing-item" key={entryKey(entry)}>
              <p>{entry.comment.body}</p>
              <button
                type="button"
                aria-label="Remove this comment"
                onClick={() => (entry.kind === "typed" ? onRemoveTyped(entry.index) : onRemoveVerdict(entry.file))}
              >
                ×
              </button>
            </div>
          ))}
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
          Add comment
        </button>
        <button type="button" class="comment-form-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
