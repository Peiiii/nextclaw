import { describe, expect, it } from "vitest";
import {
  createProjectObservationMarkerParseState,
  parseProjectObservationMarkers,
  readProjectObservationResponseMetadata,
} from "@kernel/features/projects/utils/project-observation-marker.utils.js";

const source = {
  sessionId: "session-1",
  messageId: "message-1",
  timestamp: "2026-08-30T10:00:00.000Z",
};

describe("project observation markers", () => {
  it("parses every V1 marker kind with strict field order", () => {
    const result = parseProjectObservationMarkers({
      ...source,
      text: [
        '[nextclaw.project/v1 kind=work-item id=novel-draft title="Complete the first draft" workflow=writing stage=draft status=active]',
        '[nextclaw.project/v1 kind=artifact item=novel-draft path="drafts/chapter-1.md" category=drafts]',
        '[nextclaw.project/v1 kind=schedule item=novel-draft start=2026-08-30 end=2026-09-02 milestone=false depends-on=research]',
        '[nextclaw.project/v1 kind=signal id=plot-risk item=novel-draft status=open level=attention message="The middle act needs a decision"]',
        '[nextclaw.project/v1 kind=request id=approve-outline item=novel-draft status=open response=confirm-reject prompt="Approve the revised outline"]',
      ].join("\n"),
    });

    expect(result.issues).toEqual([]);
    expect(result.markers.map((marker) => marker.kind)).toEqual([
      "work-item", "artifact", "schedule", "signal", "request",
    ]);
    expect(result.markers[0]).toMatchObject({
      workflowId: "writing",
      stageId: "draft",
      status: "active",
    });
  });

  it("accepts explicit none values and diagnoses malformed markers", () => {
    const result = parseProjectObservationMarkers({
      ...source,
      text: [
        '[nextclaw.project/v1 kind=work-item id=research title="Research" workflow=none stage=none status=active]',
        '[nextclaw.project/v1 kind=work-item id=broken status=active]',
      ].join("\n"),
    });

    expect(result.markers[0]).toMatchObject({ id: "research" });
    expect(result.markers[0]).not.toHaveProperty("workflowId");
    expect(result.issues).toHaveLength(1);
  });

  it("folds compact stage events with project-wide work identity and session-local cursors", () => {
    const state = createProjectObservationMarkerParseState();
    const started = parseProjectObservationMarkers({
      ...source,
      state,
      text: '[nextclaw.project/v1 id=wi_7km4q2x9dn name="Implement live tracking" stage=exploration]',
    });
    const advanced = parseProjectObservationMarkers({
      ...source,
      messageId: "message-2",
      state,
      text: [
        "[nextclaw.project/v1 stage=design]",
        '[nextclaw.project/v1 artifact path="docs/designs/live.design.md" category=designs]',
        '[nextclaw.project/v1 request=req_8cq6v3m7xk response=confirm-reject prompt="Accept the result?"]',
      ].join("\n"),
    });

    expect(started.issues).toEqual([]);
    expect(started.markers[0]).toMatchObject({
      id: "wi_7km4q2x9dn",
      name: "Implement live tracking",
      stageId: "exploration",
      status: "active",
    });
    expect(advanced.issues).toEqual([]);
    expect(advanced.markers).toEqual([
      expect.objectContaining({
        kind: "work-item",
        id: "wi_7km4q2x9dn",
        name: "Implement live tracking",
        stageId: "design",
        status: "active",
      }),
      expect.objectContaining({ kind: "artifact", itemId: "wi_7km4q2x9dn" }),
      expect.objectContaining({ kind: "request", id: "req_8cq6v3m7xk", itemId: "wi_7km4q2x9dn" }),
    ]);
  });

  it("allows an existing work item to move across sessions only when its id is explicit", () => {
    const state = createProjectObservationMarkerParseState();
    parseProjectObservationMarkers({
      ...source,
      state,
      text: '[nextclaw.project/v1 id=wi_7km4q2x9dn name="Shared work" stage=execution]',
    });
    const missingCursor = parseProjectObservationMarkers({
      ...source,
      sessionId: "session-2",
      messageId: "message-2",
      state,
      text: "[nextclaw.project/v1 stage=verification]",
    });
    const explicitSwitch = parseProjectObservationMarkers({
      ...source,
      sessionId: "session-2",
      messageId: "message-3",
      state,
      text: "[nextclaw.project/v1 id=wi_7km4q2x9dn stage=verification]",
    });

    expect(missingCursor.markers).toEqual([]);
    expect(missingCursor.issues).toHaveLength(1);
    expect(explicitSwitch.issues).toEqual([]);
    expect(explicitSwitch.markers[0]).toMatchObject({
      id: "wi_7km4q2x9dn",
      name: "Shared work",
      stageId: "verification",
    });
  });

  it("does not diagnose an incomplete streaming marker before the message stabilizes", () => {
    const streaming = parseProjectObservationMarkers({
      ...source,
      reportInvalid: false,
      text: '[nextclaw.project/v1 id=wi_7km4q2x9dn name="Incomplete',
    });
    expect(streaming).toEqual({ markers: [], issues: [] });
  });

  it("ignores marker examples inside fenced code blocks", () => {
    const result = parseProjectObservationMarkers({
      ...source,
      text: [
        "Here is the project Skill template:",
        "```text",
        '[nextclaw.project/v1 id=<work-item-id> name="<work-item-name>" stage=<stage-id>]',
        "```",
        '[nextclaw.project/v1 id=wi_7km4q2x9dn name="Real work" stage=exploration]',
      ].join("\n"),
    });

    expect(result.issues).toEqual([]);
    expect(result.markers).toEqual([
      expect.objectContaining({ id: "wi_7km4q2x9dn", name: "Real work" }),
    ]);
  });

  it("reads only the stable response metadata contract", () => {
    expect(readProjectObservationResponseMetadata({
      project_observation_response: {
        protocol: "nextclaw.project/v1",
        requestId: "approve-outline",
        decision: "confirmed",
      },
    })).toEqual({
      protocol: "nextclaw.project/v1",
      requestId: "approve-outline",
      decision: "confirmed",
    });
    expect(readProjectObservationResponseMetadata({
      project_observation_response: { requestId: "approve-outline" },
    })).toBeNull();
  });
});
