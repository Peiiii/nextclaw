import { act, fireEvent, render, screen } from "@testing-library/react";
import { ChatToolActivityScrollArea } from "./chat-tool-activity-scroll-area";

it("indicates only hidden edges and responds to nested detail growth", () => {
  let resize: ResizeObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  try {
    const view = render(<ChatToolActivityScrollArea label="Tools"><button>Tool detail</button></ChatToolActivityScrollArea>);
    const region = screen.getByRole("region", { name: "Tools" });
    const detail = screen.getByRole("button", { name: "Tool detail" });
    let height = 200;
    Object.defineProperties(region, {
      clientHeight: { value: 300 },
      scrollHeight: { get: () => height },
    });
    act(() => resize?.([], {} as ResizeObserver));
    expect(region.style.maskImage).toBe("none");
    height = 1000;
    act(() => resize?.([], {} as ResizeObserver));
    expect(region.style.maskImage).toBe("linear-gradient(to bottom, black, black calc(100% - 16px), transparent)");
    region.scrollTop = 200;
    fireEvent.scroll(region);
    expect(region.style.maskImage).toBe("linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)");
    region.scrollTop = 700;
    fireEvent.scroll(region);
    expect(region.style.maskImage).toBe("linear-gradient(to bottom, transparent, black 16px, black)");
    expect(screen.getByRole("button", { name: "Tool detail" })).toBe(detail);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
