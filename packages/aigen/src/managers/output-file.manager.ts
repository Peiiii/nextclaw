import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { AigenError } from "@/types/cli-output.types.js";
import type { AigenImageAsset } from "@/types/image-generation.types.js";
import type { AigenProviderImage } from "@/types/provider.types.js";
import { mimeTypeToExtension } from "@/utils/mime.utils.js";

export class OutputFileManager {
  writeImages = async (
    images: AigenProviderImage[],
    outputDir: string,
    outputName: string,
  ): Promise<AigenImageAsset[]> => {
    this.assertOutputName(outputName);
    await mkdir(outputDir, { recursive: true });

    const resolvedOutputDir = resolve(outputDir);
    const assets: AigenImageAsset[] = [];

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const extension = image.format ?? mimeTypeToExtension(image.mimeType);
      const filename = this.createFilename(outputName, extension, images.length, index);
      const path = resolve(resolvedOutputDir, filename);

      this.assertContainedPath(resolvedOutputDir, path);
      await writeFile(path, image.bytes, { flag: "wx" });

      const fileStat = await stat(path);
      assets.push({
        path,
        filename,
        mimeType: image.mimeType,
        format: extension,
        width: image.width,
        height: image.height,
        sizeBytes: fileStat.size
      });
    }

    return assets;
  };

  private assertOutputName = (outputName: string): void => {
    if (!outputName || outputName !== basename(outputName) || outputName.includes("/") || outputName.includes("\\")) {
      throw new AigenError("INVALID_ARGUMENT", "output-name must be a basename without path separators.");
    }
  };

  private assertContainedPath = (outputDir: string, path: string): void => {
    if (path !== outputDir && !path.startsWith(`${outputDir}/`)) {
      throw new AigenError("FILE_WRITE_FAILED", "Generated file path escaped output-dir.");
    }
  };

  private createFilename = (outputName: string, extension: string, count: number, index: number): string => {
    const suffix = count === 1 ? "" : `-${index + 1}`;
    return `${outputName}${suffix}.${extension}`;
  };
}
