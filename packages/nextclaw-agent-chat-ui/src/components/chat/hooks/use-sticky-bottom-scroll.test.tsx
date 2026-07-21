import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useStickyBottomScroll } from "./use-sticky-bottom-scroll";

function setScrollMetrics(
  element: HTMLElement,
  metrics: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  },
) {
  Object.defineProperties(element, {
    clientHeight: {
      configurable: true,
      value: metrics.clientHeight,
    },
    scrollHeight: {
      configurable: true,
      value: metrics.scrollHeight,
    },
    scrollTop: {
      configurable: true,
      value: metrics.scrollTop,
      writable: true,
    },
  });
}

function useStickyBottomScrollTestHarness(
  element: HTMLElement,
  hasContent = false,
  contentElement?: HTMLElement,
) {
  const scrollRef = useRef(element);
  const contentRef = useRef(contentElement ?? null);

  return useStickyBottomScroll({
    contentRef,
    scrollRef,
    resetKey: "session-1",
    isLoading: false,
    hasContent,
    contentVersion: "message-1",
  });
}

it("cancels the current queued sticky scroll frame on unmount", () => {
  const cancelAnimationFrameSpy = vi.fn();

  vi.stubGlobal("requestAnimationFrame", () => 42);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameSpy);

  try {
    const scrollElement = document.createElement("div");
    const view = renderHook(() => useStickyBottomScrollTestHarness(scrollElement, true));

    view.unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("does not reclaim the viewport when content resizes after the user scrolls away", () => {
  let resize: ResizeObserverCallback | null = null;
  let scheduledFrameCount = 0;
  class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
      resize = callback;
    }

    observe = vi.fn();
    disconnect = vi.fn();
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("requestAnimationFrame", () => {
    scheduledFrameCount += 1;
    return scheduledFrameCount;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  try {
    const scrollElement = document.createElement("div");
    const contentElement = document.createElement("div");
    setScrollMetrics(scrollElement, {
      clientHeight: 100,
      scrollHeight: 1000,
      scrollTop: 900,
    });
    const view = renderHook(() =>
      useStickyBottomScrollTestHarness(
        scrollElement,
        true,
        contentElement,
      ),
    );
    const framesBeforeScroll = scheduledFrameCount;

    scrollElement.scrollTop = 400;
    act(() => {
      view.result.current.onScroll();
      resize?.([], {} as ResizeObserver);
    });

    expect(view.result.current.isAtBottom).toBe(false);
    expect(scheduledFrameCount).toBe(framesBeforeScroll);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("cancels a queued sticky scroll when the user escapes the bottom threshold", () => {
  let nextFrameId = 0;
  const queuedFrames = new Map<number, FrameRequestCallback>();

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrameId += 1;
    queuedFrames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
    queuedFrames.delete(frameId);
  });

  try {
    const scrollElement = document.createElement("div");
    setScrollMetrics(scrollElement, {
      clientHeight: 100,
      scrollHeight: 1000,
      scrollTop: 900,
    });
    const view = renderHook(() =>
      useStickyBottomScrollTestHarness(scrollElement, true),
    );

    scrollElement.scrollTop = 889;
    act(() => {
      view.result.current.onScroll();
    });
    act(() => {
      for (const frame of queuedFrames.values()) {
        frame(0);
      }
    });

    expect(view.result.current.isAtBottom).toBe(false);
    expect(scrollElement.scrollTop).toBe(889);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("reports when the user scrolls away from the bottom", () => {
  const scrollElement = document.createElement("div");
  setScrollMetrics(scrollElement, {
    clientHeight: 100,
    scrollHeight: 1000,
    scrollTop: 400,
  });

  const view = renderHook(() => useStickyBottomScrollTestHarness(scrollElement));

  act(() => {
    view.result.current.onScroll();
  });

  expect(view.result.current.isAtBottom).toBe(false);
});

it("scrolls back to the bottom on demand", () => {
  let frame: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  try {
    const scrollElement = document.createElement("div");
    setScrollMetrics(scrollElement, {
      clientHeight: 100,
      scrollHeight: 1000,
      scrollTop: 400,
    });

    const view = renderHook(() => useStickyBottomScrollTestHarness(scrollElement));
    act(() => {
      view.result.current.onScroll();
    });

    expect(view.result.current.isAtBottom).toBe(false);

    act(() => {
      view.result.current.scrollToBottom();
    });
    act(() => {
      frame?.(0);
    });

    expect(view.result.current.isAtBottom).toBe(true);
    expect(scrollElement.scrollTop).toBe(1000);
  } finally {
    vi.unstubAllGlobals();
  }
});
