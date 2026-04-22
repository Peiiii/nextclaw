import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentsPage } from "@/features/agents";
import { useChatInputStore, useChatSessionListStore } from "@/features/chat";
import { setLanguage } from "@/shared/lib/i18n";

const mocks = vi.hoisted(() => ({
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  sessionTypesQuery: {
    data: {
      defaultType: "native",
      options: [
        { value: "native", label: "Native", ready: true },
        { value: "codex", label: "Codex", ready: true },
        {
          value: "claude",
          label: "Claude Code",
          ready: false,
          reasonMessage: "Configure Claude Code first.",
        },
      ],
    },
  },
  agentsQuery: {
    data: {
      agents: [
        {
          id: "main",
          displayName: "Main",
          description: "系统默认入口与总控协作者。",
          builtIn: true,
          model: "openai/gpt-5.1",
          workspace: "~/.nextclaw/workspace",
          avatarUrl: null,
        },
        {
          id: "researcher",
          displayName: "Researcher",
          description: "负责调研、信息筛选与结论提炼。",
          builtIn: false,
          model: "openai/gpt-5.2",
          runtime: "codex",
          workspace: "~/.nextclaw/workspace/agents/researcher",
          avatarUrl: null,
        },
      ],
    },
    isLoading: false,
  },
  configQuery: {
    data: {
      agents: {
        defaults: {
          model: "openai/gpt-5.1",
          workspace: "~/.nextclaw/workspace",
        },
      },
      providers: {
        openai: {
          enabled: true,
          apiKeySet: true,
          models: ["gpt-5.1", "gpt-5.2"],
        },
      },
    },
  },
  configMetaQuery: {
    data: {
      providers: [
        {
          name: "openai",
          displayName: "OpenAI",
          modelPrefix: "openai",
          defaultModels: ["openai/gpt-5.1", "openai/gpt-5.2"],
          keywords: [],
          envKey: "OPENAI_API_KEY",
        },
      ],
    },
  },
}));

vi.mock("@/shared/hooks/use-agents", () => ({
  useAgents: () => mocks.agentsQuery,
  useCreateAgent: () => ({
    mutateAsync: mocks.createAgent,
    isPending: false,
  }),
  useUpdateAgent: () => ({
    mutateAsync: mocks.updateAgent,
    isPending: false,
  }),
  useDeleteAgent: () => ({
    mutate: mocks.deleteAgent,
    isPending: false,
  }),
}));

vi.mock("@/shared/hooks/use-config", () => ({
  useConfig: () => mocks.configQuery,
  useConfigMeta: () => mocks.configMetaQuery,
}));

vi.mock("@/features/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/chat")>();
  return {
    ...actual,
    useNcpChatSessionTypes: () => mocks.sessionTypesQuery,
  };
});

describe("AgentsPage", () => {
  beforeEach(() => {
    setLanguage("zh");
    mocks.createAgent.mockReset();
    mocks.updateAgent.mockReset();
    mocks.deleteAgent.mockReset();
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        pendingSessionType: "native",
        pendingProjectRoot: "/tmp/demo-project",
        pendingProjectRootSessionKey: "draft-session",
      },
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedAgentId: "main",
        selectedSessionKey: "session-1",
      },
    });
  });

  it("renders the agents workspace in Chinese and keeps core actions visible", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Agent 管理台")).toBeTruthy();
    expect(
      screen.getByText("让每个 Agent 都像真正的协作者一样存在"),
    ).toBeTruthy();
    expect(screen.getByText("全部 Agent")).toBeTruthy();
    expect(screen.getAllByText("主目录").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "开始对话" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "编辑" })).toHaveLength(2);
    expect(screen.getByText("负责调研、信息筛选与结论提炼。")).toBeTruthy();
    expect(
      screen.queryByText("专属 Agent 身份，可沉淀自己的记忆、技能与角色风格。"),
    ).toBeNull();
    expect(screen.queryByText("Agent Gallery")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "编辑" })[1]);

    expect(screen.getByText("编辑 Agent 身份")).toBeTruthy();
    expect(screen.getByText("主目录保持不变")).toBeTruthy();
    expect(screen.getByDisplayValue("Researcher")).toBeTruthy();
    expect(
      screen.getByDisplayValue("负责调研、信息筛选与结论提炼。").tagName,
    ).toBe("TEXTAREA");
    expect(screen.getByDisplayValue("gpt-5.2")).toBeTruthy();
  });

  it("uses a runtime dropdown instead of manual text input when editing an agent", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole("button", { name: "编辑" })[1]);

    const runtimeTrigger = screen.getByRole("combobox", { name: "Runtime" });
    expect(
      screen.queryByPlaceholderText("Runtime（如 native 或 codex，可选）"),
    ).toBeNull();
    expect(runtimeTrigger.textContent).toContain("Codex");
    expect(screen.queryByText("跟随默认 Runtime")).toBeNull();

    await user.click(runtimeTrigger);
    await user.click(screen.getByRole("option", { name: "Codex" }));
    await user.click(screen.getByRole("button", { name: "保存编辑" }));

    expect(mocks.updateAgent).toHaveBeenCalledWith({
      agentId: "researcher",
      data: {
        displayName: "Researcher",
        description: "负责调研、信息筛选与结论提炼。",
        avatar: "",
        model: "openai/gpt-5.2",
        runtime: "codex",
      },
    });
  });

  it("starts a draft chat with the agent runtime as the pending session type", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole("button", { name: "开始对话" })[1]);

    expect(useChatSessionListStore.getState().snapshot.selectedAgentId).toBe(
      "researcher",
    );
    expect(
      useChatSessionListStore.getState().snapshot.selectedSessionKey,
    ).toBeNull();
    expect(useChatInputStore.getState().snapshot.pendingSessionType).toBe(
      "codex",
    );
    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBeNull();
    expect(
      useChatInputStore.getState().snapshot.pendingProjectRootSessionKey,
    ).toBeNull();
  });
});
