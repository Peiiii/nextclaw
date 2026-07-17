import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { ChatMessageMarkdown } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-markdown";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));

const texts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  mermaidDiagramLabel: "Diagram",
  mermaidLoadingLabel: "Rendering diagram…",
  mermaidRenderErrorLabel: "Diagram could not be rendered; showing source instead",
};

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme-appearance");
  document.documentElement.classList.remove("dark");
  mermaidMock.initialize.mockClear();
  mermaidMock.parse.mockReset().mockResolvedValue({
    diagramType: "flowchart-v2",
  });
  mermaidMock.render.mockReset().mockResolvedValue({
    svg: '<svg data-testid="mermaid-svg" aria-roledescription="flowchart-v2"></svg>',
  });
});

it("renders fenced Mermaid blocks as strict SVG diagrams", async () => {
  const source = 'flowchart LR\n  A["Start"] --> B["Done"]';
  const { container } = render(
    <ChatMessageMarkdown
      text={`\`\`\`mermaid\n${source}\n\`\`\``}
      role="assistant"
      texts={texts}
    />,
  );

  await waitFor(() => expect(screen.getByTestId("mermaid-svg")).toBeTruthy());
  expect(mermaidMock.initialize).toHaveBeenCalledWith(
    expect.objectContaining({
      securityLevel: "strict",
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: "default",
    }),
  );
  expect(mermaidMock.parse).toHaveBeenCalledWith(source, {
    suppressErrors: true,
  });
  expect(container.querySelector("[data-chat-mermaid-diagram=true]")).toBeTruthy();
  expect(container.querySelector(".chat-codeblock")).toBeNull();
  expect(
    container.querySelector("figure[data-chat-mermaid-diagram=true]")?.className,
  ).not.toContain("border");
});

it("keeps Mermaid source hidden behind a stable surface during the first render", async () => {
  let finishRender: ((value: { svg: string }) => void) | undefined;
  mermaidMock.render.mockReturnValueOnce(
    new Promise<{ svg: string }>((resolve) => {
      finishRender = resolve;
    }),
  );
  const { container } = render(
    <ChatMessageMarkdown
      text={"```mermaid\nflowchart LR\n  A --> B\n```"}
      role="assistant"
      texts={texts}
    />,
  );

  await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));
  const pendingSurface = container.querySelector(
    "figure[data-chat-mermaid-pending=true]",
  );
  expect(pendingSurface).toBeTruthy();
  expect(screen.getByText("Rendering diagram…")).toBeTruthy();
  expect(pendingSurface?.querySelector(".animate-spin")).toBeTruthy();
  expect(container.querySelector(".chat-codeblock")).toBeNull();

  finishRender?.({
    svg: '<svg data-testid="mermaid-svg" data-version="ready"></svg>',
  });
  await waitFor(() => expect(screen.getByTestId("mermaid-svg")).toBeTruthy());
  expect(container.querySelector("figure[data-chat-mermaid-diagram=true]")).toBe(
    pendingSurface,
  );
});

it("rerenders Mermaid diagrams when the host appearance changes", async () => {
  render(
    <ChatMessageMarkdown
      text={"```mermaid\nflowchart LR\n  A --> B\n```"}
      role="assistant"
      texts={texts}
    />,
  );

  await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));
  document.documentElement.setAttribute("data-theme-appearance", "dark");

  await waitFor(() => {
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "dark" }),
    );
    expect(mermaidMock.render).toHaveBeenCalledTimes(2);
  });
});

it("keeps the last rendered diagram visible while updated source is rendering", async () => {
  let finishUpdatedRender: ((value: { svg: string }) => void) | undefined;
  const updatedRender = new Promise<{ svg: string }>((resolve) => {
    finishUpdatedRender = resolve;
  });
  mermaidMock.render
    .mockResolvedValueOnce({
      svg: '<svg data-testid="mermaid-svg" data-version="first"></svg>',
    })
    .mockReturnValueOnce(updatedRender);
  const { rerender } = render(
    <ChatMessageMarkdown
      text={"```mermaid\nflowchart LR\n  A --> B\n```"}
      role="assistant"
      texts={texts}
    />,
  );

  const firstDiagram = await screen.findByTestId("mermaid-svg");
  rerender(
    <ChatMessageMarkdown
      text={"```mermaid\nflowchart LR\n  A --> B --> C\n```"}
      role="assistant"
      texts={texts}
    />,
  );
  await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));

  expect(screen.getByTestId("mermaid-svg")).toBe(firstDiagram);
  finishUpdatedRender?.({
    svg: '<svg data-testid="mermaid-svg" data-version="second"></svg>',
  });
  await waitFor(() => {
    expect(screen.getByTestId("mermaid-svg").getAttribute("data-version")).toBe(
      "second",
    );
  });
});

it("renders valid snapshots during uninterrupted streaming and final source immediately", async () => {
  vi.useFakeTimers();
  try {
    const { container, rerender } = render(
      <ChatMessageMarkdown
        isStreaming
        text={"```mermaid\nflowchart LR\n  A\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    expect(container.querySelector(".chat-codeblock")).toBeNull();
    expect(
      container.querySelector("figure[data-chat-mermaid-pending=true]"),
    ).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender(
      <ChatMessageMarkdown
        isStreaming
        text={"```mermaid\nflowchart LR\n  A --> B\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender(
      <ChatMessageMarkdown
        isStreaming
        text={"```mermaid\nflowchart LR\n  A --> B --> C\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));

    expect(mermaidMock.render).toHaveBeenCalled();
    const streamingRenderCount = mermaidMock.render.mock.calls.length;

    rerender(
      <ChatMessageMarkdown
        text={"```mermaid\nflowchart LR\n  A --> B --> C --> D\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(mermaidMock.render.mock.calls.length).toBeGreaterThan(
      streamingRenderCount,
    );
    expect(mermaidMock.parse).toHaveBeenLastCalledWith(
      "flowchart LR\n  A --> B --> C --> D",
      { suppressErrors: true },
    );
    expect(screen.getByTestId("mermaid-svg")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it("schedules the initial streaming frame under React Strict Mode", async () => {
  vi.useFakeTimers();
  try {
    render(
      <StrictMode>
        <ChatMessageMarkdown
          isStreaming
          text={"```mermaid\nflowchart LR\n  A --> B\n```"}
          role="assistant"
          texts={texts}
        />
      </StrictMode>,
    );

    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(mermaidMock.render).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("serializes slow streaming renders and catches up with the latest source", async () => {
  vi.useFakeTimers();
  try {
    let finishFirstRender: ((value: { svg: string }) => void) | undefined;
    mermaidMock.render.mockReturnValueOnce(
      new Promise<{ svg: string }>((resolve) => {
        finishFirstRender = resolve;
      }),
    );
    const { rerender } = render(
      <ChatMessageMarkdown
        isStreaming
        text={"```mermaid\nflowchart LR\n  A --> B\n```"}
        role="assistant"
        texts={texts}
      />,
    );

    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    rerender(
      <ChatMessageMarkdown
        isStreaming
        text={"```mermaid\nflowchart LR\n  A --> B --> C\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(mermaidMock.render).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishFirstRender?.({
        svg: '<svg data-testid="mermaid-svg" data-version="first"></svg>',
      });
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(mermaidMock.render).toHaveBeenCalledTimes(2);
    expect(mermaidMock.parse).toHaveBeenLastCalledWith(
      "flowchart LR\n  A --> B --> C",
      { suppressErrors: true },
    );
  } finally {
    vi.useRealTimers();
  }
});

it("suppresses transient syntax errors until streaming is complete", async () => {
  vi.useFakeTimers();
  try {
    const { container, rerender } = render(
      <ChatMessageMarkdown
        text={"```mermaid\nflowchart LR\n  A --> B\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    const lastValidDiagram = screen.getByTestId("mermaid-svg");

    mermaidMock.parse.mockResolvedValueOnce(false);
    rerender(
      <ChatMessageMarkdown
        isStreaming
        text={"```mermaid\nflowchart LR\n  A --\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(screen.getByTestId("mermaid-svg")).toBe(lastValidDiagram);
    expect(container.querySelector("[data-chat-mermaid-error=true]")).toBeNull();

    mermaidMock.parse.mockResolvedValueOnce(false);
    rerender(
      <ChatMessageMarkdown
        text={"```mermaid\nflowchart LR\n  A --\n```"}
        role="assistant"
        texts={texts}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(container.querySelector("[data-chat-mermaid-error=true]")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it("falls back to copyable source when Mermaid syntax is invalid", async () => {
  mermaidMock.parse.mockResolvedValueOnce(false);
  const { container } = render(
    <ChatMessageMarkdown
      text={"```mermaid\nnot-a-diagram\n```"}
      role="assistant"
      texts={texts}
    />,
  );

  expect(
    await screen.findByText("Diagram could not be rendered; showing source instead"),
  ).toBeTruthy();
  expect(container.querySelector("[data-chat-mermaid-error=true]")).toBeTruthy();
  expect(container.querySelector(".chat-codeblock code")?.textContent).toBe(
    "not-a-diagram",
  );
  expect(mermaidMock.render).not.toHaveBeenCalled();
});
