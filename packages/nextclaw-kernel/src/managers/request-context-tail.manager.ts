import type { ModelInputTail, ModelInputTailSection } from "@nextclaw/ncp";

export type RequestContextTailRequest = {
  sessionId: string;
  runId: string;
  agentId: string;
  model: string;
  signal?: AbortSignal;
};

export type RequestContextTailProvider = {
  provide: (
    request: RequestContextTailRequest,
  ) =>
    | Promise<readonly ModelInputTailSection[]>
    | readonly ModelInputTailSection[];
};

export class RequestContextTailManager {
  private readonly providers = new Set<RequestContextTailProvider>();

  register = (provider: RequestContextTailProvider): (() => void) => {
    this.providers.add(provider);
    return () => {
      this.providers.delete(provider);
    };
  };

  build = async (
    request: RequestContextTailRequest,
  ): Promise<ModelInputTail | undefined> => {
    const sections: ModelInputTailSection[] = [];
    for (const provider of [...this.providers]) {
      sections.push(...(await provider.provide(request)));
    }
    return sections.length > 0
      ? { kind: "model_input_tail", sections }
      : undefined;
  };

  dispose = (): void => {
    this.providers.clear();
  };
}
