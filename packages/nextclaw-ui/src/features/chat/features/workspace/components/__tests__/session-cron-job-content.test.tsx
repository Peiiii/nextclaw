import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CronJobView } from "@/shared/lib/api";
import { setLanguage } from "@/shared/lib/i18n";
import { SessionCronJobContent } from "@/features/chat/features/workspace/components/session-cron-job-content";

const mocks = vi.hoisted(() => ({
  deleteJob: vi.fn(),
  runJob: vi.fn(),
  toggleJob: vi.fn(),
}));

vi.mock("@/features/cron", () => ({
  CronJobDetailDialog: ({ job, open }: { job: CronJobView | null; open: boolean }) => (
    open ? createElement("div", { role: "dialog" }, job?.payload.message) : null
  ),
  useCronJobActions: () => ({
    ConfirmDialog: () => createElement("div", { "data-testid": "cron-confirm" }),
    deleteJob: mocks.deleteJob,
    isPending: () => false,
    runJob: mocks.runJob,
    toggleJob: mocks.toggleJob,
  }),
}));

function createJob(): CronJobView {
  return {
    id: "paint-daily",
    name: "每日绘画",
    enabled: true,
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "Asia/Shanghai" },
    payload: {
      kind: "agent_turn",
      message: "请生成一幅拥有柔和晨光、细腻建筑纹理和远处山景的城市水彩画，并将结果保存到项目图库。",
      agentId: "main",
      sessionId: "session:paint",
    },
    state: {
      nextRunAt: "2026-08-27T01:00:00.000Z",
      lastRunAt: "2026-08-26T01:00:00.000Z",
      lastStatus: "ok",
      lastError: null,
    },
    createdAt: "2026-08-26T01:00:00.000Z",
    updatedAt: "2026-08-26T01:00:00.000Z",
    deleteAfterRun: false,
  };
}

describe("SessionCronJobContent", () => {
  beforeEach(() => {
    setLanguage("zh");
    vi.clearAllMocks();
  });

  it("keeps the task prompt as a two-line summary and exposes task controls", async () => {
    const user = userEvent.setup();
    const job = createJob();
    render(createElement(SessionCronJobContent, { jobs: [job] }));

    const summary = screen.getByText(job.payload.message);
    expect(summary.className.split(" ")).toContain("line-clamp-2");
    expect(screen.getAllByTestId("cron-confirm").length).toBe(1);

    await user.click(screen.getByRole("switch", { name: "暂停" }));
    expect(mocks.toggleJob).toHaveBeenCalledWith(job, false);

    await user.click(screen.getByRole("button", { name: "更多操作 每日绘画" }));
    await user.click(screen.getByRole("button", { name: "立即执行" }));
    expect(mocks.runJob).toHaveBeenCalledWith(job);

    await user.click(screen.getByRole("button", { name: "查看任务详情" }));
    expect(screen.getByRole("dialog").textContent).toContain(job.payload.message);
  });
});
