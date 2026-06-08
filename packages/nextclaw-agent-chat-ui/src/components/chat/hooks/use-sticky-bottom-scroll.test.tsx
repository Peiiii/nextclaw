import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useStickyBottomScroll } from "./use-sticky-bottom-scroll";

function useStickyBottomScrollTestHarness(element: HTMLElement) {
  const scrollRef = useRef(element);

  return useStickyBottomScroll({
    scrollRef,
    resetKey: "session-1",
    isLoading: false,
    hasContent: true,
    contentVersion: "message-1",
  });
}

it("cancels the current queued sticky scroll frame on unmount", () => {
  const cancelAnimationFrameSpy = vi.fn();

  vi.stubGlobal("requestAnimationFrame", () => 42);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameSpy);

  try {
    const scrollElement = document.createElement("div");
    const view = renderHook(() => useStickyBottomScrollTestHarness(scrollElement));

    view.unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
  } finally {
    vi.unstubAllGlobals();
  }
});
