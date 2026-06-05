import type { ConfigRepository } from "@/repositories/config.repository.js";
import type { SecretsRepository } from "@/repositories/secrets.repository.js";
import type { AigenCommandOutput } from "@/types/cli-output.types.js";
import { parseModelRoute } from "@/utils/route.utils.js";
import type { ProviderRuntimeManager } from "@/managers/provider-runtime.manager.js";

export type DoctorRunOptions = {
  provider?: string;
  model?: string;
};

type DoctorCheck = {
  name: string;
  ok: boolean;
};

export class DoctorController {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly secretsRepository: SecretsRepository,
    private readonly providerRuntimeManager: ProviderRuntimeManager,
  ) {}

  run = async (options: DoctorRunOptions): Promise<AigenCommandOutput> => {
    const { provider, model } = options;
    const checks: DoctorCheck[] = [];
    const config = await this.configRepository.readConfig();

    checks.push({ name: "config", ok: true });

    if (provider) {
      await this.checkProvider(provider, checks);
    }

    if (model) {
      const route = parseModelRoute(model);
      await this.configRepository.getModel(route.providerId, route.providerLocalModel);
      await this.checkProvider(route.providerId, checks);
      checks.push({ name: "model", ok: true });
    }

    return {
      ok: true,
      providerCount: Object.keys(config.providers).length,
      checks
    };
  };

  private checkProvider = async (providerId: string, checks: DoctorCheck[]): Promise<void> => {
    const providerConfig = await this.configRepository.getProvider(providerId);
    this.providerRuntimeManager.getImageProvider(providerConfig.apiFormat);
    checks.push({ name: "provider", ok: true });
    await this.secretsRepository.getProviderSecret(providerId);
    checks.push({ name: "secret", ok: true });
  };
}
