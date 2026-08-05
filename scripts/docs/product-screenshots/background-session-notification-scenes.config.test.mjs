import assert from "node:assert/strict";
import test from "node:test";
import { createBackgroundSessionNotificationScreenshotScenes } from "./background-session-notification-scenes.config.mjs";

test("defines localized background-session notification scenes", () => {
  const scenes = createBackgroundSessionNotificationScreenshotScenes();

  assert.deepEqual(scenes.map(({ id }) => id), [
    "background-session-notification-en",
    "background-session-notification-zh",
  ]);
  assert.equal(new Set(scenes.flatMap(({ outputs }) => outputs)).size, 4);
  assert.deepEqual(scenes.map(({ language }) => language), ["en", "zh"]);
});
