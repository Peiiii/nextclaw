import type { SecretsRepository } from "@/repositories/secrets.repository.js";
import type { AigenCommandOutput } from "@/types/cli-output.types.js";

export class SecretsController {
  constructor(private readonly secretsRepository: SecretsRepository) {}

  list = async (): Promise<AigenCommandOutput> => ({
    ok: true,
    secrets: await this.secretsRepository.listSecrets()
  });

  get = async (providerId: string): Promise<AigenCommandOutput> => ({
    ok: true,
    secret: await this.secretsRepository.getProviderSecret(providerId)
  });

  set = async (providerId: string): Promise<AigenCommandOutput> => {
    const secret = await this.secretsRepository.setProviderApiKey(providerId, await this.readStdin());
    return {
      ok: true,
      secret
    };
  };

  remove = async (providerId: string): Promise<AigenCommandOutput> => {
    await this.secretsRepository.removeProviderSecret(providerId);
    return {
      ok: true,
      removed: true,
      providerId
    };
  };

  private readStdin = async (): Promise<string> =>
    new Promise((resolve, reject) => {
      let value = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        value += chunk;
      });
      process.stdin.on("end", () => {
        resolve(value);
      });
      process.stdin.on("error", reject);
    });
}
