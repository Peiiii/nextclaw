import { RuntimeConfigResolver, type RuntimeCommand } from "../runtime-config";
import type { DesktopBundleBootstrapService } from "./desktop-bundle-bootstrap.service";

export class DesktopRuntimeCommandService {
  constructor(
    private readonly logger: { warn(message: string): void },
    private readonly createResolver: () => Pick<RuntimeConfigResolver, "resolveCommand"> = () => new RuntimeConfigResolver()
  ) {}

  resolve = async (bundleBootstrap: DesktopBundleBootstrapService): Promise<RuntimeCommand> => {
    const resolver = this.createResolver();
    try {
      return resolver.resolveCommand();
    } catch (error) {
      this.logger.warn(`Runtime command not available before seed install: ${String(error)}`);
    }

    await bundleBootstrap.ensureInitialBundleAvailability();
    await bundleBootstrap.recoverPendingBundleCandidate();
    await bundleBootstrap.pruneRetainedBundleArtifacts();
    return resolver.resolveCommand();
  };

  prepareBundleAfterRuntimeStart = (runtimeCommand: RuntimeCommand, bundleBootstrap: DesktopBundleBootstrapService): void => {
    if (runtimeCommand.source !== "packaged-runtime") {
      return;
    }
    void bundleBootstrap.ensureInitialBundleAvailability().catch((error) => {
      this.logger.warn(`Background packaged seed preparation failed: ${String(error)}`);
    });
  };
}
