import { render } from "preact";
import type { ReviewPayload } from "../review/types.js";
import { App } from "./App.js";

declare global {
  interface Window {
    __DIFF_REVIEW__: ReviewPayload;
  }
}

const container = document.getElementById("app");
if (container) {
  render(<App payload={window.__DIFF_REVIEW__} />, container);
}
