import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkbenchSurface } from "@/shared/components/workbench/workbench-surface";
import { WorkbenchSurfaceManager } from "@/shared/components/workbench/managers/workbench-surface.manager";
import { useWorkbenchSurfaceStore } from "@/shared/components/workbench/stores/workbench-surface.store";

const manager = new WorkbenchSurfaceManager();
beforeEach(() => {
  useWorkbenchSurfaceStore.setState({ surfaces: {} });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1200,
  });
});

it("retains the exact input and iframe nodes through every presentation transition and hiding", () => {
  const props = {
    id: "resource",
    title: "Resource",
    manager,
    onClose: vi.fn(),
  };
  const content = (
    <>
      <textarea aria-label="Draft" defaultValue="Keep me" />
      <iframe title="App" src="about:blank" />
    </>
  );
  const view = render(
    <WorkbenchSurface {...props}>{content}</WorkbenchSurface>,
  );
  const input = screen.getByRole("textbox");
  const iframe = screen.getByTitle("App");
  for (const action of [
    "Float view group",
    "Maximize",
    "Restore size",
    "Collapse view",
    "Expand view",
    "Dock to sidebar",
  ]) {
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(input.isConnected).toBe(true);
    expect(iframe.isConnected).toBe(true);
    expect(view.container.querySelector("textarea")).toBe(input);
    expect(view.container.querySelector("iframe")).toBe(iframe);
  }
  view.rerender(
    <WorkbenchSurface {...props} hidden>
      {content}
    </WorkbenchSurface>,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  view.rerender(<WorkbenchSurface {...props}>{content}</WorkbenchSurface>);
  expect(screen.getByRole("textbox")).toBe(input);
});

it("restores size before collapsing on Escape and keeps close separate", () => {
  const onClose = vi.fn();
  manager.place("resource", "floating");
  render(
    <WorkbenchSurface
      id="resource"
      manager={manager}
      title="Resource"
      onClose={onClose}
    >
      <textarea />
    </WorkbenchSurface>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(manager.get("resource")).toMatchObject({
    minimized: false,
    maximized: false,
  });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(manager.get("resource").minimized).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close view" }));
  expect(onClose).toHaveBeenCalledOnce();
});

it("offers keyboard resize and a compact viewport without unusable desktop controls", () => {
  const onWidthCommit = vi.fn();
  render(
    <WorkbenchSurface
      id="resource"
      manager={manager}
      title="Resource"
      onClose={vi.fn()}
      width={480}
      onWidthCommit={onWidthCommit}
    >
      <input />
    </WorkbenchSurface>,
  );
  fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowLeft" });
  expect(onWidthCommit).toHaveBeenCalledWith(504);
  act(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    window.dispatchEvent(new Event("resize"));
  });
  const region = screen.getByRole("region");
  expect(region.style.position).toBe("fixed");
  expect(within(region).queryByRole("button", { name: "Maximize" })).toBeNull();
  expect(within(region).queryByRole("separator")).toBeNull();
});
