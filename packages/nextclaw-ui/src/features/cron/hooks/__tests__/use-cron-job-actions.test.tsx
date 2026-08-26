import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CronJobView } from "@/shared/lib/api";
import { setLanguage } from "@/shared/lib/i18n";
import { useCronJobActions } from "@/features/cron/hooks/use-cron-job-actions";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  deleteJob: vi.fn(),
  runJob: vi.fn(),
  toggleJob: vi.fn(),
}));

vi.mock("@/features/cron/hooks/use-cron-jobs", () => ({
  useDeleteCronJob: () => ({ mutateAsync: mocks.deleteJob }),
  useRunCronJob: () => ({ mutateAsync: mocks.runJob }),
  useToggleCronJob: () => ({ mutateAsync: mocks.toggleJob }),
}));

vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => null,
  }),
}));

function createJob(overrides: Partial<CronJobView> = {}): CronJobView {
  return {
    id: "paint-daily",
    name: "每日绘画",
    enabled: true,
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "Asia/Shanghai" },
    payload: {
      kind: "agent_turn",
      message: "生成一张今日绘画。",
      agentId: "main",
      sessionId: "session:paint",
    },
    state: {
      nextRunAt: "2026-08-27T01:00:00.000Z",
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
    },
    createdAt: "2026-08-26T01:00:00.000Z",
    updatedAt: "2026-08-26T01:00:00.000Z",
    deleteAfterRun: false,
    ...overrides,
  };
}

describe("useCronJobActions", () => {
  beforeEach(() => {
    setLanguage("zh");
    vi.clearAllMocks();
    mocks.confirm.mockResolvedValue(true);
    mocks.deleteJob.mockResolvedValue({ deleted: true });
    mocks.runJob.mockResolvedValue({ job: createJob(), executed: true });
    mocks.toggleJob.mockResolvedValue({ job: createJob() });
  });

  it("requires confirmation and forces a paused task to run without enabling it", async () => {
    const { result } = renderHook(() => useCronJobActions());
    const job = createJob({ enabled: false });

    await act(async () => {
      await result.current.runJob(job);
    });

    expect(mocks.confirm).toHaveBeenCalledWith({
      title: "任务已暂停，仍要立即执行?",
      description: "每日绘画 (paint-daily)",
      confirmLabel: "立即执行",
    });
    expect(mocks.runJob).toHaveBeenCalledWith({ id: "paint-daily", force: true });
    expect(mocks.toggleJob).not.toHaveBeenCalled();
  });

  it("uses a destructive confirmation before deleting", async () => {
    const { result } = renderHook(() => useCronJobActions());

    await act(async () => {
      await result.current.deleteJob(createJob());
    });

    expect(mocks.confirm).toHaveBeenCalledWith({
      title: "确认删除定时任务?",
      description: "每日绘画 (paint-daily)",
      confirmLabel: "删除",
      variant: "destructive",
    });
    expect(mocks.deleteJob).toHaveBeenCalledWith({ id: "paint-daily" });
  });
});
