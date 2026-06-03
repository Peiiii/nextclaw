import { describe, expect, it } from "vitest";
import type {
  ServiceAction,
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import { mergeServiceAppRuntimeActions } from "./service-app-runtime-action.utils.js";

const record: ServiceAppRecord = {
  id: "notes",
  title: "Notes",
  dirPath: "/workspace/service-apps/notes",
  manifestPath: "/workspace/service-apps/notes/service-app.json",
  command: "node",
  args: ["server.mjs"],
  cwd: "/workspace/service-apps/notes",
  enabled: true,
  protocol: "mcp",
  status: "running",
};

const manifest: ServiceAppManifest = {
  id: "notes",
  title: "Notes",
  enabled: true,
  protocol: "mcp",
  command: "node",
  args: ["server.mjs"],
  actions: {
    read: { risk: "read", description: "Manifest read" },
    write: { risk: "write" },
  },
};

describe("mergeServiceAppRuntimeActions", () => {
  it("marks matched, missing, and undeclared runtime actions", () => {
    const runtimeActions: ServiceAction[] = [
      {
        id: "notes.read",
        appId: "notes",
        name: "read",
        description: "Runtime read",
        inputSchema: { type: "object" },
        risk: "read",
      },
      {
        id: "notes.extra",
        appId: "notes",
        name: "extra",
        risk: "dangerous",
      },
    ];

    expect(mergeServiceAppRuntimeActions({
      record,
      manifest,
      runtimeActions,
    })).toEqual([
      expect.objectContaining({
        id: "notes.extra",
        runtimeState: "undeclared",
        risk: "dangerous",
      }),
      expect.objectContaining({
        id: "notes.read",
        description: "Runtime read",
        inputSchema: { type: "object" },
        runtimeState: "matched",
      }),
      expect.objectContaining({
        id: "notes.write",
        runtimeState: "missing",
        risk: "write",
      }),
    ]);
  });
});
