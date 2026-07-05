import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type * as ReactRouterDom from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentsPage } from "@/features/agents";
import {
  useChatSessionListStore,
  useChatThreadStore,
} from "@/features/chat";
import { setLanguage } from "@/shared/lib/i18n";

const mocks = vi.hoisted(() => ({
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  navigate: vi.fn(),
  requestDraft: vi.fn(),
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
          runtimeConfig: {
            profile: "workspace-write",
          },
          thinkingDefault: "high",
          contextTokens: 128000,
          reservedContextTokens: 4096,
          maxToolIterations: 64,
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
          engine: "native",
          engineConfig: {},
          thinkingDefault: "off",
          models: {},
          contextTokens: 200000,
          reservedContextTokens: 10000,
          maxToolIterations: 1000,
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
const persistStorage = new Map<string, unknown>();

function createPersistStorage() {
  return {
    getItem: (name: string) => persistStorage.get(name) ?? null,
    setItem: (name: string, value: unknown) => {
      persistStorage.set(name, value);
    },
    removeItem: (name: string) => {
      persistStorage.delete(name);
    },
  };
}

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({
    chatDraftIntentManager: {
      requestDraft: mocks.requestDraft,
    },
  }),
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
  useProviders: () => ({
    data: {
      providers: Object.fromEntries(
        Object.entries(mocks.configQuery.data.providers).map(([providerId, provider]) => [
          providerId,
          {
            providerId,
            providerType: providerId,
            isBuiltInType: false,
            isCustom: false,
            enabled: provider.enabled,
            apiKeySet: provider.apiKeySet,
            models: provider.models,
          },
        ]),
      ),
    },
    isFetched: true,
    isSuccess: true,
  }),
  useProviderTemplates: () => ({
    data: {
      providerTemplates: mocks.configMetaQuery.data.providers.map((provider) => ({
        id: provider.name,
        providerType: provider.name,
        displayName: provider.displayName,
        modelPrefix: provider.modelPrefix,
        defaultModels: provider.defaultModels,
        keywords: provider.keywords,
        envKey: provider.envKey,
      })),
    },
    isFetched: true,
    isSuccess: true,
  }),
}));

vi.mock("@/features/chat", async () => {
  const sessionListStore = await import("@/features/chat/stores/chat-session-list.store");
  const threadStore = await import("@/features/chat/stores/chat-thread.store");
  const sessionTypeUtils = await import("@/features/chat/features/session-type/utils/chat-session-type.utils");
  return {
    ...sessionTypeUtils,
    usePresenter: () => ({
      chatSessionListManager: {
        startAgentDraftChat: (agentId: string) => {
          sessionListStore.useChatSessionListStore.getState().setSnapshot({
            selectedAgentId: agentId,
            selectedSessionKey: null,
          });
          threadStore.useChatThreadStore.getState().setSnapshot({
            sessionKey: null,
          });
        },
      },
    }),
    useChatSessionListStore: sessionListStore.useChatSessionListStore,
    useChatThreadStore: threadStore.useChatThreadStore,
    useNcpChatSessionTypes: () => mocks.sessionTypesQuery,
  };
});

function renderAgentsPage() {
  return render(
    <MemoryRouter>
      <AgentsPage />
    </MemoryRouter>,
  );
}

describe("AgentsPage", () => {
  beforeEach(() => {
    persistStorage.clear();
    useChatSessionListStore.persist.setOptions({ storage: createPersistStorage() as never });
    useChatThreadStore.persist.setOptions({ storage: createPersistStorage() as never });
    setLanguage("zh");
    mocks.createAgent.mockReset();
    mocks.updateAgent.mockReset();
    mocks.deleteAgent.mockReset();
    mocks.navigate.mockReset();
    mocks.requestDraft.mockReset();
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedAgentId: "main",
        selectedSessionKey: "session-1",
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "session-1",
      },
    });
  });

  it("renders the agents workspace in Chinese and keeps management actions in a compact menu", async () => {
    const user = userEvent.setup();

    renderAgentsPage();

    expect(screen.getByText("Agent 管理台")).toBeTruthy();
    expect(screen.getByText("~/.nextclaw/workspace")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "开始对话" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "更多操作" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "查看详情" })).toBeNull();
    expect(screen.queryByRole("button", { name: "编辑" })).toBeNull();
    expect(screen.getByText("负责调研、信息筛选与结论提炼。")).toBeTruthy();
    expect(
      screen.queryByText("专属 Agent 身份，可沉淀自己的记忆、技能与角色风格。"),
    ).toBeNull();
    expect(screen.queryByText("Agent Gallery")).toBeNull();

    await user.click(screen.getByRole("button", { name: "新增 Agent" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/chat");
    expect(mocks.requestDraft).toHaveBeenCalledWith(
      expect.stringContaining("请直接创建一个默认示例 Agent，不要问我问题"),
    );
    expect(mocks.createAgent).not.toHaveBeenCalled();
    expect(screen.queryByText("创建新的 Agent 身份")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "更多操作" })[1]);
    const detailsEditButtons = screen.getAllByRole("button", { name: "编辑" });
    await user.click(detailsEditButtons[detailsEditButtons.length - 1]);

    expect(screen.getByText("编辑 Agent 身份")).toBeTruthy();
    expect(screen.getByText("主目录保持不变")).toBeTruthy();
    expect(screen.getByDisplayValue("Researcher")).toBeTruthy();
    expect(
      screen.getByDisplayValue("负责调研、信息筛选与结论提炼。").tagName,
    ).toBe("TEXTAREA");
    expect(screen.getByDisplayValue("gpt-5.2")).toBeTruthy();
  });

  it("separates read-only details from editing and keeps advanced config collapsed until requested", async () => {
    const user = userEvent.setup();

    renderAgentsPage();

    await user.click(screen.getAllByRole("button", { name: "更多操作" })[1]);
    await user.click(screen.getByRole("button", { name: "查看详情" }));

    expect(screen.getByText("身份")).toBeTruthy();
    expect(screen.getByText("上下文窗口大小")).toBeTruthy();
    expect(screen.getByText("128,000")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "保存编辑" })).toBeNull();
    const detailsDialog = screen.getByText("身份").closest("[role='dialog']");
    expect(detailsDialog?.className).toContain("sm:max-w-2xl");
    const detailLists = Array.from(detailsDialog?.querySelectorAll("dl") ?? []);
    expect(detailLists.length).toBeGreaterThan(0);
    expect(
      detailLists.every(
        (list) =>
          !list.className.includes("divide-y") &&
          !list.className.includes("border-t"),
      ),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("section") ?? []).every(
        (section) =>
          section.className.includes("space-y-2") &&
          section.className.includes("border-t") &&
          !section.className.includes("sm:grid-cols"),
      ),
    ).toBe(true);
    expect(
      detailLists.every((list) => list.className.includes("pl-5")),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("dt") ?? []).every(
        (term) => {
          const item = term.parentElement;
          return Boolean(
            item?.className.includes("grid-cols-[10rem_minmax(0,1fr)]") &&
              !item.className.includes("space-y"),
          );
        },
      ),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("dt span") ?? []).every(
        (label) => !label.className.includes("truncate"),
      ),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("dt") ?? []).every(
        (term) =>
          !term.textContent?.includes("继承默认") &&
          !term.textContent?.includes("Agent 覆盖"),
      ),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("dd") ?? []).some((value) =>
        value.textContent?.includes("128,000（Agent 覆盖）"),
      ),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("dd") ?? []).some((value) =>
        value.textContent?.includes("未设置（继承默认）"),
      ),
    ).toBe(true);
    expect(
      Array.from(detailsDialog?.querySelectorAll("dt span, dd") ?? []).every(
        (node) => node.className.includes("text-xs"),
      ),
    ).toBe(true);
    expect(detailsDialog?.querySelector(".rounded-xl.bg-white.p-3")).toBeNull();

    await user.click(screen.getByRole("button", { name: "编辑" }));

    expect(screen.getByText("编辑 Agent 身份")).toBeTruthy();
    const advancedDetails = screen.getByText("高级配置").closest("details");
    expect(advancedDetails?.hasAttribute("open")).toBe(false);

    await user.click(screen.getByText("高级配置"));
    expect(advancedDetails?.hasAttribute("open")).toBe(true);
    expect(screen.queryByLabelText("预留上下文大小")).toBeNull();
    expect(screen.queryByLabelText("最大工具迭代次数")).toBeNull();
    expect(screen.queryByLabelText("默认思考强度")).toBeNull();
    expect(screen.queryByLabelText("Runtime 配置 JSON")).toBeNull();
    expect(screen.queryByLabelText("模型覆盖 JSON")).toBeNull();

    fireEvent.change(screen.getByLabelText("上下文窗口大小"), {
      target: { value: "64000" },
    });
    await user.click(screen.getByRole("button", { name: "保存编辑" }));

    expect(mocks.updateAgent).toHaveBeenCalledWith({
      agentId: "researcher",
      data: expect.objectContaining({
        contextTokens: 64000,
      }),
    });
    expect(mocks.updateAgent.mock.calls[0][0].data).not.toHaveProperty(
      "reservedContextTokens",
    );
    expect(mocks.updateAgent.mock.calls[0][0].data).not.toHaveProperty(
      "maxToolIterations",
    );
    expect(mocks.updateAgent.mock.calls[0][0].data).not.toHaveProperty(
      "thinkingDefault",
    );
    expect(mocks.updateAgent.mock.calls[0][0].data).not.toHaveProperty(
      "runtimeConfig",
    );
    expect(mocks.updateAgent.mock.calls[0][0].data).not.toHaveProperty(
      "models",
    );
  });

  it("uses a runtime dropdown instead of manual text input when editing an agent", async () => {
    const user = userEvent.setup();

    renderAgentsPage();

    await user.click(screen.getAllByRole("button", { name: "更多操作" })[1]);
    await user.click(screen.getByRole("button", { name: "编辑" }));

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
        contextTokens: 128000,
      },
    });
  });

  it("starts a draft chat with the agent selected through the session list owner", async () => {
    const user = userEvent.setup();

    renderAgentsPage();

    await user.click(screen.getAllByRole("button", { name: "开始对话" })[1]);

    const sessionListSnapshot = useChatSessionListStore.getState().snapshot;
    expect(useChatSessionListStore.getState().snapshot.selectedAgentId).toBe(
      "researcher",
    );
    expect(sessionListSnapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
  });
});
