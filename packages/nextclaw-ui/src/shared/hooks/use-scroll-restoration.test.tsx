import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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
