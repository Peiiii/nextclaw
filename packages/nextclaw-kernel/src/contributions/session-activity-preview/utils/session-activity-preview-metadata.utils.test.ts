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
          statusText: "Tool call completed",
          replyText: "Final reply",
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
        statusText: "Tool call completed",
        replyText: "Final reply",
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
            replyText: "Final reply",
          timestamp: "2026-05-16T01:00:00.000Z",
        },
      }),
    ).toEqual({
      [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
        state: "completed",
          replyText: "Final reply",
        timestamp: "2026-05-16T01:01:00.000Z",
      },
    });
  });

  it("clears stale reply text when a new run starts", () => {
    expect(
      writeSessionActivityPreviewMetadata({
        [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
          state: "completed",
          timestamp: "2026-05-16T01:01:00.000Z",
          replyText: "Previous reply",
        },
      }, {
        sessionId: "session-1",
        preview: {
          state: "running",
          statusText: "Thinking",
          timestamp: "2026-05-16T01:02:00.000Z",
        },
      }),
    ).toEqual({
      [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
        state: "running",
        statusText: "Thinking",
        timestamp: "2026-05-16T01:02:00.000Z",
      },
    });
  });

  it("accepts cancelled previews without treating them as invalid metadata", () => {
    expect(
      writeSessionActivityPreviewMetadata(undefined, {
        sessionId: "session-1",
        preview: {
          state: "cancelled",
          timestamp: "2026-05-16T01:02:00.000Z",
        },
      }),
    ).toEqual({
      [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
        state: "cancelled",
        timestamp: "2026-05-16T01:02:00.000Z",
      },
    });
  });

  it("ignores older activity previews", () => {
    expect(
      writeSessionActivityPreviewMetadata({
        [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: {
          state: "completed",
          replyText: "New reply",
          timestamp: "2026-05-16T01:01:00.000Z",
        },
      }, {
        sessionId: "session-1",
        preview: {
          state: "running",
          statusText: "Old tool status",
          timestamp: "2026-05-16T01:00:00.000Z",
        },
      }),
    ).toBeNull();
  });
});
