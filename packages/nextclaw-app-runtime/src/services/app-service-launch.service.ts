import { AppPlatformTargetService } from "./app-platform-target.service.js";
import type { AppNativeArtifactTarget } from "#app-runtime/types/app-manifest.types.js";

export type AppServiceLaunch = {
  command: string;
  args: string[];
};

export class AppServiceLaunchService {
  constructor(
    private readonly platformTargetService = new AppPlatformTargetService(),
  ) {}

  resolve = (
    manifest: Record<string, unknown>,
    target?: AppNativeArtifactTarget,
  ): AppServiceLaunch => {
    const hasCommand = manifest.command !== undefined;
    const hasLaunch = manifest.launch !== undefined;
    if (hasCommand === hasLaunch) {
      throw new Error(
        "service app 必须且只能声明 command/args 或 launch.targets 其中一种启动方式。",
      );
    }
    if (hasCommand) {
      return {
        command: this.readRequiredString(manifest.command, "service app command"),
        args: this.readStringArray(manifest.args, "service app args"),
      };
    }

    const launch = this.assertObject(manifest.launch, "service app launch");
    if (!Array.isArray(launch.targets) || launch.targets.length === 0) {
      throw new Error("service app launch.targets 必须是非空数组。");
    }
    const targets = launch.targets.map((rawTarget, index) => {
      const candidate = this.assertObject(
        rawTarget,
        `service app launch.targets[${index}]`,
      );
      const parsedTarget = this.platformTargetService.parseArtifactTarget(
        candidate.target,
        `service app launch.targets[${index}].target`,
      );
      if (parsedTarget.kind !== "native") {
        throw new Error(
          `service app launch.targets[${index}].target 必须是 native target。`,
        );
      }
      return {
        target: parsedTarget,
        command: this.readRequiredString(
          candidate.command,
          `service app launch.targets[${index}].command`,
        ),
        args: this.readStringArray(
          candidate.args,
          `service app launch.targets[${index}].args`,
        ),
      };
    });
    const targetKeys = targets.map((entry) =>
      this.platformTargetService.toTargetKey(entry.target),
    );
    const duplicate = targetKeys.find(
      (targetKey, index) => targetKeys.indexOf(targetKey) !== index,
    );
    if (duplicate) {
      throw new Error(`service app launch.targets 包含重复 target：${duplicate}`);
    }
    const selectedTarget = target ?? this.platformTargetService.readHostTarget();
    const selected = this.platformTargetService.selectArtifact(targets, selectedTarget);
    if (!selected) {
      throw new Error(
        `service app 不支持当前 target：${this.platformTargetService.toTargetKey(selectedTarget)}。`,
      );
    }
    return { command: selected.command, args: selected.args };
  };

  private readRequiredString = (value: unknown, fieldName: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} 必须是非空字符串。`);
    }
    return value.trim();
  };

  private readStringArray = (value: unknown, fieldName: string): string[] => {
    if (value === undefined) {
      return [];
    }
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
      throw new Error(`${fieldName} 必须是字符串数组。`);
    }
    return value;
  };

  private assertObject = (
    value: unknown,
    fieldName: string,
  ): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${fieldName} 必须是对象。`);
    }
    return value as Record<string, unknown>;
  };
}
