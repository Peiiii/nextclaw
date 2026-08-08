import { describe, expect, it, vi } from "vitest";
import { ChatComposerIntentManager } from "@/features/chat/managers/chat-composer-intent.manager";

describe("ChatComposerIntentManager", () => {
  it("delivers a file reference only to the targeted composer", () => {
    const manager = new ChatComposerIntentManager();
    const draftListener = vi.fn();
    const sessionListener = vi.fn();
    manager.subscribe(null, draftListener);
    manager.subscribe("session-1", sessionListener);

    manager.requestFileReference({
      targetSessionKey: null,
      tokenKey: "docs/guide.md",
      label: "guide.md",
    });

    expect(draftListener).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSessionKey: null,
        tokenKey: "docs/guide.md",
        label: "guide.md",
      }),
    );
    expect(sessionListener).not.toHaveBeenCalled();
  });

  it("keeps an intent pending until its matching composer mounts", () => {
    const manager = new ChatComposerIntentManager();
    manager.requestFileReference({
      targetSessionKey: " session-1 ",
      tokenKey: " src/index.ts ",
      label: " index.ts ",
    });

    expect(manager.consumePending(null)).toBeNull();
    expect(manager.consumePending("session-1")).toMatchObject({
      targetSessionKey: "session-1",
      tokenKey: "src/index.ts",
      label: "index.ts",
    });
    expect(manager.consumePending("session-1")).toBeNull();
  });

  it("ignores incomplete file references", () => {
    const manager = new ChatComposerIntentManager();
    const listener = vi.fn();
    manager.subscribe(null, listener);

    manager.requestFileReference({
      targetSessionKey: null,
      tokenKey: " ",
      label: "README.md",
    });

    expect(listener).not.toHaveBeenCalled();
    expect(manager.consumePending(null)).toBeNull();
  });
});
