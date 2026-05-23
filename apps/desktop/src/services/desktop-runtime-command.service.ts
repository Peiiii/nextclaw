import { RuntimeConfigResolver, type RuntimeCommand } from "../runtime-config";
import type { DesktopBundleManager } from "../managers/desktop-bundle.manager";

export class DesktopRuntimeCommandService {
  constructor(
    private readonly logger: { warn(message: string): void },
    private readonly bundleManager: DesktopBundleManager,
    private readonly createResolver: () => Pick<RuntimeConfigResolver, "resolveCommand"> = () => new RuntimeConfigResolver()
  ) {}

  resolve = async (): Promise<RuntimeCommand> => {
    const resolver = this.createResolver();
    const envScript = process.env.NEXTCLAW_DESKTOP_RUNTIME_SCRIPT?.trim();
    if (envScript) {
      return resolver.resolveCommand();
    }

    await this.bundleManager.ensureInitialBundleAvailability();
    await this.bundleManager.recoverPendingBundleCandidate();
    await this.bundleManager.pruneRetainedBundleArtifacts();
    return resolver.resolveCommand();
  };

  prepareBundleAfterRuntimeStart = (runtimeCommand: RuntimeCommand): void => {
    if (runtimeCommand.source !== "packaged-runtime") {
      return;
    }
    void this.bundleManager.ensureInitialBundleAvailability().catch((error) => {
      this.logger.warn(`Background packaged seed preparation failed: ${String(error)}`);
    });
  };
}
