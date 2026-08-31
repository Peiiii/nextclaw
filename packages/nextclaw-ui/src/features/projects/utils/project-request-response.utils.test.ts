import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextclawClient } from "@/shared/lib/api";
import { sendProjectRequestResponse } from "./project-request-response.utils";

vi.mock("@/shared/lib/api", () => ({
  nextclawClient: { agentRuns: { send: vi.fn() } },
}));

describe("sendProjectRequestResponse", () => {
  beforeEach(() => vi.mocked(nextclawClient.agentRuns.send).mockReset());

  it("sends a stable, traceable reply through the existing agent-run ingress", async () => {
    vi.mocked(nextclawClient.agentRuns.send).mockResolvedValue({
      delivery: "queued",
      runId: null,
      sessionId: "session-1",
      userMessageId: "project-response-approve-release-confirmed",
      assistantMessageId: null,
    });

    await sendProjectRequestResponse({
      requestId: "approve-release",
      sessionId: "session-1",
      decision: "confirmed",
      prompt: "继续发布 v1",
    });

    expect(nextclawClient.agentRuns.send).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1",
      idempotencyKey: "project-response-approve-release-confirmed",
      delivery: "prefer-steer",
      message: expect.objectContaining({
        id: "project-response-approve-release-confirmed",
        metadata: {
          project_observation_response: {
            protocol: "nextclaw.project/v1",
            requestId: "approve-release",
            decision: "confirmed",
          },
        },
      }),
    }));
  });
});
