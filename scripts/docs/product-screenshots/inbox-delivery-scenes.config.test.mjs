import assert from "node:assert/strict";
import test from "node:test";
import {
  createInboxDeliveryScreenshotScenes,
  resolveInboxDeliveryScreenshotMock,
} from "./inbox-delivery-scenes.config.mjs";

function readData(response) {
  return JSON.parse(response.body).data;
}

test("defines Markdown, HTML, and inbox page scenes in both languages", () => {
  const scenes = createInboxDeliveryScreenshotScenes();

  assert.deepEqual(scenes.map(({ id }) => id), [
    "inbox-delivery-en",
    "inbox-html-delivery-en",
    "inbox-page-en",
    "inbox-delivery-zh",
    "inbox-html-delivery-zh",
    "inbox-page-zh",
  ]);
  assert.equal(new Set(scenes.flatMap(({ outputs }) => outputs)).size, 12);
});

test("serves an isolated HTML report for the HTML reader scene", () => {
  const response = resolveInboxDeliveryScreenshotMock({
    method: "GET",
    pathname: "/api/inbox/deliveries",
    sceneId: "inbox-html-delivery-zh",
  });
  const data = readData(response);

  assert.equal(data.total, 1);
  assert.equal(data.deliveries[0].contentType, "html");
  assert.match(data.deliveries[0].content, /每日 AI 与科技简报/);
});

test("serves a populated, already-presented inbox for the management scene", () => {
  const response = resolveInboxDeliveryScreenshotMock({
    method: "GET",
    pathname: "/api/inbox/deliveries",
    sceneId: "inbox-page-en",
  });
  const data = readData(response);

  assert.equal(data.total, 3);
  assert.equal(data.unreadCount, 2);
  assert.equal(data.unpresentedCount, 0);
  assert.equal(data.deliveries[0].contentType, "html");
});
