import { access } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPublishCommandController } from "@nextclaw-cli/cli/app/controllers/app-publish-command.controller.js";
import { AppPublishingService } from "./app-publishing.service.js";

const componentValidation = {
  ok: true,
  appDirectory: "/tmp/example",
  metadataPath: "/tmp/example/marketplace.json",
  appId: "alice.notes",
  version: "0.1.0",
  distributionMode: "bundle" as const,
  profile: "components" as const,
  componentCount: 2,
  bundleSizeBytes: 1024,
  bundleFilePaths: ["manifest.json"],
  warnings: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppPublishingService", () => {
  it("packs a declared target through the NextClaw app command service", async () => {
    const target = { kind: "native", os: "linux", arch: "x64", abi: "gnu" };
    const packAppDirectory = vi.fn().mockResolvedValue({ bundlePath: "/tmp/dist/linux-x64-gnu.napp" });
    const parseTargetKey = vi.fn().mockReturnValue(target);
    const service = new AppPublishingService(
      {} as never,
      {} as never,
      { packAppDirectory } as never,
      { parseTargetKey } as never,
    );

    await expect(service.pack({
      appDirectory: "/tmp/example",
      outputPath: "/tmp/dist/linux-x64-gnu.napp",
      target: "linux-x64-gnu",
    })).resolves.toEqual({ bundlePath: "/tmp/dist/linux-x64-gnu.napp" });
    expect(parseTargetKey).toHaveBeenCalledWith("linux-x64-gnu");
    expect(packAppDirectory).toHaveBeenCalledWith({
      appDirectory: "/tmp/example",
      outputPath: "/tmp/dist/linux-x64-gnu.napp",
      mode: "bundle",
      target,
    });
  });

  it("pins native Mini App validation to schema v2 bundle publishing", async () => {
    const validate = vi.fn().mockResolvedValue(componentValidation);
    const service = new AppPublishingService(
      { validate } as never,
      {} as never,
    );

    await expect(
      service.validate({ appDirectory: "/tmp/example" }),
    ).resolves.toEqual(componentValidation);
    expect(validate).toHaveBeenCalledWith({
      appDirectory: "/tmp/example",
      metadataPath: undefined,
      artifactsDirectory: undefined,
      mode: "bundle",
    });
  });

  it("rejects legacy standalone apps from the native Mini App command", async () => {
    const validate = vi.fn().mockResolvedValue({
      ...componentValidation,
      profile: "standalone",
    });
    const service = new AppPublishingService(
      { validate } as never,
      {} as never,
    );

    await expect(
      service.validate({ appDirectory: "/tmp/example" }),
    ).rejects.toThrow("schema v2 Mini App");
  });

  it("requires explicit acknowledgement before publishing warnings", async () => {
    const validate = vi.fn().mockResolvedValue({
      ...componentValidation,
      warnings: [{ code: "bundle-large", message: "bundle is large" }],
    });
    const publish = vi.fn();
    const service = new AppPublishingService(
      { validate } as never,
      { publish } as never,
    );

    await expect(
      service.publish({ appDirectory: "/tmp/example" }),
    ).rejects.toThrow("--allow-warnings");
    expect(publish).not.toHaveBeenCalled();
  });

  it("submits a validated component app through the shared publisher", async () => {
    const validate = vi.fn().mockResolvedValue(componentValidation);
    const publishResult = {
      created: true,
      item: {
        slug: "alice--notes",
        appId: "alice.notes",
        ownerScope: "alice",
        appName: "notes",
        publishStatus: "pending",
        name: "Notes",
        latestVersion: "0.1.0",
        install: {
          kind: "registry",
          spec: "alice.notes",
          command: "napp install alice.notes",
          registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
        },
      },
      distribution: {
        path: "/tmp/alice.notes-0.1.0.napp",
        sha256: "a".repeat(64),
        mode: "bundle",
      },
      fileCount: 2,
    };
    const publish = vi.fn().mockResolvedValue(publishResult);
    const service = new AppPublishingService(
      { validate } as never,
      { publish } as never,
    );

    const result = await service.publish({
      appDirectory: "/tmp/example",
      artifactsDirectory: "/tmp/dist",
      allowWarnings: true,
    });

    expect(result).toEqual({
      validation: componentValidation,
      publish: {
        created: true,
        item: {
          slug: "alice--notes",
          appId: "alice.notes",
          ownerScope: "alice",
          appName: "notes",
          publishStatus: "pending",
          name: "Notes",
          latestVersion: "0.1.0",
          webUrl: undefined,
        },
        fileCount: 2,
      },
    });
    expect(result.publish.item).not.toHaveProperty("install");
    expect(result.publish).not.toHaveProperty("distribution");
    expect(publish).toHaveBeenCalledWith({
      appDirectory: "/tmp/example",
      metadataPath: undefined,
      artifactsDirectory: "/tmp/dist",
      bundleOutputPath: expect.stringMatching(/nextclaw-app-publish-.+\/artifact\.napp$/),
      mode: "bundle",
    });
    const bundleOutputPath = publish.mock.calls[0]?.[0]?.bundleOutputPath as string;
    await expect(access(path.dirname(bundleOutputPath))).rejects.toThrow();
  });

  it("keeps raw token options out of native login guidance", async () => {
    const service = new AppPublishingService(
      { validate: vi.fn().mockResolvedValue(componentValidation) } as never,
      {
        publish: vi
          .fn()
          .mockRejectedValue(
            new Error(
              "发布需要 NextClaw 平台登录态。请先运行 nextclaw login，或传入 --token。",
            ),
          ),
      } as never,
    );

    const error = await service
      .publish({ appDirectory: "/tmp/example" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("nextclaw login");
    expect((error as Error).message).not.toContain("--token");
  });
});

describe("AppPublishCommandController", () => {
  it("reports a personal submission as pending without install details", async () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((() => true) as typeof process.stdout.write);
    const controller = new AppPublishCommandController({
      publish: vi.fn().mockResolvedValue({
        validation: componentValidation,
        publish: {
          created: true,
          item: {
            slug: "alice--notes",
            appId: "alice.notes",
            ownerScope: "alice",
            appName: "notes",
            publishStatus: "pending",
            name: "Notes",
            latestVersion: "0.1.0",
          },
          fileCount: 2,
        },
      }),
    } as never);

    await controller.publish("/tmp/example", {});

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(output).toContain("Submitted Notes");
    expect(output).toContain("Status: pending");
    expect(output).not.toContain("Install:");
    expect(output).not.toContain("Details:");
  });
});
