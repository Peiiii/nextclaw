import { describe, expect, it } from "vitest";
import { AppPlatformTargetService } from "./app-platform-target.service.js";

describe("AppPlatformTargetService", () => {
  it("parses targets without eagerly reading the Node host environment", () => {
    const originalProcess = globalThis.process;
    Reflect.deleteProperty(globalThis, "process");
    try {
      const service = new AppPlatformTargetService();
      expect(service.parseTargetKey("darwin-arm64")).toEqual({
        kind: "native",
        os: "darwin",
        arch: "arm64",
      });
      expect(() => service.readHostTarget()).toThrow("无法自动检测宿主平台");
    } finally {
      globalThis.process = originalProcess;
    }
  });

  it("accepts a single declared target and preserves its canonical key", () => {
    const service = new AppPlatformTargetService();
    const distribution = service.parseDistribution({
      mode: "targeted",
      targets: [
        { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
      ],
    });

    expect(distribution).toEqual({
      mode: "targeted",
      targets: [
        { kind: "native", os: "linux", arch: "x64", abi: "gnu" },
      ],
    });
    if (!distribution || distribution.mode !== "targeted") {
      throw new Error("Expected targeted distribution.");
    }
    expect(distribution.targets.map(service.toTargetKey)).toEqual(["linux-x64-gnu"]);
  });

  it("accepts multiple targets without requiring a fixed platform matrix", () => {
    const distribution = new AppPlatformTargetService().parseDistribution({
      mode: "targeted",
      targets: [
        { kind: "native", os: "darwin", arch: "arm64" },
        { kind: "native", os: "win32", arch: "x64", abi: "msvc" },
      ],
    });

    expect(distribution).toEqual({
      mode: "targeted",
      targets: [
        { kind: "native", os: "darwin", arch: "arm64" },
        { kind: "native", os: "win32", arch: "x64", abi: "msvc" },
      ],
    });
  });

  it("rejects duplicate and ambiguous Linux targets", () => {
    const service = new AppPlatformTargetService();
    expect(() => service.parseDistribution({
      mode: "targeted",
      targets: [
        { kind: "native", os: "darwin", arch: "arm64" },
        { kind: "native", os: "darwin", arch: "arm64" },
      ],
    })).toThrow("重复 target");
    expect(() => service.parseDistribution({
      mode: "targeted",
      targets: [
        { kind: "native", os: "linux", arch: "x64" },
      ],
    })).toThrow("必须声明 gnu 或 musl abi");
  });

  it("selects only a universal or exact host target", () => {
    const service = new AppPlatformTargetService({
      platform: "linux",
      arch: "arm64",
      linuxAbi: "musl",
    });
    const artifacts = [
      {
        id: "gnu",
        target: service.parseTargetKey("linux-arm64-gnu"),
      },
      {
        id: "musl",
        target: service.parseTargetKey("linux-arm64-musl"),
      },
    ];

    expect(service.selectArtifact(artifacts)?.id).toBe("musl");
    expect(service.selectArtifact([
      { id: "x64", target: service.parseTargetKey("linux-x64-musl") },
    ])).toBeUndefined();
    expect(service.selectArtifact([
      { id: "portable", target: { kind: "universal" } },
    ])?.id).toBe("portable");
  });

  it("selects the highest compatible version rather than global latest", () => {
    const service = new AppPlatformTargetService({
      platform: "linux",
      arch: "x64",
      linuxAbi: "gnu",
    });
    const versions = [
      {
        version: "2.0.0",
        artifacts: [
          { target: service.parseTargetKey("darwin-arm64"), value: "mac-latest" },
        ],
      },
      {
        version: "1.9.0",
        artifacts: [
          { target: service.parseTargetKey("linux-x64-gnu"), value: "linux-compatible" },
        ],
      },
      {
        version: "1.10.0-beta.1",
        artifacts: [
          { target: service.parseTargetKey("linux-x64-gnu"), value: "linux-beta" },
        ],
      },
    ];

    expect(service.selectLatestCompatibleVersion(versions)?.version).toBe("1.10.0-beta.1");
  });

  it("requires declared and actual target sets to match exactly", () => {
    const service = new AppPlatformTargetService();
    const linux = service.parseTargetKey("linux-x64-gnu");
    const darwin = service.parseTargetKey("darwin-arm64");
    expect(() => service.assertExactTargetSet({
      declared: [linux, darwin],
      actual: [linux],
    })).toThrow("声明 targets 与实际 artifacts 不一致");
    expect(() => service.assertExactTargetSet({
      declared: [linux],
      actual: [linux],
    })).not.toThrow();
  });
});
