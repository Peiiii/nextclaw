import { AppPlatformTargetService } from "@nextclaw/app-runtime";
import type { AppPackageHostTarget } from "@kernel/types/app-package.types.js";

export class AppPackageHostTargetService {
  private readonly platformTargetService = new AppPlatformTargetService();

  read = (): AppPackageHostTarget | undefined => {
    try {
      const target = this.platformTargetService.readHostTarget();
      return {
        key: this.platformTargetService.toTargetKey(target),
        operatingSystem: target.os,
        architecture: target.arch,
        ...(target.os === "darwin" ? {} : { abi: target.abi }),
      };
    } catch {
      return undefined;
    }
  };
}
