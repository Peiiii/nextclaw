import { LLMProvider } from "@nextclaw/core";

export class MissingProvider extends LLMProvider {
  constructor(private defaultModel: string) {
    super(null, null);
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  async chat(_params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<never> {
    throw new Error("No API key configured yet. Configure provider credentials in UI and retry.");
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
