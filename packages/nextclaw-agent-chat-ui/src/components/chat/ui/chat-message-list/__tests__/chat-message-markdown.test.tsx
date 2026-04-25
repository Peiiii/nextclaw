import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageMarkdown } from "../chat-message-markdown";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
};

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

it("renders fenced code blocks with syntax highlighting", () => {
  const { container } = render(
    <ChatMessageMarkdown
      text={"```ts\nconst value: number = 1;\n```"}
      role="assistant"
      texts={defaultTexts}
    />,
  );

  const code = container.querySelector(".chat-codeblock code");

  expect(code?.getAttribute("data-highlighted")).toBe("true");
  expect(code?.className).toContain("language-ts");
  expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const");
  expect(container.querySelector(".hljs-number")?.textContent).toBe("1");
});

it("keeps highlighted code content escaped", () => {
  const { container } = render(
    <ChatMessageMarkdown
      text={"```html\n<img src=x onerror=alert(1)>\n```"}
      role="assistant"
      texts={defaultTexts}
    />,
  );

  const code = container.querySelector(".chat-codeblock code");

  expect(code?.textContent).toBe("<img src=x onerror=alert(1)>");
  expect(code?.querySelector("img")).toBeNull();
});
