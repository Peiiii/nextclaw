import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageMarkdown } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-markdown";

const texts = { copyCodeLabel: "Copy", copiedCodeLabel: "Copied", detailsLabel: "详细内容" };
function document(text: string) {
  return <ChatMessageMarkdown text={text} role="assistant" texts={texts} />;
}

it("opens and closes Markdown content without swallowing the following body", () => {
  const view = render(document('<details>\n<summary>More</summary>\n\n## Inside\n\n- Item\n\n```ts\nconst value = 1;\n```\n\n$x^2$\n\n</details>\n\n# After'));
  const toggle = screen.getByRole("button", { name: "More" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Item")).toBeNull();
  fireEvent.click(toggle);
  expect(screen.getByRole("heading", { name: "Inside" })).toBeTruthy();
  expect(view.container.querySelector(".katex")).not.toBeNull();
  expect(view.container.querySelector("code")?.textContent).toContain("const value = 1");
  fireEvent.click(toggle);
  expect(screen.queryByText("Item")).toBeNull();
  expect(screen.getByRole("heading", { name: "After" })).toBeTruthy();
});

it("supports open, nested details and content updates without resetting the user's choice", () => {
  const source = '<details open>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\nNested\n\n</details>\n\n</details>';
  const view = render(document(source));
  const outer = screen.getByRole("button", { name: "Outer" });
  fireEvent.click(screen.getByRole("button", { name: "Inner" }));
  expect(screen.getByText("Nested")).toBeTruthy();
  fireEvent.click(outer);
  view.rerender(document(source + '\n\nMore text'));
  expect(outer.getAttribute("aria-expanded")).toBe("false");
});

it("preserves literal tags in code and provides a localized missing-summary label", () => {
  const view = render(document('`<details>`\n\n```html\n<details><summary>Code</summary></details>\n```\n\n<details open>Fallback body</details>'));
  expect(screen.queryByRole("button", { name: "Code" })).toBeNull();
  expect(view.container.querySelector("code")?.textContent).toBe("<details>");
  expect(screen.getByRole("button", { name: "详细内容" })).toBeTruthy();
});

it("removes executable HTML and unsafe attributes and keeps summary links out of the button", () => {
  const view = render(document('<details open onclick="alert(1)"><summary><a href="javascript:alert(1)">Safe title</a></summary><script>alert(1)</script><iframe src="https://example.com"></iframe><img src="x" onerror="alert(1)"></details>'));
  expect(screen.getByRole("button", { name: "Safe title" }).querySelector("a")).toBeNull();
  expect(view.container.querySelector("script,iframe,[onclick],[onerror]")).toBeNull();
});
