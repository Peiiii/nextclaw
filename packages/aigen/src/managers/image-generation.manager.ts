import type { ConfigRepository } from "@/repositories/config.repository.js";
import type { SecretsRepository } from "@/repositories/secrets.repository.js";
import type { AigenImageInput, AigenImageSuccessOutput } from "@/types/image-generation.types.js";
import type { OutputFileManager } from "./output-file.manager.js";
import type { ProviderRuntimeManager } from "./provider-runtime.manager.js";
import { parseModelRoute } from "@/utils/route.utils.js";

export class ImageGenerationManager {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly secretsRepository: SecretsRepository,
    private readonly providerRuntimeManager: ProviderRuntimeManager,
    private readonly outputFileManager: OutputFileManager,
  ) {}

  generate = async (input: AigenImageInput): Promise<AigenImageSuccessOutput> => {
    const route = parseModelRoute(input.model);
    const providerConfig = await this.configRepository.getProvider(route.providerId);
    await this.configRepository.getModel(route.providerId, route.providerLocalModel);

    const provider = this.providerRuntimeManager.getImageProvider(providerConfig.apiFormat);
    const apiKey = await this.secretsRepository.getProviderApiKey(route.providerId);
    const result = await provider.generateImage(
      {
        providerLocalModel: route.providerLocalModel,
        prompt: input.prompt,
        size: input.size,
        n: input.n ?? 1,
        quality: input.quality,
        background: input.background,
        outputFormat: input.outputFormat,
        outputCompression: input.outputCompression,
        moderation: input.moderation
      },
      {
        providerId: route.providerId,
        apiFormat: providerConfig.apiFormat,
        apiBase: providerConfig.apiBase,
        apiKey,
        headers: providerConfig.headers
      },
    );
    const assets = await this.outputFileManager.writeImages(result.images, input.outputDir, input.outputName);

    return {
      ok: true,
      kind: "image",
      provider: route.providerId,
      apiFormat: providerConfig.apiFormat,
      model: input.model,
      providerLocalModel: route.providerLocalModel,
      assets,
      usage: result.usage,
      metadata: {
        ...result.metadata,
        upstreamRequestId: result.upstreamRequestId
      }
    };
  };
}
