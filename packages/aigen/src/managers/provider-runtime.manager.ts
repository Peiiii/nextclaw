import { AigenError } from "@/types/cli-output.types.js";
import {
  isRemoteModelListProvider,
  type AigenImageProvider,
  type AigenRemoteModelListProvider
} from "@/types/provider.types.js";

export class ProviderRuntimeManager {
  private readonly providers = new Map<string, AigenImageProvider>();

  constructor(providers: AigenImageProvider[]) {
    providers.forEach((provider) => {
      this.providers.set(provider.apiFormat, provider);
    });
  }

  getImageProvider = (apiFormat: string): AigenImageProvider => {
    const provider = this.providers.get(apiFormat);

    if (!provider) {
      throw new AigenError("PROVIDER_RUNTIME_NOT_FOUND", `API format '${apiFormat}' is not supported.`);
    }

    return provider;
  };

  getRemoteModelListProvider = (apiFormat: string): AigenImageProvider & AigenRemoteModelListProvider => {
    const provider = this.getImageProvider(apiFormat);

    if (!isRemoteModelListProvider(provider)) {
      throw new AigenError("UNSUPPORTED_PARAMETER", `API format '${apiFormat}' does not support remote model list.`);
    }

    return provider;
  };
}
