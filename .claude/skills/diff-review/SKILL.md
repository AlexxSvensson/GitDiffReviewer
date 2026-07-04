---
name: diff-review
description: Open a browser-based review of uncommitted git changes and read back structured human feedback as TOON.
use_when: The user has made a batch of uncommitted edits and wants human sign-off, feedback, or a sanity check before continuing or committing.
---

# diff-review

Lets a human review your uncommitted git changes in a browser and leave scoped
comments — on a specific line, a whole file, or the review as a whole — which
you then read back as structured TOON.

## Setup (one-time)

Not published to npm yet, so `npx` won't work. Instead, clone and link it once:

```
git clone https://github.com/AlexxSvensson/GitDiffReviewer.git
cd GitDiffReviewer
npm install && npm run build && npm link
```

This puts a `diff-review` binary on your PATH.

## Workflow

Run `diff-review <target> --wait` (target defaults to `.`) as a backgrounded
command. It opens a browser for the human to review in, stays attached, and
prints their comments as TOON the moment they click "Review done" — you'll
be notified automatically when that background command finishes, so there's
no need to ask the human to tell you when they're done, and no need to poll.

If you can't run backgrounded commands in your environment, fall back to the
two-step form instead: run `diff-review <target>` (returns immediately,
opens a browser, does not block) and continue with other work; once the
human says they're done, run `diff-review comments <target>` to read back
their comments.

## Commands

- `diff-review <target>` — Render uncommitted diffs and open the review UI
- `diff-review comments <target>` — Read back saved comments as TOON
- `diff-review setup hooks` — Install SessionStart hooks
- `diff-review update` — Self-update
