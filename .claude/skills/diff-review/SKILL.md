---
name: diff-review
description: Open a browser-based review of uncommitted git changes and read back structured human feedback as TOON.
use_when: The user has made a batch of uncommitted edits and wants human sign-off, feedback, or a sanity check before continuing or committing.
---

# diff-review

Lets a human review your uncommitted git changes in a browser and leave scoped
comments — on a specific line, a whole file, or the review as a whole — which
you then read back as structured TOON.

## Workflow

1. Run `npx -y diff-review-axi <target>` (target defaults to `.`) to open a
   review. This starts a short-lived local server and opens a browser; it does
   not block, so continue with other work while the human reviews.
2. Once the human clicks "Review done" in the browser, run
   `npx -y diff-review-axi comments <target>` to read back their comments.

## Commands

- `diff-review <target>` — Render uncommitted diffs and open the review UI
- `diff-review comments <target>` — Read back saved comments as TOON
- `diff-review setup hooks` — Install SessionStart hooks
- `diff-review update` — Self-update
