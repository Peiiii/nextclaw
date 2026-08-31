import { describe, expect, it } from "vitest";
import type { ObservedRequest, ObservedWorkItem, ObservedWorkflow } from "@nextclaw/client-sdk";
import {
  canReplyToProjectRequest,
  createProjectBoardColumns,
  getScheduledWorkItems,
  isProjectHomeTab,
} from "./project-home.presenter";

const reference = {
  kind: "ai-report" as const,
  label: "AI report",
  observedAt: "2026-08-30T00:00:00.000Z",
};

describe("project home presenter", () => {
  it("accepts only the project home tabs represented in the route", () => {
    expect(isProjectHomeTab("overview")).toBe(true);
    expect(isProjectHomeTab("agreement")).toBe(true);
    expect(isProjectHomeTab("missing")).toBe(false);
    expect(isProjectHomeTab(undefined)).toBe(false);
  });

  it("projects the same work items into board and scheduled views without inventing facts", () => {
    const workflows: ObservedWorkflow[] = [{
      id: "research",
      label: "Research",
      stages: [{ id: "draft", label: "Draft" }],
      reference,
    }];
    const workItems: ObservedWorkItem[] = [
      {
        id: "with-schedule",
        name: "Scheduled",
        status: "active",
        workflowId: "research",
        stageId: "draft",
        schedule: { start: "2026-08-30", end: "2026-09-02", milestone: false, dependsOn: [] },
        updatedAt: reference.observedAt,
        reference,
      },
      {
        id: "without-schedule",
        name: "Unscheduled",
        status: "blocked",
        updatedAt: reference.observedAt,
        reference,
      },
    ];

    expect(createProjectBoardColumns(workflows, workItems)[0]?.items.map((item) => item.id))
      .toEqual(["with-schedule"]);
    expect(getScheduledWorkItems(workItems).map((item) => item.id))
      .toEqual(["with-schedule"]);
  });

  it("offers direct replies only for open confirm-reject requests with a source session", () => {
    const request: ObservedRequest = {
      id: "approval",
      status: "open",
      response: "confirm-reject",
      prompt: "Ship?",
      updatedAt: reference.observedAt,
      reference: { ...reference, sessionId: "session-1" },
    };
    expect(canReplyToProjectRequest(request)).toBe(true);
    expect(canReplyToProjectRequest({ ...request, reply: {
      decision: "confirmed",
      sentAt: reference.observedAt,
      messageId: "response-1",
    } })).toBe(false);
    expect(canReplyToProjectRequest({ ...request, reference })).toBe(false);
  });
});
