import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UiNcpSessionUserQuestionsView } from "@nextclaw/client-sdk";
import { nextclawClient } from "@/shared/lib/api";
import { SessionUserQuestionProvider, SessionUserQuestions, UserQuestionInlineQuestions, UserQuestionReplyReference } from "@/features/chat/features/conversation/components/session-user-questions";

const questions: UiNcpSessionUserQuestionsView = {
  sessionId: "session-1",
  questions: [
    { id: "q-1", messageId: "m-1", askedAt: "2026-09-28T00:00:00.000Z", title: "Which format?", options: ["PDF", "DOCX"], recommendedOption: "PDF", optionDescriptions: { PDF: "Keeps the layout fixed." }, status: "pending" },
    { id: "q-2", messageId: "m-1", askedAt: "2026-09-28T00:00:00.000Z", title: "Which language?", status: "pending" },
  ],
};

function renderQuestions() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onResolved = vi.fn(async () => undefined);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SessionUserQuestionProvider sessionId="session-1" disabled={false} onResolved={onResolved}>
        <UserQuestionInlineQuestions data={{ questions: questions.questions.map(({ id, title }) => ({ id, title })) }} />
        <textarea aria-label="ordinary draft" defaultValue="keep this draft" />
        <SessionUserQuestions />
      </SessionUserQuestionProvider>
    </QueryClientProvider>,
  );
  return { ...view, onResolved };
}

describe("SessionUserQuestions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("opens a new question, closes without losing it, reopens from its timeline label, and removes the settled composer entry", async () => {
    let current = questions;
    vi.spyOn(nextclawClient.sessions, "listUserQuestions").mockImplementation(async () => current);
    const resolve = vi.spyOn(nextclawClient.sessions, "resolveUserQuestion").mockImplementation(async () => {
      current = { ...questions, questions: questions.questions.map((question) => question.id === "q-1" ? { ...question, status: "answered" as const, answer: "PDF" } : question) };
      return {
        question: current.questions[0]!,
        handle: { sessionId: "session-1", userMessageId: "answer-1", assistantMessageId: null, runId: "run-1", delivery: "steered" },
      };
    });
    const { onResolved } = renderQuestions();
    const autoPanel = await screen.findByRole("dialog", { name: "Which language?" });
    fireEvent.click(within(autoPanel).getByRole("button", { name: "Which format?" }));
    expect(screen.getByRole("dialog", { name: "Which format?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /关闭问题面板|Close question panel/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const formatTag = screen.getByRole("button", { name: /Which format\?.*(待回答|Waiting)/ });
    fireEvent.click(formatTag);
    const panel = screen.getByRole("dialog", { name: "Which format?" });
    expect(screen.queryByRole("button", { name: /待回答 2|2 to answer/ })).toBeNull();
    expect(within(panel).getByRole("button", { name: /发送|Send/ }).hasAttribute("disabled")).toBe(true);
    expect(within(panel).getByText(/推荐|Recommended/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: /PDF：(?:选项说明|Option details)/ }));
    expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", "Keeps the layout fixed.");
    expect(resolve).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: /^PDF\s+(推荐|Recommended)$/ }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("session-1", "q-1", { action: "answer", answer: "PDF" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle("PDF").textContent).toMatch(/Which format\?.*(已回答|Answered)/);
    expect(screen.getByRole("button", { name: /待回答 1|1 to answer/ })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "ordinary draft" }) as HTMLTextAreaElement).value).toBe("keep this draft");
  });

  it("shows the custom answer as the last lettered option and submits it on Enter", async () => {
    vi.spyOn(nextclawClient.sessions, "listUserQuestions").mockResolvedValue(questions);
    const resolve = vi.spyOn(nextclawClient.sessions, "resolveUserQuestion").mockResolvedValue({
      question: { ...questions.questions[0]!, status: "answered", answer: "ODT" },
      handle: null,
    });
    renderQuestions();
    const panel = await screen.findByRole("dialog", { name: "Which language?" });
    fireEvent.click(within(panel).getByRole("button", { name: "Which format?" }));
    const formatPanel = screen.getByRole("dialog", { name: "Which format?" });
    const input = within(formatPanel).getByRole("textbox", { name: /你的回答|Your answer/ });
    expect(input.getAttribute("placeholder")).toMatch(/自行|own/);
    expect(input.parentElement?.textContent).toContain("C");
    expect(resolve).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "ODT" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("session-1", "q-1", { action: "answer", answer: "ODT" }));
  });

  it("renders the resolved message as a reference to the original question", () => {
    render(<UserQuestionReplyReference data={{ questionId: "q-1", questionMessageId: "m-1", title: "Which format?", action: "answered", answer: "PDF" }} />);
    const quote = screen.getByText("Which format?").closest("blockquote");
    expect(quote?.getAttribute("data-chat-question-reference-id")).toBe("q-1");
    expect(quote?.getAttribute("data-chat-question-message-id")).toBe("m-1");
    expect(quote?.getAttribute("title")).toMatch(/Which format\?/);
    expect(quote?.textContent).toBe("Which format?");
  });
});
