import { useEffect, useRef, useState } from "preact/hooks";
import type { Comment } from "../toon/comments.js";
import { type CommentTarget, placeholderFor } from "./types.js";

export interface CommentFormProps {
  target: CommentTarget;
  anchorRect: DOMRect;
  onSubmit: (comment: Comment) => void;
  onCancel: () => void;
}

/** Fixed-position popover anchored near whatever was clicked to open it. */
export function CommentForm({ target, anchorRect, onSubmit, onCancel }: CommentFormProps) {
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
