import { act, render, screen } from "@testing-library/react";
import { ChatCollapsibleContent } from "./chat-collapsible-content";

afterEach(() => vi.restoreAllMocks());

it("retargets within the original deadline and never animates an open ancestor afterward", () => {
  let resize: ResizeObserverCallback | undefined;
  let now = 0;
  let height = 80;
  const animations: Array<{ onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> }> = [];
  const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
    const animation = { onfinish: null, cancel: vi.fn() };
    animations.push(animation);
    return animation;
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { height: this.classList.contains("flow-root") ? height : 40 } as DOMRect;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe = vi.fn();
    disconnect = vi.fn();
  });
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  try {
    const children = () => <span>Details</span>;
    const view = render(<ChatCollapsibleContent open={false}>{children}</ChatCollapsibleContent>);
    view.rerender(<ChatCollapsibleContent open>{children}</ChatCollapsibleContent>);
    expect(animate.mock.calls.at(-1)?.[1].duration).toBe(200);
    now = 150;
    height = 360;
    act(() => resize?.([], {} as ResizeObserver));
    expect(animate.mock.calls.at(-1)?.[1].duration).toBe(50);
    expect(animations[0]?.cancel).toHaveBeenCalled();
    act(() => animations.at(-1)?.onfinish?.());
    height = 500;
    act(() => resize?.([], {} as ResizeObserver));
    expect(animate).toHaveBeenCalledTimes(2);
    expect((view.container.firstElementChild as HTMLElement).style.height).toBe("auto");
    view.unmount();
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.unstubAllGlobals();
  }
});

it("does not replay expansion when already-open content grows", () => {
  let resize: ResizeObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  let height = 80;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { height: this.classList.contains('flow-root') ? height : 0 } as DOMRect;
  });
  const animations: Array<{ onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> }> = [];
  const animate = vi.fn((_frames: Keyframe[]) => {
    const animation = { onfinish: null, cancel: vi.fn() };
    animations.push(animation);
    return animation;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  try {
    const view = render(<ChatCollapsibleContent open>{() => <span>Loading</span>}</ChatCollapsibleContent>);
    expect(animate).not.toHaveBeenCalled();
    height = 360;
    view.rerender(<ChatCollapsibleContent open>{() => <span>Loaded detail</span>}</ChatCollapsibleContent>);
    act(() => resize?.([], {} as ResizeObserver));
    expect(animate).not.toHaveBeenCalled();
    expect((view.container.firstElementChild as HTMLElement).style.height).toBe('auto');
    view.unmount();
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.unstubAllGlobals();
  }
});

it("keeps content mounted during closing and reverses without replacing its DOM", () => {
  const animations: Array<{ onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> }> = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(() => {
      const animation = { onfinish: null, cancel: vi.fn() };
      animations.push(animation);
      return animation;
    }),
  });
  try {
    const children = () => <button>Detail action</button>;
    const view = render(<ChatCollapsibleContent open={false}>{children}</ChatCollapsibleContent>);
    expect(screen.queryByText("Detail action")).toBeNull();
    view.rerender(<ChatCollapsibleContent open>{children}</ChatCollapsibleContent>);
    const button = screen.getByText("Detail action");
    act(() => animations.at(-1)?.onfinish?.());
    view.rerender(<ChatCollapsibleContent open={false}>{children}</ChatCollapsibleContent>);
    expect(button.isConnected).toBe(true);
    const frame = view.container.firstElementChild as HTMLElement;
    expect(frame.inert).toBe(true);
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    const closing = animations.at(-1)!;
    view.rerender(<ChatCollapsibleContent open>{children}</ChatCollapsibleContent>);
    expect(closing.cancel).toHaveBeenCalled();
    expect(closing.onfinish).toBeNull();
    expect(screen.getByText("Detail action")).toBe(button);
    act(() => animations.at(-1)?.onfinish?.());
    expect(frame.style.height).toBe("auto");
    view.rerender(<ChatCollapsibleContent open={false}>{children}</ChatCollapsibleContent>);
    act(() => animations.at(-1)?.onfinish?.());
    expect(button.isConnected).toBe(false);
    expect(frame.style.height).toBe("0px");
    view.unmount();
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
});

it("skips animation when reduced motion is requested", () => {
  const animate = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  try {
    const view = render(<ChatCollapsibleContent open>{() => <span>Content</span>}</ChatCollapsibleContent>);
    expect(animate).not.toHaveBeenCalled();
    view.rerender(<ChatCollapsibleContent open={false}>{() => <span>Content</span>}</ChatCollapsibleContent>);
    expect(screen.queryByText("Content")).toBeNull();
    view.unmount();
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.unstubAllGlobals();
  }
});
