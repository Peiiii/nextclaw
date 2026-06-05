import { AigenError } from "@/types/cli-output.types.js";
import type {
  AigenImageProvider,
  AigenProviderContext,
  AigenProviderImageResult,
  AigenProviderImageRequest,
  AigenRemoteModelListProvider,
  AigenRemoteModelListRequest,
  AigenRemoteModelListResult
} from "@/types/provider.types.js";
import { isDataUrl, parseImageDataUrl } from "@/utils/data-url.utils.js";
import { extensionToMimeType } from "@/utils/mime.utils.js";

type JsonRecord = Record<string, unknown>;

export class OpenRouterProvider implements AigenImageProvider, AigenRemoteModelListProvider {
  readonly apiFormat = "openrouter";

  generateImage = async (
    request: AigenProviderImageRequest,
    context: AigenProviderContext,
  ): Promise<AigenProviderImageResult> => {
    const response = await fetch(this.url(context.apiBase, "/chat/completions"), {
      method: "POST",
      headers: this.headers(context),
      body: JSON.stringify(this.toChatCompletionsBody(request))
    });

    const payload = await this.readJson(response);

    if (!response.ok) {
      throw new AigenError("PROVIDER_REQUEST_FAILED", "OpenRouter image generation request failed.", {
        retryable: response.status >= 500
      });
    }

    return {
      images: await this.extractImages(payload),
      usage: this.recordOrUndefined(payload.usage),
      upstreamRequestId: this.stringOrUndefined(payload.id),
      metadata: {
        model: this.stringOrUndefined(payload.model)
      }
    };
  };

  listRemoteModels = async (
    _request: AigenRemoteModelListRequest,
    context: AigenProviderContext,
  ): Promise<AigenRemoteModelListResult> => {
    const response = await fetch(this.url(context.apiBase, "/models?output_modalities=image"), {
      method: "GET",
      headers: this.headers(context)
    });
    const payload = await this.readJson(response);

    if (!response.ok) {
      throw new AigenError("PROVIDER_REQUEST_FAILED", "OpenRouter models request failed.", {
        retryable: response.status >= 500
      });
    }

    const data = Array.isArray(payload.data) ? payload.data : [];

    return {
      models: data.flatMap((entry) => {
        const model = this.recordOrUndefined(entry);
        const id = this.stringOrUndefined(model?.id);

        if (!model || !id) {
          return [];
        }

        return [
          {
            providerLocalModel: id,
            displayName: this.stringOrUndefined(model.name),
            inputModalities: this.stringArrayOrUndefined(this.recordOrUndefined(model.architecture)?.input_modalities),
            outputModalities: this.stringArrayOrUndefined(this.recordOrUndefined(model.architecture)?.output_modalities),
            pricing: this.recordOrUndefined(model.pricing),
            metadata: model
          }
        ];
      })
    };
  };

  private toChatCompletionsBody = (request: AigenProviderImageRequest): JsonRecord => {
    const body: JsonRecord = {
      model: request.providerLocalModel,
      messages: [
        {
          role: "user",
          content: request.prompt
        }
      ],
      modalities: ["image"],
      stream: false
    };

    if (request.size) {
      body.image_config = {
        image_size: request.size
      };
    }

    return body;
  };

  private extractImages = async (payload: JsonRecord): Promise<AigenProviderImageResult["images"]> => {
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const urls = choices.flatMap((choice) => this.extractImageUrls(choice));

    if (urls.length === 0) {
      throw new AigenError("PROVIDER_REQUEST_FAILED", "OpenRouter response did not include generated images.");
    }

    return Promise.all(urls.map((url) => this.loadImageUrl(url)));
  };

  private extractImageUrls = (choice: unknown): string[] => {
    const message = this.recordOrUndefined(this.recordOrUndefined(choice)?.message);
    const images = Array.isArray(message?.images) ? message.images : [];

    return images.flatMap((image) => {
      const url = this.stringOrUndefined(this.recordOrUndefined(this.recordOrUndefined(image)?.image_url)?.url);
      return url ? [url] : [];
    });
  };

  private loadImageUrl = async (url: string): Promise<AigenProviderImageResult["images"][number]> => {
    if (isDataUrl(url)) {
      const dataUrl = parseImageDataUrl(url);
      return {
        bytes: dataUrl.bytes,
        mimeType: dataUrl.mimeType
      };
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new AigenError("PROVIDER_REQUEST_FAILED", "Failed to download generated image.", {
        retryable: response.status >= 500
      });
    }

    const contentType = response.headers.get("content-type") ?? this.mimeTypeFromUrl(url);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: contentType
    };
  };

  private readJson = async (response: Response): Promise<JsonRecord> => {
    const value = (await response.json()) as unknown;
    const record = this.recordOrUndefined(value);

    if (!record) {
      throw new AigenError("PROVIDER_REQUEST_FAILED", "Provider returned a non-object JSON response.");
    }

    return record;
  };

  private headers = (context: AigenProviderContext): HeadersInit => ({
    authorization: `Bearer ${context.apiKey}`,
    "content-type": "application/json",
    ...context.headers
  });

  private url = (apiBase: string, path: string): string => `${apiBase.replace(/\/$/, "")}${path}`;

  private recordOrUndefined = (value: unknown): JsonRecord | undefined =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;

  private stringOrUndefined = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  private stringArrayOrUndefined = (value: unknown): string[] | undefined =>
    Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

  private mimeTypeFromUrl = (url: string): string => {
    const extension = url.split("?")[0]?.split(".").pop();
    return extension ? extensionToMimeType(extension) : "application/octet-stream";
  };
}
