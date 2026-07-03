import type { ReviewPayload } from "../review/types.js";

export interface PageAssetHrefs {
  js: string;
  css: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderReviewPage(payload: ReviewPayload, assets: PageAssetHrefs): string {
  // Escape `<` so no diff/path content can prematurely close the <script> tag.
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>diff-review — ${escapeHtml(payload.repoRoot)}</title>
<link rel="stylesheet" href="${assets.css}">
</head>
<body>
<div id="app"></div>
<script>window.__DIFF_REVIEW__ = ${payloadJson};</script>
<script src="${assets.js}"></script>
</body>
</html>
`;
}
