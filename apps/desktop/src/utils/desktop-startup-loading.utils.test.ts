import assert from "node:assert/strict";
import test from "node:test";
import { createStartupLoadingUrl } from "./desktop-startup-loading.utils";

function decodeStartupLoadingHtml(): string {
  const url = createStartupLoadingUrl();
  const prefix = "data:text/html;charset=utf-8,";

  assert.equal(url.startsWith(prefix), true);
  return decodeURIComponent(url.slice(prefix.length));
}

test("marks the startup loading page as a draggable Electron region", () => {
  const html = decodeStartupLoadingHtml();

  assert.match(html, /-webkit-app-region:\s*drag/);
  assert.match(html, /app-region:\s*drag/);
  assert.match(html, /user-select:\s*none/);
});
