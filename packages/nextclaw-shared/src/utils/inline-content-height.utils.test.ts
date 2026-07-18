import { expect, it } from "vitest";
import { readInlineContentHeight } from "./inline-content-height.utils.js";

it("reads natural content height without retaining a larger viewport", () => {
  const body = { clientHeight: 320, offsetHeight: 320, scrollHeight: 320 };
  const documentElement = {
    clientHeight: 900,
    offsetHeight: 320,
    scrollHeight: 900,
  };

  expect(readInlineContentHeight(body, documentElement)).toBe(320);
});

it("includes overflowing body content", () => {
  const body = { clientHeight: 320, offsetHeight: 320, scrollHeight: 860 };
  const documentElement = {
    clientHeight: 600,
    offsetHeight: 860,
    scrollHeight: 860,
  };

  expect(readInlineContentHeight(body, documentElement)).toBe(860);
});
