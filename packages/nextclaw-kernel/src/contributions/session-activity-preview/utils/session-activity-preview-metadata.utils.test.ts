import { describe, expect, it } from "vitest";
import {
  SESSION_ACTIVITY_PREVIEW_METADATA_KEY,
  writeSessionActivityPreviewMetadata,
} from "./session-activity-preview-metadata.utils.js";

describe("writeSessionActivityPreviewMetadata", () => {
  it("preserves final reply text when run.finished only updates the state", () => {
    expect(
      writeSessionActivityPreviewMetadata({
        [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
          state: "running",
          statusText: "工具调用完成",
          replyText: "最终回复",
          timestamp: "2026-05-16T01:00:00.000Z",
        },
      }, {
        sessionId: "session-1",
        preview: {
          state: "completed",
          timestamp: "2026-05-16T01:01:00.000Z",
        },
      }),
    ).toEqual({
      [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
        state: "completed",
        statusText: "工具调用完成",
        replyText: "最终回复",
        timestamp: "2026-05-16T01:01:00.000Z",
      },
    });
  });

  it("fills final reply text after a newer run.finished state-only update", () => {
    expect(
      writeSessionActivityPreviewMetadata({
        [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
          state: "completed",
          timestamp: "2026-05-16T01:01:00.000Z",
        },
      }, {
        sessionId: "session-1",
        preview: {
          state: "completed",
          replyText: "最终回复",
          timestamp: "2026-05-16T01:00:00.000Z",
        },
      }),
    ).toEqual({
      [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
        state: "completed",
        replyText: "最终回复",
        timestamp: "2026-05-16T01:01:00.000Z",
      },
    });
  });

  it("ignores older activity previews", () => {
    expect(
      writeSessionActivityPreviewMetadata({
        [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
          state: "completed",
          replyText: "新的回复",
          timestamp: "2026-05-16T01:01:00.000Z",
        },
      }, {
        sessionId: "session-1",
        preview: {
          state: "running",
          statusText: "旧的工具状态",
          timestamp: "2026-05-16T01:00:00.000Z",
        },
      }),
    ).toBeNull();
  });
});
