import type { ImageGenerationManager } from "@/managers/image-generation.manager.js";
import type { AigenCommandOutput } from "@/types/cli-output.types.js";
import type { AigenImageInput } from "@/types/image-generation.types.js";

export type ImageGenerateOptions = AigenImageInput;

export class ImageController {
  constructor(private readonly imageGenerationManager: ImageGenerationManager) {}

  generate = async (options: ImageGenerateOptions): Promise<AigenCommandOutput> =>
    this.imageGenerationManager.generate(options);
}
