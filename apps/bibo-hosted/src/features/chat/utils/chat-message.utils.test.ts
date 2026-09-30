import assert from "node:assert/strict";
import test from "node:test";
import { appendBiboTextBlock as appendStreamingBlock } from "@nextclaw/bibo-client";
import { messageTime } from "./chat-message.utils";

test("stream blocks preserve earlier answers across actual boundaries", () => {
  const first = appendStreamingBlock([], "先检查", "before-tool");
  const continued = appendStreamingBlock(first, "文件。", "before-tool");
  const second = appendStreamingBlock(continued, "已经保存。", "after-tool");
  assert.deepEqual(second, [{ id: "before-tool", text: "先检查文件。" }, { id: "after-tool", text: "已经保存。" }]);
  assert.equal(second[0], continued[0], "completed blocks keep their object identity");
  assert.equal(appendStreamingBlock(second, "", "empty"), second);
  assert.deepEqual(appendStreamingBlock(appendStreamingBlock([], "旧"), "协议"), [{ id: "answer", text: "旧协议" }]);
});

test("time labels separate long gaps and calendar days in local time", () => {
  const now = new Date(2026, 8, 30, 16, 0);
  const at = (day: number, hour: number, minute: number) => new Date(2026, 8, day, hour, minute).toISOString();
  assert.equal(messageTime(at(30, 12, 0), undefined, now), "今天 12:00");
  assert.equal(messageTime(at(30, 12, 4), at(30, 12, 0), now), null);
  assert.equal(messageTime(at(30, 12, 5), at(30, 12, 0), now), "今天 12:05");
  assert.equal(messageTime(at(30, 0, 0), at(29, 23, 59), now), "今天 00:00");
  assert.equal(messageTime(at(29, 12, 0), undefined, now), "昨天 12:00");
  assert.match(messageTime(at(28, 12, 0), undefined, now)!, /9月28日/);
  assert.match(messageTime(new Date(2025, 8, 30, 12).toISOString(), undefined, now)!, /2025/);
  assert.equal(messageTime("", undefined, now), null);
  assert.equal(messageTime("invalid", undefined, now), null);
});
