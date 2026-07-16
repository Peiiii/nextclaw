import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageMarkdown } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-markdown";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
};

function selectText(node: Node): Selection {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  if (!selection) {
    throw new Error("Selection API unavailable");
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

it("preserves rendered text identity when host callbacks change", () => {
  const firstInlineTokenClick = vi.fn();
  const secondInlineTokenClick = vi.fn();
  const view = render(
    <ChatMessageMarkdown
      text="Keep this selected"
      role="user"
      texts={defaultTexts}
      onInlineTokenClick={firstInlineTokenClick}
    />,
  );
  const selectedText = screen.getByText("Keep this selected").firstChild;
  if (!selectedText) {
    throw new Error("Expected rendered text node");
  }
  const selection = selectText(selectedText);

  view.rerender(
    <ChatMessageMarkdown
      text="Keep this selected"
      role="user"
      texts={defaultTexts}
      onInlineTokenClick={secondInlineTokenClick}
    />,
  );

  expect(screen.getByText("Keep this selected").firstChild).toBe(selectedText);
  expect(selection.toString()).toBe("Keep this selected");
});

it("uses the latest host callback without replacing rendered links", () => {
  const firstFileOpen = vi.fn();
  const secondFileOpen = vi.fn();
  const view = render(
    <ChatMessageMarkdown text="[README](README.md)" role="assistant" texts={defaultTexts} onFileOpen={firstFileOpen} />,
  );
  const link = screen.getByRole("link", { name: "README" });

  view.rerender(
    <ChatMessageMarkdown
      text="[README](README.md)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={secondFileOpen}
    />,
  );
  fireEvent.click(link);

  expect(firstFileOpen).not.toHaveBeenCalled();
  expect(secondFileOpen).toHaveBeenCalledWith({
    path: "README.md",
    label: "README.md",
    viewMode: "preview",
  });
});

it("opens local file links through the file preview action", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[README](/Users/demo/project/README.md:12:4)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  fireEvent.click(screen.getByRole("link", { name: "README" }));

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "/Users/demo/project/README.md",
    label: "README.md",
    viewMode: "preview",
    line: 12,
    column: 4,
  });
});

it("opens file URI links with GitHub-style line fragments", () => {
  const onFileOpen = vi.fn();
  const href = "file:///Users/czmac/.nvm/versions/node/v22.17.0/lib/node_modules/@nextclaw/core/dist/index.js#L5713";

  render(
    <ChatMessageMarkdown text={`[index.js](${href})`} role="assistant" texts={defaultTexts} onFileOpen={onFileOpen} />,
  );

  const link = screen.getByRole("link", { name: "index.js" });
  expect(link.getAttribute("href")).toBe(href);
  fireEvent.click(link);

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "/Users/czmac/.nvm/versions/node/v22.17.0/lib/node_modules/@nextclaw/core/dist/index.js",
    label: "index.js",
    viewMode: "preview",
    line: 5713,
  });
});

it("normalizes Windows file URI links into local file actions", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[index.ts](file:///C:/workspace/src/index.ts#L12C4)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  fireEvent.click(screen.getByRole("link", { name: "index.ts" }));

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "C:/workspace/src/index.ts",
    label: "index.ts",
    viewMode: "preview",
    line: 12,
    column: 4,
  });
});

it("ignores non-positive file locations", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[index.ts](file:///tmp/index.ts#L0C4)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  fireEvent.click(screen.getByRole("link", { name: "index.ts" }));

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "/tmp/index.ts",
    label: "index.ts",
    viewMode: "preview",
  });
});

it("rejects remote-host file URI links instead of treating them as local paths", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[remote](file://files.example.com/shared/index.ts)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  const link = screen.getByRole("link", { name: "remote" });
  expect(link.getAttribute("href")).toBe("#");
  expect(link.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(link);
  expect(onFileOpen).not.toHaveBeenCalled();
});

it("opens absolute html file links through the existing file preview action", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[particle-cosmos.html](/Users/peiwang/Downloads/particle-cosmos.html)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  const link = screen.getByRole("link", { name: "particle-cosmos.html" });
  expect(link.getAttribute("href")).toBe("/Users/peiwang/Downloads/particle-cosmos.html");
  expect(link.getAttribute("node")).toBeNull();

  fireEvent.click(link);

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "/Users/peiwang/Downloads/particle-cosmos.html",
    label: "particle-cosmos.html",
    viewMode: "preview",
  });
});

it("opens html file links in rendered mode only when the viewer query asks for it", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[particle-cosmos.html](/Users/peiwang/Downloads/particle-cosmos.html?viewer=rendered)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  const link = screen.getByRole("link", { name: "particle-cosmos.html" });
  expect(link.getAttribute("href")).toBe("/Users/peiwang/Downloads/particle-cosmos.html?viewer=rendered");

  fireEvent.click(link);

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "/Users/peiwang/Downloads/particle-cosmos.html",
    label: "particle-cosmos.html",
    viewMode: "preview",
    previewViewer: "rendered",
  });
});

it("opens project-root html links in rendered mode when the viewer query asks for it", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[preview](preview.html?viewer=rendered)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  fireEvent.click(screen.getByRole("link", { name: "preview" }));

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "preview.html",
    label: "preview.html",
    viewMode: "preview",
    previewViewer: "rendered",
  });
});

it("opens project-relative file links through the file preview action", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[cron](packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  fireEvent.click(screen.getByRole("link", { name: "cron" }));

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "packages/nextclaw-ui/src/features/chat/components/workspace/session-cron-job-content.tsx",
    label: "session-cron-job-content.tsx",
    viewMode: "preview",
  });
});

it("opens project-root file links through the file preview action", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown text="[rules](AGENTS.md)" role="assistant" texts={defaultTexts} onFileOpen={onFileOpen} />,
  );

  fireEvent.click(screen.getByRole("link", { name: "rules" }));

  expect(onFileOpen).toHaveBeenCalledWith({
    path: "AGENTS.md",
    label: "AGENTS.md",
    viewMode: "preview",
  });
});

it("leaves external links alone when file preview interception is enabled", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[Docs](https://nextclaw.io)"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  const link = screen.getByRole("link", { name: "Docs" });
  fireEvent.click(link);

  expect(link.getAttribute("href")).toBe("https://nextclaw.io");
  expect(onFileOpen).not.toHaveBeenCalled();
});

it.each(["report.docx", "workbook.xlsx", "slides.pptx"])(
  "opens bare Office file link %s through the local resource contract",
  (path) => {
    const onFileOpen = vi.fn();

    render(
      <ChatMessageMarkdown
        text={`[office file](${path})`}
        role="assistant"
        texts={defaultTexts}
        onFileOpen={onFileOpen}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "office file" }));

    expect(onFileOpen).toHaveBeenCalledWith({
      path,
      label: path,
      viewMode: "preview",
    });
  },
);

it("resolves local Markdown image paths through the host file-content contract", () => {
  const resolveFileContentUrl = vi.fn(
    (action: { path: string }) => `/api/server-paths/content?path=${encodeURIComponent(action.path)}`,
  );

  render(
    <ChatMessageMarkdown
      text="![diagram](/Users/demo/project/diagram.svg)"
      role="assistant"
      texts={defaultTexts}
      resolveFileContentUrl={resolveFileContentUrl}
    />,
  );

  expect(resolveFileContentUrl).toHaveBeenCalledWith({
    path: "/Users/demo/project/diagram.svg",
    label: "diagram.svg",
    viewMode: "preview",
  });
  expect(screen.getByRole("img", { name: "diagram" }).getAttribute("src")).toBe(
    "/api/server-paths/content?path=%2FUsers%2Fdemo%2Fproject%2Fdiagram.svg",
  );
  expect(
    screen.getByRole("img", { name: "diagram" }).closest("[data-chat-message-image-preview]")?.className,
  ).toContain("max-w-[min(100%,32rem)]");
  expect(
    screen.getByRole("img", { name: "diagram" }).closest("[data-chat-message-image-preview]")?.className,
  ).toContain("overflow-hidden");
  expect(
    screen.getByRole("img", { name: "diagram" }).closest("[data-chat-message-image-preview]")?.className,
  ).not.toContain("border");
  expect(
    screen.getByRole("img", { name: "diagram" }).closest("[data-chat-message-image-preview]")?.className,
  ).not.toContain("shadow");
  expect(screen.getByRole("img", { name: "diagram" }).className).toContain("rounded-lg");
});

it("resolves project-relative Markdown image paths", () => {
  const resolveFileContentUrl = vi.fn(() => "/api/server-paths/content?path=assets%2Fdiagram.png");

  render(
    <ChatMessageMarkdown
      text="![diagram](assets/diagram.png)"
      role="assistant"
      texts={defaultTexts}
      resolveFileContentUrl={resolveFileContentUrl}
    />,
  );

  expect(resolveFileContentUrl).toHaveBeenCalledWith({
    path: "assets/diagram.png",
    label: "diagram.png",
    viewMode: "preview",
  });
  expect(screen.getByRole("img", { name: "diagram" }).getAttribute("src")).toBe(
    "/api/server-paths/content?path=assets%2Fdiagram.png",
  );
});

it("groups three same-line Markdown images into one compact row", () => {
  render(
    <ChatMessageMarkdown
      text="![one](https://example.com/one.png) ![two](https://example.com/two.png) ![three](https://example.com/three.png)"
      role="assistant"
      texts={defaultTexts}
    />,
  );

  const imageRow = document.querySelector('[data-chat-image-row="three-column"]');
  expect(imageRow).toBeTruthy();
  expect(imageRow?.querySelectorAll(":scope > [data-chat-message-image-preview]").length).toBe(3);
});

it("keeps explicitly line-broken Markdown images in the vertical flow", () => {
  render(
    <ChatMessageMarkdown
      text={[
        "![one](https://example.com/one.png)",
        "![two](https://example.com/two.png)",
        "![three](https://example.com/three.png)",
      ].join("\n")}
      role="assistant"
      texts={defaultTexts}
    />,
  );

  expect(document.querySelector('[data-chat-image-row="three-column"]')).toBeNull();
});

it("keeps external Markdown image URLs unchanged", () => {
  const resolveFileContentUrl = vi.fn();

  render(
    <ChatMessageMarkdown
      text="![logo](https://example.com/logo.png)"
      role="assistant"
      texts={defaultTexts}
      resolveFileContentUrl={resolveFileContentUrl}
    />,
  );

  expect(screen.getByRole("img", { name: "logo" }).getAttribute("src")).toBe("https://example.com/logo.png");
  expect(resolveFileContentUrl).not.toHaveBeenCalled();
});

it("uses the shared expandable preview for consecutive Markdown images", () => {
  const { container } = render(
    <ChatMessageMarkdown
      text={"![one](https://example.com/one.png)\n![two](https://example.com/two.png)"}
      role="assistant"
      texts={defaultTexts}
    />,
  );

  const previews = container.querySelectorAll("[data-chat-message-image-preview]");
  expect(previews).toHaveLength(2);
  expect(previews[0]?.tagName).toBe("SPAN");
  expect(previews[0]?.nextElementSibling).toBe(previews[1]);

  fireEvent.click(screen.getAllByLabelText("Expand image")[0]!);
  expect(screen.getByTestId("chat-message-image-lightbox")).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByTestId("chat-message-image-lightbox")).toBeNull();
});

it("keeps every scheme-less Markdown href clickable as a local resource", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown text="[site](example.com)" role="assistant" texts={defaultTexts} onFileOpen={onFileOpen} />,
  );

  const link = screen.getByRole("link", { name: "site" });
  expect(link.getAttribute("href")).toBe("example.com");
  fireEvent.click(link);
  expect(onFileOpen).toHaveBeenCalledWith({
    path: "example.com",
    label: "example.com",
    viewMode: "preview",
  });
});

it("preserves link semantics while blocking unsafe protocols", () => {
  const onFileOpen = vi.fn();

  render(
    <ChatMessageMarkdown
      text="[bad](javascript:alert(1))"
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  const link = screen.getByRole("link", { name: "bad" });
  expect(link.getAttribute("href")).toBe("#");
  expect(link.getAttribute("aria-disabled")).toBe("true");
  expect(link.className).toContain("chat-link-invalid");
  fireEvent.click(link);
  expect(onFileOpen).not.toHaveBeenCalled();
});

it("renders fenced code blocks with syntax highlighting", () => {
  const { container } = render(
    <ChatMessageMarkdown text={"```ts\nconst value: number = 1;\n```"} role="assistant" texts={defaultTexts} />,
  );

  const code = container.querySelector(".chat-codeblock code");

  expect(code?.getAttribute("data-highlighted")).toBe("true");
  expect(code?.className).toContain("language-ts");
  expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const");
  expect(container.querySelector(".hljs-number")?.textContent).toBe("1");
});

it("renders nextclaw inline display directives as inert display surfaces", () => {
  const onFileOpen = vi.fn();
  const { container } = render(
    <ChatMessageMarkdown
      text={
        '```nextclaw-inline\n{"target":{"type":"file","payload":{"path":"docs/demo.md","viewer":"rendered"}},"title":"Demo","description":"Rendered preview"}\n```'
      }
      role="assistant"
      texts={defaultTexts}
      onFileOpen={onFileOpen}
    />,
  );

  const display = container.querySelector('[data-nextclaw-inline-display="true"]');

  expect(display).toBeTruthy();
  expect(display?.getAttribute("data-nextclaw-inline-display-type")).toBe("file");
  expect(screen.getByText("Demo")).toBeTruthy();
  expect(screen.getByText("Rendered preview")).toBeTruthy();
  expect(screen.getByText("docs/demo.md")).toBeTruthy();
  expect(container.querySelector(".chat-codeblock")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(onFileOpen).not.toHaveBeenCalled();
});

it("delegates nextclaw inline display rendering to the host renderer", () => {
  render(
    <ChatMessageMarkdown
      text={
        '```nextclaw-inline\n{"target":{"type":"panel_app","payload":{"appId":"weather-card"}},"title":"Weather"}\n```'
      }
      role="assistant"
      texts={defaultTexts}
      renderInlineDisplay={(display) =>
        display.target.type === "panel_app" ? (
          <div data-testid="inline-panel-app">
            {display.target.payload.appId}:{display.title}
          </div>
        ) : undefined
      }
    />,
  );

  expect(screen.getByTestId("inline-panel-app").textContent).toBe("weather-card:Weather");
  expect(screen.queryByText("nextclaw-inline")).toBeNull();
});

it("falls back to a normal code block for invalid inline display directives", () => {
  const { container } = render(
    <ChatMessageMarkdown text={"```nextclaw-inline\nnot json\n```"} role="assistant" texts={defaultTexts} />,
  );

  const code = container.querySelector(".chat-codeblock code");

  expect(code?.textContent).toBe("not json");
  expect(code?.className).toContain("language-nextclaw-inline");
  expect(container.querySelector("[data-nextclaw-inline-display]")).toBeNull();
});

it("keeps highlighted code content escaped", () => {
  const { container } = render(
    <ChatMessageMarkdown text={"```html\n<img src=x onerror=alert(1)>\n```"} role="assistant" texts={defaultTexts} />,
  );

  const code = container.querySelector(".chat-codeblock code");

  expect(code?.textContent).toBe("<img src=x onerror=alert(1)>");
  expect(code?.querySelector("img")).toBeNull();
});

it("renders inline tokens from normal markdown text", () => {
  render(
    <ChatMessageMarkdown
      text="review @panel-app:task-board now"
      role="assistant"
      texts={defaultTexts}
      inlineTokens={[
        {
          kind: "panel_app",
          key: "task-board",
          label: "Task Board",
          rawText: "@panel-app:task-board",
        },
      ]}
    />,
  );

  expect(screen.getByText("Task Board")).toBeTruthy();
});

it("leaves inline token protocols literal inside inline code", () => {
  const { container } = render(
    <ChatMessageMarkdown
      text="review `@panel-app:task-board` now"
      role="assistant"
      texts={defaultTexts}
      inlineTokens={[
        {
          kind: "panel_app",
          key: "task-board",
          label: "Task Board",
          rawText: "@panel-app:task-board",
        },
      ]}
    />,
  );

  expect(screen.queryByText("Task Board")).toBeNull();
  expect(container.querySelector("code")?.textContent).toBe("@panel-app:task-board");
});

it("leaves inline token protocols literal inside fenced code blocks", () => {
  const { container } = render(
    <ChatMessageMarkdown
      text={"```txt\n@panel-app:task-board\n```"}
      role="assistant"
      texts={defaultTexts}
      inlineTokens={[
        {
          kind: "panel_app",
          key: "task-board",
          label: "Task Board",
          rawText: "@panel-app:task-board",
        },
      ]}
    />,
  );

  expect(screen.queryByText("Task Board")).toBeNull();
  expect(container.querySelector(".chat-codeblock code")?.textContent).toBe("@panel-app:task-board");
});

it("renders tokens outside fenced code while preserving code literals", () => {
  const { container } = render(
    <ChatMessageMarkdown
      text={"review @panel-app:task-board\n\n```txt\n@panel-app:task-board\n```"}
      role="assistant"
      texts={defaultTexts}
      inlineTokens={[
        {
          kind: "panel_app",
          key: "task-board",
          label: "Task Board",
          rawText: "@panel-app:task-board",
        },
      ]}
    />,
  );

  expect(screen.getAllByText("Task Board")).toHaveLength(1);
  expect(container.querySelector(".chat-codeblock code")?.textContent).toBe("@panel-app:task-board");
});
