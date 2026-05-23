import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopWindowOptions } from "./desktop-window-options.utils";

const originalPlatform = process.platform;

function setProcessPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform
  });
}

test.afterEach(() => {
  setProcessPlatform(originalPlatform);
});

test("creates a compact, draggable Windows chrome contract", () => {
  setProcessPlatform("win32");

  try {
    const options = createDesktopWindowOptions("preload.js");

    assert.equal(options.minWidth, 420);
    assert.equal(options.minHeight, 320);
    assert.equal(options.frame, false);
    assert.equal(options.thickFrame, undefined);
    assert.equal(options.titleBarStyle, "hidden");
    assert.equal(options.titleBarOverlay, undefined);
  } finally {
    setProcessPlatform(originalPlatform);
  }
});

test("keeps macOS on its existing hidden inset title bar", () => {
  setProcessPlatform("darwin");

  try {
    const options = createDesktopWindowOptions("preload.js");

    assert.equal(options.minWidth, 420);
    assert.equal(options.minHeight, 320);
    assert.equal(options.frame, undefined);
    assert.equal(options.titleBarStyle, "hiddenInset");
    assert.equal(options.titleBarOverlay, undefined);
  } finally {
    setProcessPlatform(originalPlatform);
  }
});
