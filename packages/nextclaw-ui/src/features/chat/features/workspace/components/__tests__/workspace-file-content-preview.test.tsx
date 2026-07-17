import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceFileContentPreview } from "@/features/chat/features/workspace/components/workspace-file-content-preview";

const defaultResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
  vi.stubGlobal("ResizeObserver", defaultResizeObserver);
});

it("reports same-origin HTML height changes without replacing the iframe", () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  let notifyResize: ResizeObserverCallback = () => undefined;
  class HeightResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notifyResize = callback;
    }

    observe = observe;

    unobserve = vi.fn();

    disconnect = disconnect;
  }
  vi.stubGlobal("ResizeObserver", HeightResizeObserver);
  const onHtmlContentHeightChange = vi.fn();
  const { unmount } = render(
    <WorkspaceFileContentPreview
      contentUrl="/api/server-paths/content?path=%2Ftmp%2Fexample.html"
      kind="html"
      label="example.html"
      onHtmlContentHeightChange={onHtmlContentHeightChange}
    />,
  );
  const frame = screen.getByTestId(
    "workspace-html-preview",
  ) as HTMLIFrameElement;
  const iframeDocument = document.implementation.createHTMLDocument();
  Object.defineProperty(frame, "contentDocument", {
    configurable: true,
    value: iframeDocument,
  });
  const { documentElement } = iframeDocument;
  Object.defineProperty(documentElement, "scrollHeight", {
    configurable: true,
    value: 640,
  });

  fireEvent.load(frame);

  expect(onHtmlContentHeightChange).toHaveBeenLastCalledWith(640);
  expect(observe).toHaveBeenCalledWith(documentElement);
  expect(screen.getByTestId("workspace-html-preview")).toBe(frame);

  Object.defineProperty(documentElement, "scrollHeight", {
    configurable: true,
    value: 900,
  });
  notifyResize([], {} as ResizeObserver);

  expect(onHtmlContentHeightChange).toHaveBeenLastCalledWith(900);
  expect(screen.getByTestId("workspace-html-preview")).toBe(frame);

  unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
});
