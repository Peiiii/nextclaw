import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollRestoration } from "@/shared/hooks/use-scroll-restoration";
import { scrollRestorationManager } from "@/shared/lib/navigation-history";

function ScrollSurface({ restorationKey }: { restorationKey: string }) {
  const scrollRestoration = useScrollRestoration<HTMLDivElement>({ restorationKey });
  const { onScroll, scrollRef } = scrollRestoration;
  return (
    <div
      ref={scrollRef}
      data-testid="scroll-surface"
      onScroll={onScroll}
    />
  );
}

describe("useScrollRestoration", () => {
  beforeEach(() => scrollRestorationManager.clear());

  it("restores an existing position during layout and saves scroll events", () => {
    scrollRestorationManager.save("page:first", { x: 16, y: 48 });
    const { getByTestId } = render(<ScrollSurface restorationKey="page:first" />);
    const surface = getByTestId("scroll-surface") as HTMLDivElement;

    expect(surface.scrollLeft).toBe(16);
    expect(surface.scrollTop).toBe(48);

    surface.scrollLeft = 24;
    surface.scrollTop = 72;
    fireEvent.scroll(surface);

    expect(scrollRestorationManager.read("page:first")).toEqual({ x: 24, y: 72 });
  });

  it("saves the previous key and restores the next key when navigation changes", () => {
    scrollRestorationManager.save("page:second", { x: 0, y: 96 });
    const view = render(<ScrollSurface restorationKey="page:first" />);
    const surface = view.getByTestId("scroll-surface") as HTMLDivElement;
    surface.scrollTop = 32;
    fireEvent.scroll(surface);

    view.rerender(<ScrollSurface restorationKey="page:second" />);

    expect(scrollRestorationManager.read("page:first")).toEqual({ x: 0, y: 32 });
    expect(surface.scrollTop).toBe(96);
  });

  it("keeps the last scroll event when React resets the element during navigation", () => {
    const view = render(<ScrollSurface restorationKey="page:first" />);
    const surface = view.getByTestId("scroll-surface") as HTMLDivElement;
    surface.scrollTop = 144;
    fireEvent.scroll(surface);

    // Switching the content can reset the DOM scroll position before the
    // previous layout effect's cleanup runs.
    surface.scrollTop = 0;
    view.rerender(<ScrollSurface restorationKey="page:second" />);

    expect(scrollRestorationManager.read("page:first")).toEqual({ x: 0, y: 144 });
  });
});

it("retries delayed content, preserves hidden reading, and yields to explicit user scrolling", () => {
  scrollRestorationManager.clear();
  let notifyResize = () => {};
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { notifyResize = callback; } observe = () => {}; disconnect = () => {}; });
  let height = 0;
  let position = 0;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop");
  Object.defineProperty(HTMLElement.prototype, "scrollTop", { configurable: true, get: () => position, set: (value: number) => { position = Math.min(value, height); } });
  try {
    scrollRestorationManager.save("delayed", { x: 0, y: 400 });
    const view = render(<ScrollSurface restorationKey="delayed" />);
    const element = view.getByTestId("scroll-surface");
    fireEvent.scroll(element);
    expect(scrollRestorationManager.read("delayed")?.y).toBe(400);
    height = 800;
    act(() => notifyResize());
    expect(element.scrollTop).toBe(400);
    element.hidden = true;
    element.scrollTop = 0;
    fireEvent.scroll(element);
    expect(scrollRestorationManager.read("delayed")?.y).toBe(400);
    view.unmount();

    height = 0;
    const second = render(<ScrollSurface restorationKey="delayed" />);
    fireEvent.wheel(second.getByTestId("scroll-surface"));
    height = 800;
    act(() => notifyResize());
    expect(second.getByTestId("scroll-surface").scrollTop).toBe(0);
    second.unmount();
  } finally {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollTop", descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollTop");
    vi.unstubAllGlobals();
  }
});
