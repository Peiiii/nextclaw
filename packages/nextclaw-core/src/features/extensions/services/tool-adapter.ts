import { Tool } from "../agent/tools/base.js";
import type { Config } from "../config/schema.js";
import type {
  ExtensionDiagnostic,
  ExtensionTool,
  ExtensionToolContext,
  ExtensionToolRegistration
} from "./types.js";

function normalizeToolList(value: unknown): ExtensionTool[] {
  if (!value) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry): entry is ExtensionTool => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const tool = entry as ExtensionTool;
    return (
      typeof tool.name === "string" &&
      tool.name.trim().length > 0 &&
      tool.parameters !== undefined &&
      typeof tool.execute === "function"
    );
  });
}

function normalizeSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return {
      type: "object",
      properties: {},
      additionalProperties: true
    };
  }
  const typed = schema as Record<string, unknown>;
  if (typed.type !== "object") {
    return {
      type: "object",
      properties: {},
      additionalProperties: true
    };
  }
  return typed;
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export class ExtensionToolAdapter extends Tool {
  private fallbackDescription: string;
  private fallbackParameters: Record<string, unknown>;

  constructor(
    private params: {
      registration: ExtensionToolRegistration;
      alias: string;
      config: Config;
      workspaceDir: string;
      contextProvider: () => ExtensionToolContext;
      diagnostics: ExtensionDiagnostic[];
    }
  ) {
    super();
    const preview = this.resolveToolPreview();
    this.fallbackDescription =
      preview?.description?.trim() || `Extension tool '${params.alias}' from ${params.registration.extensionId}`;
    this.fallbackParameters = normalizeSchema(preview?.parameters);
  }

  get name(): string {
    return this.params.alias;
  }

  get description(): string {
    const preview = this.resolveToolPreview();
    return preview?.description?.trim() || this.fallbackDescription;
  }

  get parameters(): Record<string, unknown> {
    const preview = this.resolveToolPreview();
    return normalizeSchema(preview?.parameters ?? this.fallbackParameters);
  }

  override isAvailable = (): boolean => this.resolveToolPreview() !== null;

  override async execute(params: Record<string, unknown>, toolCallId?: string): Promise<string> {
    const resolved = this.resolveToolRuntime();
    if (!resolved) {
      return `Error: Tool '${this.name}' not available in extension '${this.params.registration.extensionId}'`;
    }

    try {
      const result =
        resolved.execute.length >= 2
          ? await (resolved.execute as (toolCallId: string, values: Record<string, unknown>) => Promise<unknown> | unknown)(
              toolCallId ?? "",
              params
            )
          : await (resolved.execute as (values: Record<string, unknown>) => Promise<unknown> | unknown)(params);
      return stringifyToolResult(result);
    } catch (err) {
      return `Error executing ${this.name}: ${String(err)}`;
    }
  }

  private buildContext = (): ExtensionToolContext => {
    return {
      config: this.params.config,
      workspaceDir: this.params.workspaceDir,
      ...this.params.contextProvider()
    };
  };

  private resolveToolPreview = (): ExtensionTool | null => {
    try {
      const tools = normalizeToolList(this.params.registration.factory(this.buildContext()));
      return this.pickToolForAlias(tools);
    } catch {
      return null;
    }
  };

  private resolveToolRuntime = (): ExtensionTool | null => {
    try {
      const tools = normalizeToolList(this.params.registration.factory(this.buildContext()));
      return this.pickToolForAlias(tools);
    } catch (err) {
      this.params.diagnostics.push({
        level: "warn",
        extensionId: this.params.registration.extensionId,
        source: this.params.registration.source,
        message: `tool factory failed for '${this.name}': ${String(err)}`
      });
      return null;
    }
  };

  private pickToolForAlias = (tools: ExtensionTool[]): ExtensionTool | null => {
    if (tools.length === 0) {
      return null;
    }
    const byName = tools.find((tool) => tool.name === this.params.alias);
    if (byName) {
      return byName;
    }
    if (tools.length === 1) {
      return tools[0];
    }
    const declared = this.params.registration.names;
    if (declared.length === tools.length) {
      const index = declared.indexOf(this.params.alias);
      if (index >= 0 && index < tools.length) {
        return tools[index];
      }
    }
    return tools[0];
  };
}
