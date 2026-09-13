import { act, render, screen } from "@testing-library/react";
import { ChatCollapsibleContent } from "./chat-collapsible-content";

afterEach(() => vi.restoreAllMocks());

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
