import { render, screen } from "@testing-library/react";
import { ChatMessageList } from "../chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

it("renders image attachments as lightweight image-first previews", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-image",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:06",
          parts: [
            {
              type: "file",
              file: {
                label: "Image attachment",
                mimeType: "image/png",
                dataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
                sizeBytes: 4096,
                isImage: true,
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(
    screen.getByRole("img", { name: "Image attachment" }).className,
  ).toContain("rounded-[1rem]");
  expect(container.querySelector("figure")).toBeNull();
  expect(container.querySelector("figcaption")).toBeNull();
  expect(screen.getByText("Image")).toBeTruthy();
  expect(screen.getByText("4 KB")).toBeTruthy();
  expect(screen.queryByText("image/png")).toBeNull();
});

it("renders image-looking files as images even when the image flag is missing", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-image-by-extension",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:09",
          parts: [
            {
              type: "file",
              file: {
                label: "draft.webp",
                mimeType: "application/octet-stream",
                dataUrl: "data:image/webp;base64,UklGRg==",
                sizeBytes: 1024,
                isImage: false,
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByRole("img", { name: "draft.webp" })).toBeTruthy();
  expect(screen.queryByText("application/octet-stream")).toBeNull();
  expect(screen.getByText("Image")).toBeTruthy();
});

it("renders non-image attachments as simplified file cards", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-file",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:08",
          parts: [
            {
              type: "file",
              file: {
                label: "spec.pdf",
                mimeType: "application/pdf",
                dataUrl: "data:application/pdf;base64,cGRm",
                sizeBytes: 2 * 1024 * 1024,
                isImage: false,
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  const link = screen.getByRole("link", { name: /spec\.pdf/i });
  expect(link.getAttribute("href")).toBe("data:application/pdf;base64,cGRm");
  expect(screen.getByText("PDF document · 2 MB")).toBeTruthy();
  expect(screen.getByText("Open")).toBeTruthy();
  expect(container.querySelector(".lucide-file-text")).toBeTruthy();
  expect(screen.queryByText("application/pdf")).toBeNull();
  expect(screen.queryByText("PDF attachment")).toBeNull();
});

it("renders archive files with a dedicated archive icon treatment", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-archive",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:10",
          parts: [
            {
              type: "file",
              file: {
                label: "recording.zip",
                mimeType: "application/zip",
                dataUrl: "data:application/zip;base64,emlw",
                sizeBytes: 76 * 1024 * 1024,
                isImage: false,
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.getByText("Archive · 76 MB")).toBeTruthy();
  expect(container.querySelector(".lucide-file-archive")).toBeTruthy();
  expect(screen.getByText("Open")).toBeTruthy();
});
