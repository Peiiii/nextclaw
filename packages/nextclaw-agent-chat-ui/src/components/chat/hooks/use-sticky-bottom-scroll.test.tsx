import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useStickyBottomScroll } from "./use-sticky-bottom-scroll";

function createTurnSpaceFixture() {
  const scroll = document.createElement("div");
  const content = document.createElement("div");
  const anchor = document.createElement("div");
  const spacer = document.createElement("div");
  const geometry = { height: 1200, anchor: 1200, viewport: 600 };
  scroll.scrollTop = 600;
  Object.defineProperties(scroll, {
    clientHeight: { get: () => geometry.viewport },
    scrollHeight: { get: () => Math.max(geometry.height, parseFloat(spacer.style.minHeight) || 0) },
  });
  scroll.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    const top = typeof options === "number" ? y ?? 0 : options?.top ?? 0;
    scroll.scrollTop = Math.max(0, Math.min(top, scroll.scrollHeight - scroll.clientHeight));
  });
  scroll.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
  content.getBoundingClientRect = () => ({ bottom: geometry.height - scroll.scrollTop } as DOMRect);
  spacer.getBoundingClientRect = () => ({ top: -scroll.scrollTop } as DOMRect);
  anchor.getBoundingClientRect = () => ({ top: geometry.anchor - scroll.scrollTop } as DOMRect);
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const flush = () => act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
  const refs = { contentRef: { current: content }, scrollRef: { current: scroll } };
  const view = renderHook(({ key, version, session }) => useStickyBottomScroll({
    ...refs, resetKey: session, isLoading: false, hasContent: true, contentVersion: version,
    stickyThresholdPx: 80,
    turnSpace: { key, anchorRef: { current: anchor }, frameRef: { current: spacer } },
  }), { initialProps: { key: "old", version: 0, session: "one" } });
  flush();
  return { scroll, spacer, geometry, view, flush };
}

afterEach(() => vi.unstubAllGlobals());

it("reserves one turn of reading space, consumes it during output, and keeps short completed replies stable", () => {
  const { scroll, spacer, geometry, view, flush } = createTurnSpaceFixture();
  expect(spacer.style.minHeight).toBe("0px");
  geometry.height = 1320;
  view.rerender({ key: "new", version: 1, session: "one" });
  flush();
  expect(scroll.scrollTop).toBe(1176);
  expect(spacer.style.minHeight).toBe("1776px");
  geometry.height += 200;
  view.rerender({ key: "new", version: 2, session: "one" });
  flush();
  expect(scroll.scrollTop).toBe(1176);
  expect(spacer.style.minHeight).toBe("1776px");
  view.rerender({ key: "new", version: 3, session: "one" });
  flush();
  expect(scroll.scrollTop).toBe(1176);
  geometry.height = 2000;
  view.rerender({ key: "new", version: 4, session: "one" });
  flush();
  expect(spacer.style.minHeight).toBe("1776px");
  expect(scroll.scrollTop).toBe(1400);
  view.unmount();
});

it.each([0, 70, 81, 300])("uses the pre-append reading position at a %ipx distance", (distance) => {
  const { scroll, spacer, geometry, view, flush } = createTurnSpaceFixture();
  scroll.scrollTop = 600 - distance;
  act(() => view.result.current.onScroll());
  geometry.height = 1320;
  view.rerender({ key: "new", version: 1, session: "one" });
  flush();
  expect(scroll.scrollTop).toBe(distance <= 80 ? 1176 : 600 - distance);
  expect(spacer.style.minHeight).toBe(distance <= 80 ? "1776px" : "0px");
  view.unmount();
});

it("cancels turn following on manual scroll and resets spacing across sessions", () => {
  const { scroll, spacer, geometry, view, flush } = createTurnSpaceFixture();
  geometry.height = 1320;
  view.rerender({ key: "new", version: 1, session: "one" });
  scroll.scrollTop = 300;
  act(() => view.result.current.onScroll());
  flush();
  geometry.height += 200;
  view.rerender({ key: "new", version: 2, session: "one" });
  flush();
  expect(scroll.scrollTop).toBe(300);
  view.rerender({ key: "other", version: 3, session: "two" });
  flush();
  expect(spacer.style.minHeight).toBe("0px");
  view.unmount();
});

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

it("keeps restored reading through content updates until the user returns to the bottom", () => {
  const schedule = vi.fn(() => 1);
  vi.stubGlobal("requestAnimationFrame", schedule);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  try {
    const element = document.createElement("div");
    setScrollMetrics(element, { clientHeight: 100, scrollHeight: 1000, scrollTop: 400 });
    const view = renderHook(({ version }) => useStickyBottomScroll({
      scrollRef: { current: element }, resetKey: "restored", isLoading: false,
      hasContent: true, contentVersion: version, initialScrollTop: 400,
    }), { initialProps: { version: 1 } });
    view.rerender({ version: 2 });
    expect(schedule).not.toHaveBeenCalled();
    expect(view.result.current.isAtBottom).toBe(false);
    element.scrollTop = 900;
    act(() => view.result.current.onScroll());
    view.rerender({ version: 3 });
    expect(schedule).toHaveBeenCalled();
    view.unmount();
  } finally {
    vi.unstubAllGlobals();
  }
});
