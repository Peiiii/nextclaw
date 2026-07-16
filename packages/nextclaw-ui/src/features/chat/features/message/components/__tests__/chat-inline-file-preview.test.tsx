import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatInlineFilePreview } from "@/features/chat/features/message/components/chat-inline-file-preview";

const captures = vi.hoisted(() => ({
  filePreviewProps: [] as Array<{
    showBreadcrumbs?: boolean;
    onHtmlContentHeightChange?: (height: number) => void;
  }>,
}));

vi.mock(
  "@/features/chat/features/workspace/components/chat-session-workspace-file-preview",
  () => ({
    ChatSessionWorkspaceFilePreview: (props: {
      showBreadcrumbs?: boolean;
      onHtmlContentHeightChange?: (height: number) => void;
    }) => {
      captures.filePreviewProps.push(props);
      return <div data-testid="inline-workspace-file-preview" />;
    },
  }),
);

vi.mock("@/shared/lib/i18n", () => ({
  t: (key: string) => key,
}));

beforeEach(() => {
  captures.filePreviewProps = [];
});

it("renders adaptive inline HTML without persistent file chrome", () => {
  const onFileOpen = vi.fn();
  const { container } = render(
    <ChatInlineFilePreview
      display={{
        target: {
          type: "file",
          payload: { path: "preview.html", viewer: "rendered" },
        },
        title: "Preview",
        description: "Rendered HTML",
      }}
      parentSessionKey={null}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
      onFileOpen={onFileOpen}
    />,
  );

  expect(screen.queryByText("Preview")).toBeNull();
  expect(screen.queryByText("preview.html")).toBeNull();
  expect(screen.queryByText("Rendered HTML")).toBeNull();
  const preview = container.querySelector(
    '[data-chat-inline-file-preview="true"]',
  );
  const actions = container.querySelector(
    '[data-chat-inline-file-actions="true"]',
  );
  const viewport = container.querySelector<HTMLElement>(
    '[data-chat-inline-file-viewport="true"]',
  );
  const iframeSurface = screen.getByTestId("inline-workspace-file-preview");
  expect(preview?.classList.contains("border")).toBe(false);
  expect(preview?.classList.contains("pt-9")).toBe(false);
  expect(actions?.classList.contains("left-1/2")).toBe(true);
  expect(actions?.classList.contains("-translate-x-1/2")).toBe(true);
  expect(actions?.classList.contains("bottom-full")).toBe(true);
  expect(actions?.classList.contains("pb-2")).toBe(true);
  expect(actions?.classList.contains("right-2")).toBe(false);
  expect(actions?.classList.contains("opacity-0")).toBe(true);
  expect(actions?.classList.contains("pointer-events-none")).toBe(true);
  expect(
    actions?.classList.contains("group-hover/inline-html:opacity-100"),
  ).toBe(true);
  expect(
    actions?.classList.contains("group-hover/inline-html:pointer-events-auto"),
  ).toBe(true);
  expect(
    actions?.classList.contains("group-focus-within/inline-html:opacity-100"),
  ).toBe(true);
  expect(
    actions?.classList.contains(
      "group-focus-within/inline-html:pointer-events-auto",
    ),
  ).toBe(true);
  expect(
    container.querySelector('[data-chat-inline-file-actions-surface="true"]'),
  ).toBeTruthy();
  expect(viewport?.classList.contains("rounded-lg")).toBe(true);
  expect(viewport?.classList.contains("h-[240px]")).toBe(true);
  expect(viewport?.classList.contains("max-h-[min(80vh,720px)]")).toBe(true);
  expect(captures.filePreviewProps.at(-1)?.showBreadcrumbs).toBe(false);
  expect(captures.filePreviewProps.at(-1)?.onHtmlContentHeightChange).toEqual(
    expect.any(Function),
  );

  act(() => {
    captures.filePreviewProps.at(-1)?.onHtmlContentHeightChange?.(560);
  });

  expect(viewport?.style.height).toBe("560px");
  expect(screen.getByTestId("inline-workspace-file-preview")).toBe(
    iframeSurface,
  );

  fireEvent.click(screen.getByLabelText("chatPanelCardExpand"));
  fireEvent.click(screen.getByLabelText("chatWorkspaceOpenSource"));

  expect(onFileOpen).toHaveBeenNthCalledWith(1, {
    path: "preview.html",
    label: "Preview",
    viewMode: "preview",
    previewViewer: "rendered",
    line: undefined,
    column: undefined,
  });
  expect(onFileOpen).toHaveBeenNthCalledWith(2, {
    path: "preview.html",
    label: "Preview",
    viewMode: "preview",
    previewViewer: "source",
    line: undefined,
    column: undefined,
  });
});

it("keeps file chrome for non-HTML inline previews", () => {
  const { container } = render(
    <ChatInlineFilePreview
      display={{
        target: {
          type: "file",
          payload: { path: "notes.md", viewer: "rendered" },
        },
        title: "Notes",
      }}
      parentSessionKey={null}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
      onFileOpen={vi.fn()}
    />,
  );

  expect(screen.getByText("Notes")).toBeTruthy();
  expect(screen.getByText("notes.md")).toBeTruthy();
  expect(
    container
      .querySelector('[data-chat-inline-file-preview="true"]')
      ?.classList.contains("border"),
  ).toBe(true);
  expect(
    container.querySelector('[data-chat-inline-file-actions="true"]'),
  ).toBeNull();
  expect(
    captures.filePreviewProps.at(-1)?.onHtmlContentHeightChange,
  ).toBeUndefined();
});
