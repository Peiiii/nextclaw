import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NcpEventType } from "@nextclaw/ncp";
import { eventKeys, type ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { EventBus } from "@nextclaw/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextclawClient } from "@/shared/lib/api";
import { useProjectObservation } from "./use-project-observation";

const mocks = vi.hoisted(() => ({ getObservation: vi.fn() }));

vi.mock("@/shared/lib/api", () => ({
  nextclawClient: {
    eventBus: new EventBus(),
    projects: { getObservation: mocks.getObservation },
  },
}));

const observedAt = "2026-08-31T00:00:00.000Z";
const snapshot: ProjectObservationSnapshot = {
  asOf: observedAt,
  project: { name: "Demo", rootPath: "/tmp/demo", context: [] },
  sources: [],
  workflows: [],
  runs: [{
    sessionId: "session-1",
    state: "running",
    updatedAt: observedAt,
    reference: {
      kind: "system-record",
      label: "Session run",
      observedAt,
      sessionId: "session-1",
    },
  }],
  workItems: [],
  artifactCategories: [],
  artifacts: [],
  signals: [],
  requests: [],
  activity: [],
  skills: [],
  diagnostics: [],
  dataQuality: "complete",
};

afterEach(() => {
  vi.useRealTimers();
  mocks.getObservation.mockReset();
});

describe("useProjectObservation", () => {
  it("refreshes only for the active project's session lifecycle", async () => {
    mocks.getObservation.mockResolvedValue(snapshot);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useProjectObservation("project-1", "/tmp/demo"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual(snapshot));

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionSummaryUpsert, {
        summary: {
          sessionId: "other-session",
          messageCount: 0,
          updatedAt: observedAt,
          metadata: { project_root: "/tmp/other" },
        },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mocks.getObservation).toHaveBeenCalledTimes(1);

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.ncpEvent, {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId: "session-1",
          messageId: "assistant-1",
          delta: '[nextclaw.project/v1 id=wi_7km4q2x9dn name="Live work" stage=exploration]',
        },
      });
    });
    await waitFor(() => expect(mocks.getObservation).toHaveBeenCalledTimes(2));
  });
});
