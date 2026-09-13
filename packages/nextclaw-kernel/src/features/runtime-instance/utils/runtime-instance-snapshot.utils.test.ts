import { describe, expect, it } from "vitest";
import {
  RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DISTRIBUTION_ENV,
  RUNTIME_INSTANCE_INSTALLATION_KIND_ENV,
  RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV,
  resolveRuntimeInstanceSnapshot,
} from "./runtime-instance-snapshot.utils.js";

const paths = {
  configPath: "/portable/data/runtime-home/config.json",
  runtimeHome: "/portable/data/runtime-home",
  runtimeLogsDirectory: "/portable/data/runtime-home/logs",
  workspacePath: "/portable/data/runtime-home/workspace",
};

describe("resolveRuntimeInstanceSnapshot", () => {
  it("projects explicit portable Desktop context without path inference", () => {
    expect(resolveRuntimeInstanceSnapshot({
      ...paths,
      env: {
        [RUNTIME_INSTANCE_DISTRIBUTION_ENV]: "desktop",
        [RUNTIME_INSTANCE_INSTALLATION_KIND_ENV]: "portable",
        [RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV]: "/portable/data",
        [RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV]: "/portable/data/desktop",
        [RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV]: "/portable/data/logs",
      },
    })).toEqual({
      distribution: "desktop",
      installationKind: "portable",
      storage: {
        portableDataRoot: "/portable/data",
        runtimeHome: "/portable/data/runtime-home",
        desktopDataDirectory: "/portable/data/desktop",
        desktopLogsDirectory: "/portable/data/logs",
        runtimeLogsDirectory: "/portable/data/runtime-home/logs",
        configPath: "/portable/data/runtime-home/config.json",
        workspacePath: "/portable/data/runtime-home/workspace",
      },
    });
  });

  it("projects installed Desktop context without a portable data root", () => {
    const snapshot = resolveRuntimeInstanceSnapshot({
      ...paths,
      env: {
        [RUNTIME_INSTANCE_DISTRIBUTION_ENV]: "desktop",
        [RUNTIME_INSTANCE_INSTALLATION_KIND_ENV]: "installed",
        [RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV]: "/desktop/data",
        [RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV]: "/desktop/logs",
      },
    });

    expect(snapshot).toMatchObject({
      distribution: "desktop",
      installationKind: "installed",
      storage: {
        portableDataRoot: null,
        desktopDataDirectory: "/desktop/data",
        desktopLogsDirectory: "/desktop/logs",
      },
    });
  });

  it("keeps ordinary CLI Desktop-only facts unknown", () => {
    expect(resolveRuntimeInstanceSnapshot({ ...paths, env: {} })).toMatchObject({
      distribution: "cli",
      installationKind: null,
      storage: {
        portableDataRoot: null,
        desktopDataDirectory: null,
        desktopLogsDirectory: null,
      },
    });
  });

  it("rejects invalid enum values and ignores orphaned Desktop paths", () => {
    expect(resolveRuntimeInstanceSnapshot({
      ...paths,
      env: {
        [RUNTIME_INSTANCE_DISTRIBUTION_ENV]: "browser",
        [RUNTIME_INSTANCE_INSTALLATION_KIND_ENV]: "portable-ish",
        [RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV]: "/wrong/data",
        [RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV]: "/wrong/desktop",
      },
    })).toMatchObject({
      distribution: "unknown",
      installationKind: null,
      storage: {
        portableDataRoot: null,
        desktopDataDirectory: null,
      },
    });
  });
});
