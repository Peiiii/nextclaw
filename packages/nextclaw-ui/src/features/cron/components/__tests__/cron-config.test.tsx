import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CronJobView } from "@/shared/lib/api";
import { setLanguage } from "@/shared/lib/i18n";
import { buildSessionPath } from "@/features/chat";
import { CronConfig } from "@/features/cron";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(async () => true),
  createSession: vi.fn(),
  deleteJob: vi.fn(),
  refetch: vi.fn(),
  runJob: vi.fn(),
  toggleJob: vi.fn(),
  cronParams: vi.fn(),
  cronQuery: {
    data: {
      jobs: [] as CronJobView[],
      total: 0,
      summary: { total: 0, enabled: 0, disabled: 0, attention: 0 },
    },
    isFetching: false,
    isLoading: false,
  },
}));

vi.mock("@/features/chat", async () => {
  const routeUtils = await vi.importActual<{
    buildSessionPath: typeof buildSessionPath;
  }>("@/features/chat/features/session/utils/chat-session-route.utils");

  return {
    buildSessionPath: routeUtils.buildSessionPath,
    usePresenter: () => ({
      chatSessionListManager: {
        createSession: mocks.createSession,
      },
    }),
  };
});

vi.mock("@/features/cron/hooks/use-cron-jobs", () => ({
  useCronJobs: (params: unknown) => {
    mocks.cronParams(params);
    return { ...mocks.cronQuery, refetch: mocks.refetch };
  },
  useDeleteCronJob: () => ({ mutate: mocks.deleteJob }),
  useRunCronJob: () => ({ mutate: mocks.runJob }),
  useToggleCronJob: () => ({ mutate: mocks.toggleJob }),
}));

vi.mock("@/features/cron/hooks/use-cron-job-actions", () => ({
  useCronJobActions: () => ({
    ConfirmDialog: () => null,
    deleteJob: mocks.deleteJob,
    isPending: () => false,
    runJob: mocks.runJob,
    toggleJob: mocks.toggleJob,
  }),
}));

vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => null,
  }),
}));

function createJob(overrides: Partial<CronJobView> = {}): CronJobView {
  return {
    id: "agent-radar",
    name: "Agent 产品雷达",
    enabled: true,
    schedule: { kind: "cron", expr: "0 9 * * 2,5", tz: "Asia/Shanghai" },
    payload: {
      kind: "agent_turn",
      message: "收集本周 Agent 产品的重要更新。",
      agentId: "researcher",
      sessionId: "session:research",
    },
    state: {
      nextRunAt: "2026-07-21T01:00:00.000Z",
      lastRunAt: "2026-07-18T01:00:00.000Z",
      lastStatus: "ok",
      lastError: null,
    },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-18T01:00:00.000Z",
    deleteAfterRun: false,
    ...overrides,
  };
}

function renderCronConfig() {
  return render(
    <MemoryRouter>
      <CronConfig />
    </MemoryRouter>,
  );
}

describe("CronConfig", () => {
  beforeEach(() => {
    setLanguage("zh");
    mocks.cronQuery.data = {
      jobs: [
        createJob(),
        createJob({
          id: "mail-watch",
          name: "重要邮件监控",
          enabled: false,
          payload: {
            kind: "agent_turn",
            message: "检查需要处理的重要邮件。",
            agentId: "main",
            sessionId: null,
          },
          state: {
            nextRunAt: null,
            lastRunAt: "2026-07-18T00:00:00.000Z",
            lastStatus: "error",
            lastError: "邮箱需要重新授权",
          },
        }),
      ],
      total: 2,
      summary: { total: 2, enabled: 1, disabled: 1, attention: 1 },
    };
    mocks.cronQuery.isFetching = false;
    mocks.cronQuery.isLoading = false;
    vi.clearAllMocks();
  });

  it("shows current task metrics and distinguishes bound and dedicated sessions", () => {
    renderCronConfig();

    expect(
      screen.getByRole("heading", { level: 1, name: "定时任务" }),
    ).toBeTruthy();
    expect(screen.queryByText("自动化工作台")).toBeNull();
    expect(screen.getByText("全部任务")).toBeTruthy();
    expect(screen.getAllByText("运行中").length).toBeGreaterThan(0);
    expect(screen.getAllByText("需要关注").length).toBeGreaterThan(0);
    expect(screen.getByText("绑定会话")).toBeTruthy();
    expect(screen.getByText("独立会话")).toBeTruthy();
    expect(screen.getByText("1 项需要处理")).toBeTruthy();
    expect(screen.getByText("重要邮件监控")).toBeTruthy();
  });

  it("keeps one inline task preview open at a time", async () => {
    const user = userEvent.setup();
    renderCronConfig();

    const agentPreview = document.getElementById(
      "cron-job-preview-agent-radar",
    );
    expect(agentPreview?.getAttribute("aria-hidden")).toBe("true");

    await user.click(
      screen.getByRole("button", { name: "展开任务 Agent 产品雷达" }),
    );
    expect(agentPreview?.getAttribute("aria-hidden")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "收起任务 Agent 产品雷达" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "展开任务 重要邮件监控" }),
    );
    expect(agentPreview?.getAttribute("aria-hidden")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "收起任务 重要邮件监控" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("links available execution sessions from inline task previews", async () => {
    const user = userEvent.setup();
    renderCronConfig();

    await user.click(
      screen.getByRole("button", { name: "展开任务 Agent 产品雷达" }),
    );
    const sessionLink = screen.getByRole("link", {
      name: "session:research",
    });
    expect(sessionLink.getAttribute("href")).toBe(
      buildSessionPath("session:research"),
    );
    expect(sessionLink.className).toContain(
      "text-[hsl(var(--link-foreground))]",
    );
    expect(sessionLink.className.split(" ")).toContain("underline");
    expect(sessionLink.querySelector("svg")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "展开任务 重要邮件监控" }),
    );
    expect(
      screen.getByRole("link", { name: "cron:mail-watch" }).getAttribute("href"),
    ).toBe(buildSessionPath("cron:mail-watch"));
  });

  it("keeps a dedicated execution session unavailable before its first run", async () => {
    mocks.cronQuery.data = {
      jobs: [
        createJob({
          id: "not-run",
          name: "尚未执行的任务",
          payload: {
            kind: "agent_turn",
            message: "等待第一次执行。",
            agentId: "main",
            sessionId: null,
          },
          state: {
            nextRunAt: "2026-07-21T01:00:00.000Z",
            lastRunAt: null,
            lastStatus: null,
            lastError: null,
          },
        }),
      ],
      total: 1,
      summary: { total: 1, enabled: 1, disabled: 0, attention: 0 },
    };
    const user = userEvent.setup();
    renderCronConfig();

    await user.click(
      screen.getByRole("button", { name: "展开任务 尚未执行的任务" }),
    );

    expect(screen.getByText("cron:not-run")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "cron:not-run" })).toBeNull();
  });

  it("hands a typed request to a new AI draft conversation", async () => {
    const user = userEvent.setup();
    renderCronConfig();

    const input = screen.getByLabelText("描述你想安排的任务");
    await user.type(input, "每天早上整理项目风险{Enter}");

    expect(mocks.createSession).toHaveBeenCalledWith({
      prompt: "每天早上整理项目风险",
    });
  });

  it("fills and focuses the composer when an empty-state template is selected", async () => {
    mocks.cronQuery.data = {
      jobs: [],
      total: 0,
      summary: { total: 0, enabled: 0, disabled: 0, attention: 0 },
    };
    const user = userEvent.setup();
    renderCronConfig();

    await user.click(screen.getByRole("button", { name: /每日 AI 新闻简报/ }));

    const input = screen.getByLabelText("描述你想安排的任务");
    expect((input as HTMLInputElement).value).toBe(
      "每天早上 8 点汇总过去 24 小时最重要的 AI 产品和研究进展，并附上原始来源。",
    );
    expect(document.activeElement).toBe(input);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("exposes the bound session destination from task details", async () => {
    const user = userEvent.setup();
    renderCronConfig();

    await user.click(
      screen.getByRole("button", { name: "查看任务详情 Agent 产品雷达" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("当前系统只保存最近一次执行快照。")).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "打开会话" }).getAttribute("href"),
    ).toBe(buildSessionPath("session:research"));
  });

  it("keeps enablement as an independent row action", async () => {
    const user = userEvent.setup();
    renderCronConfig();

    await user.click(screen.getAllByRole("switch")[0]);
    expect(mocks.toggleJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: "agent-radar" }),
      false,
      expect.any(Function),
    );
    expect(
      screen
        .getByRole("button", { name: "展开任务 Agent 产品雷达" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("requests server pages and resets pagination when the status changes", async () => {
    mocks.cronQuery.data = {
      jobs: Array.from({ length: 10 }, (_, index) =>
        createJob({
          id: `task-${index + 1}`,
          name: `任务 ${index + 1}`,
        }),
      ),
      total: 12,
      summary: { total: 12, enabled: 10, disabled: 2, attention: 1 },
    };
    const user = userEvent.setup();
    renderCronConfig();

    expect(screen.getByText("1–10 / 12")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "展开任务 任务 1" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      expect(mocks.cronParams).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10,
          status: "all",
        }),
      );
    });
    expect(
      screen
        .getByRole("button", { name: "展开任务 任务 1" })
        .getAttribute("aria-expanded"),
    ).toBe("false");

    await user.click(screen.getByRole("button", { name: "已暂停" }));
    await waitFor(() => {
      expect(mocks.cronParams).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          status: "disabled",
        }),
      );
    });
  });
});
