import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatMessageVirtualizer } from "@/features/chat/features/message/hooks/use-chat-message-virtualizer";

describe("useChatMessageVirtualizer", () => {
  it("starts from the estimated end before the first measured paint", async () => {
    const scrollElement = document.createElement("div");
    Object.defineProperties(scrollElement, {
      clientHeight: { configurable: true, value: 800 },
      offsetHeight: { configurable: true, value: 800 },
      offsetWidth: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    scrollElement.scrollTo = vi.fn((options) => {
      if (typeof options === "object" && options.top !== undefined) {
        scrollElement.scrollTop = options.top;
      }
    });
    const rows = Array.from({ length: 80 }, (_, index) => ({
      key: `message:${index}`,
    }));
    const { result } = renderHook(() =>
      useChatMessageVirtualizer({
        rows,
        scrollRef: { current: scrollElement },
      }),
    );

    await waitFor(() =>
      expect(result.current.virtualizer.getVirtualItems().at(-1)?.index).toBe(79),
    );
    expect(result.current.virtualizer.scrollOffset).toBe(14_400);
  });

  it("keeps the same visible row anchored when earlier rows are prepended", async () => {
    const scrollElement = document.createElement("div");
    Object.defineProperties(scrollElement, {
      clientHeight: { configurable: true, value: 800 },
      offsetHeight: { configurable: true, value: 800 },
      offsetWidth: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    scrollElement.getBoundingClientRect = () => ({
      bottom: 800,
      height: 800,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    scrollElement.scrollTo = vi.fn((options) => {
      if (typeof options === "object" && options.top !== undefined) {
        scrollElement.scrollTop = options.top;
      }
    });
    const initialRows = Array.from({ length: 80 }, (_, index) => ({
      key: `message:${index + 80}`,
    }));
    const { rerender, result } = renderHook(
      ({ rows }) =>
        useChatMessageVirtualizer({
          rows,
          scrollRef: { current: scrollElement },
        }),
      { initialProps: { rows: initialRows } },
    );
    scrollElement.scrollTop = 900;
    act(() => scrollElement.dispatchEvent(new Event("scroll")));
    await waitFor(() => expect(result.current.virtualizer.scrollOffset).toBe(900));
    const anchor = result.current.virtualizer.getVirtualItemForOffset(900);

    rerender({
      rows: Array.from({ length: 160 }, (_, index) => ({
        key: `message:${index}`,
      })),
    });

    await waitFor(() =>
      expect(scrollElement.scrollTop).toBeGreaterThan(900),
    );
    const anchored = result.current.virtualizer.getVirtualItemForOffset(
      scrollElement.scrollTop,
    );
    expect(anchored?.key).toBe(anchor?.key);
    expect(scrollElement.scrollTop - (anchored?.start ?? 0)).toBe(
      900 - (anchor?.start ?? 0),
    );
  });

  it("keeps mounted rows bounded while pinning the active row", async () => {
    const scrollElement = document.createElement("div");
    Object.defineProperties(scrollElement, {
      clientHeight: { configurable: true, value: 800 },
      offsetHeight: { configurable: true, value: 800 },
      offsetWidth: { configurable: true, value: 800 },
      scrollHeight: { configurable: true, value: 18_000 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    scrollElement.getBoundingClientRect = () => ({
      bottom: 800,
      height: 800,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      key: `message:${index}`,
    }));
    const { result } = renderHook(() =>
      useChatMessageVirtualizer({
        rows,
        scrollRef: { current: scrollElement },
        activeRowKey: "message:9999",
      }),
    );
    await waitFor(() => {
      expect(result.current.virtualizer.getVirtualItems().length).toBeGreaterThan(0);
    });
    const indexes = result.current.virtualizer
      .getVirtualItems()
      .map((item) => item.index);

    expect(indexes.length).toBeLessThan(30);
    expect(indexes).toContain(9_999);
  });

  it("remeasures a row when dynamic content changes its height", async () => {
    const scrollElement = document.createElement("div");
    Object.defineProperties(scrollElement, {
      offsetHeight: { configurable: true, value: 800 },
      offsetWidth: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    const { result } = renderHook(() =>
      useChatMessageVirtualizer({
        rows: [{ key: "message:1" }],
        scrollRef: { current: scrollElement },
      }),
    );
    await waitFor(() =>
      expect(result.current.virtualizer.getVirtualItems()).toHaveLength(1),
    );
    const row = document.createElement("div");
    row.dataset.index = "0";
    Object.defineProperty(row, "offsetHeight", {
      configurable: true,
      value: 420,
    });
    document.body.appendChild(row);

    act(() => result.current.virtualizer.measureElement(row));

    expect(result.current.virtualizer.getTotalSize()).toBe(420);
    row.remove();
  });
});
