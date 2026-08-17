import { describe, expect, it } from "vitest";
import { AppServiceLaunchService } from "./app-service-launch.service.js";

describe("AppServiceLaunchService", () => {
  it("selects one launch from a multi-target Service App declaration", () => {
    const launch = new AppServiceLaunchService().resolve({
      launch: {
        targets: [
          {
            target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
            command: "./bin/linux/service",
            args: ["--stdio"],
          },
          {
            target: { kind: "native", os: "darwin", arch: "arm64" },
            command: "./bin/darwin/service",
          },
        ],
      },
    }, { kind: "native", os: "darwin", arch: "arm64" });

    expect(launch).toEqual({ command: "./bin/darwin/service", args: [] });
  });

  it("rejects an artifact target without a matching Service App launch", () => {
    expect(() => new AppServiceLaunchService().resolve({
      launch: {
        targets: [{
          target: { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
          command: "./service",
        }],
      },
    }, { kind: "native", os: "darwin", arch: "arm64" }))
      .toThrow("service app 不支持当前 target：darwin-arm64");
  });
});
