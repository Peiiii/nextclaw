import { render } from "@testing-library/react";
import { ChatMessageMarkdown } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-markdown";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
};

it.each(["\n", "\r\n", "\r"])("shows user line endings as visible breaks: %j", (lineEnding) => {
  const { container } = render(<ChatMessageMarkdown
    text={`第一行${lineEnding}第二行${lineEnding}第三行`}
    role="user" texts={defaultTexts}
  />);
  const paragraph = container.querySelector("p")!;
  expect(paragraph.querySelectorAll("br")).toHaveLength(2);
  expect(paragraph.textContent?.replace(/\s/g, "")).toBe("第一行第二行第三行");
});

it("keeps user line breaks inside formatting and list items without changing code", () => {
  const { container } = render(<ChatMessageMarkdown
    text={"**第一行\n第二行**\n\n- 列表第一行\n  列表第二行\n\n```text\n代码第一行\n代码第二行\n```"}
    role="user" texts={defaultTexts}
  />);
  expect(container.querySelector("strong br")).not.toBeNull();
  expect(container.querySelector("li br")).not.toBeNull();
  expect(container.querySelector("code")?.textContent).toBe("代码第一行\n代码第二行");
  expect(container.querySelector("code br")).toBeNull();
});

it("keeps existing hard breaks and paragraphs without adding duplicate breaks", () => {
  const { container } = render(<ChatMessageMarkdown
    text={"第一行  \n第二行\\\n第三行\n\n另一段"}
    role="user" texts={defaultTexts}
  />);
  expect(container.querySelectorAll("p")).toHaveLength(2);
  expect(container.querySelectorAll("br")).toHaveLength(2);
});

it("keeps assistant Markdown soft breaks unchanged when switching roles", () => {
  const text = "第一行\n第二行";
  const { container, rerender } = render(<ChatMessageMarkdown text={text} role="user" texts={defaultTexts} />);
  expect(container.querySelectorAll("br")).toHaveLength(1);
  rerender(<ChatMessageMarkdown text={text} role="assistant" texts={defaultTexts} />);
  expect(container.querySelectorAll("br")).toHaveLength(0);
});
