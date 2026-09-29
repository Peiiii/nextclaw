import { Validator, type OutputUnit } from "@cfworker/json-schema";
import type {
  NcpInvalidToolArgumentsResult,
  NcpLLMApiInput,
  NcpToolDefinition,
  NcpToolCallResult,
  OpenAIChatMessage,
  OpenAITool,
} from "@nextclaw/ncp";
import {
  defaultToolResultContentManager,
  type ToolResultContentManager,
} from "../tool-result/tool-result-content.manager.js";

export type ParsedToolArgs =
  | {
      ok: true;
      rawText: string;
      value: Record<string, unknown>;
    }
  | {
      ok: false;
      rawText: string;
      issues: string[];
    };

// Tools may arrive at runtime (for example from MCP). Interpret their schemas
// without eval/new Function so Node and Workers enforce the same contract.
const validatorCache = new WeakMap<Record<string, unknown>, Validator>();
const DISALLOWED_OPENAI_TOOL_SCHEMA_TOP_LEVEL_KEYWORDS = [
  "oneOf",
  "anyOf",
  "allOf",
  "enum",
  "not",
] as const;

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyRawArgs(args: unknown): string {
  if (typeof args === "string") {
    return args;
  }
  if (args && typeof args === "object" && !Array.isArray(args)) {
    try {
      return JSON.stringify(args);
    } catch {
      return "[unserializable-object]";
    }
  }
  return String(args ?? "");
}

export function getOpenAiFunctionParametersSchemaIssues(
  schema: Record<string, unknown> | undefined,
): string[] {
  if (!schema) {
    return ['parameters must be declared as a JSON Schema object'];
  }
  if (!isRecord(schema)) {
    return ['parameters must be a JSON Schema object'];
  }

  const issues: string[] = [];
  if (schema.type !== "object") {
    issues.push('root schema must set type to "object"');
  }

  for (const keyword of DISALLOWED_OPENAI_TOOL_SCHEMA_TOP_LEVEL_KEYWORDS) {
    if (keyword in schema) {
      issues.push(`root schema must not declare top-level "${keyword}"`);
    }
  }

  return issues;
}

export function assertOpenAiFunctionParametersSchema(params: {
  toolName: string;
  schema: Record<string, unknown> | undefined;
}): void {
  const issues = getOpenAiFunctionParametersSchemaIssues(params.schema);
  if (issues.length === 0) {
    return;
  }
  throw new Error(
    `Tool "${params.toolName}" declares an unsupported OpenAI-compatible parameters schema: ${issues.join(
      "; ",
    )}. See docs/internal/openai-tool-schema.md.`,
  );
}

export function buildOpenAiFunctionTool(definition: NcpToolDefinition): OpenAITool {
  assertOpenAiFunctionParametersSchema({
    toolName: definition.name,
    schema: definition.parameters,
  });
  return {
    type: "function" as const,
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
    },
  };
}

export function parseToolArgs(args: unknown): ParsedToolArgs {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return {
      ok: true,
      rawText: stringifyRawArgs(args),
      value: args as Record<string, unknown>,
    };
  }

  const rawText = stringifyRawArgs(args);
  if (typeof args !== "string") {
    return {
      ok: false,
      rawText,
      issues: ["Tool arguments must be a JSON object string."],
    };
  }

  const trimmed = args.trim();
  if (!trimmed) {
    return {
      ok: false,
      rawText,
      issues: ["Tool arguments are empty."],
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        rawText,
        issues: ["Tool arguments JSON must decode to an object."],
      };
    }
    return {
      ok: true,
      rawText,
      value: parsed as Record<string, unknown>,
    };
  } catch (error) {
    return {
      ok: false,
      rawText,
      issues: [error instanceof Error ? error.message : "Failed to parse tool arguments JSON."],
    };
  }
}

export function validateToolArgs(
  args: Record<string, unknown>,
  schema: Record<string, unknown> | undefined,
): string[] {
  if (!schema) {
    return [];
  }
  const validate = getOrCreateValidator(schema);
  const result = validate.validate(args);
  if (result.valid) {
    return [];
  }
  return formatSchemaIssues(result.errors);
}

function getOrCreateValidator(schema: Record<string, unknown>): Validator {
  const cached = validatorCache.get(schema);
  if (cached) {
    return cached;
  }
  const validate = new Validator(schema, "7", false);
  validatorCache.set(schema, validate);
  return validate;
}

function formatSchemaIssues(errors: OutputUnit[]): string[] {
  if (!errors || errors.length === 0) {
    return ["Tool arguments do not match the declared schema."];
  }

  return errors.map((error) => {
    const instancePath = error.instanceLocation.replace(/^#\/?/, "").replace(/\//g, ".");
    const missingProperty = error.keyword === "required"
      ? /^Instance does not have required property "(.*)"\.$/.exec(error.error)?.[1] : undefined;
    if (missingProperty !== undefined) {
      const missingPath = instancePath
        ? `${instancePath}.${missingProperty}`
        : missingProperty;
      return `${missingPath} is required`;
    }
    const additionalProperty = error.keyword === "additionalProperties"
      ? /^Property "(.*)" does not match additional properties schema\.$/.exec(error.error)?.[1] : undefined;
    if (additionalProperty !== undefined) {
      const extraPath = instancePath
        ? `${instancePath}.${additionalProperty}`
        : additionalProperty;
      return `${extraPath} is not allowed`;
    }
    const label = instancePath || "parameter";
    return `${label}: ${error.error}`;
  });
}

export function createInvalidToolArgumentsResult(params: {
  toolCallId: string;
  toolName: string;
  rawArgumentsText: string;
  issues: string[];
}): NcpInvalidToolArgumentsResult {
  const { toolCallId, toolName, rawArgumentsText, issues } = params;
  return {
    ok: false,
    error: {
      code: "invalid_tool_arguments",
      message: "Tool arguments are invalid.",
      toolCallId,
      toolName,
      rawArgumentsText,
      issues,
    },
  };
}

export function createToolExecutionFailedResult(params: {
  toolCallId: string;
  toolName: string;
  error: unknown;
}): {
  ok: false;
  error: {
    code: "tool_execution_failed";
    message: string;
    toolCallId: string;
    toolName: string;
  };
} {
  const { toolCallId, toolName, error } = params;
  return {
    ok: false,
    error: {
      code: "tool_execution_failed",
      message: error instanceof Error ? error.message : String(error),
      toolCallId,
      toolName,
    },
  };
}

export function appendToolRoundToInput(
  input: NcpLLMApiInput,
  reasoning: string,
  text: string,
  toolResults: ReadonlyArray<NcpToolCallResult>,
  toolResultContentManager: ToolResultContentManager = defaultToolResultContentManager,
): NcpLLMApiInput {
  const assistantMsg: OpenAIChatMessage = {
    role: "assistant",
    content: text || null,
    ...(reasoning ? { reasoning_content: reasoning } : {}),
    tool_calls: toolResults.map((tr) => ({
      id: tr.toolCallId,
      type: "function" as const,
      function: {
        name: tr.toolName,
        arguments: tr.rawArgsText,
      },
    })),
  };
  const toolMsgs: OpenAIChatMessage[] = toolResults.map((tr) => ({
    role: "tool" as const,
    content: toolResultContentManager.toModelContent(tr.result, {
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
    }),
    tool_call_id: tr.toolCallId,
  }));
  const visualMessages = toolResultContentManager.toVisualObservationMessages(toolResults);
  return toolResultContentManager.compactInput({
    ...input,
    messages: [...input.messages, assistantMsg, ...toolMsgs, ...visualMessages],
  });
}
