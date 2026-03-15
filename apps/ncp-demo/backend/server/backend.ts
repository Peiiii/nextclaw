import {
  type NcpLLMApi,
  type NcpTool,
} from "@nextclaw/ncp";
import {
  DefaultNcpAgentRuntime,
  DefaultNcpContextBuilder,
  DefaultNcpToolRegistry,
} from "@nextclaw/ncp-agent-runtime";
import { DefaultNcpInMemoryAgentBackend } from "@nextclaw/ncp-toolkit";
import { DemoClockNcpLLMApi } from "./demo-llm.js";
import { OpenAICompatibleNcpLLMApi } from "./openai-compatible-llm.js";

export type DemoLlmMode = "mock" | "openai";

export function createDemoBackend(): { backend: DefaultNcpInMemoryAgentBackend; llmMode: DemoLlmMode } {
  const llm = createLlmApi();
  return {
    backend: new DefaultNcpInMemoryAgentBackend({
      endpointId: "ncp-demo-agent",
      createRuntime: ({ stateManager }) => {
        const toolRegistry = new DefaultNcpToolRegistry([createClockTool()]);
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi: llm.api,
          toolRegistry,
          stateManager,
        });
      },
    }),
    llmMode: llm.mode,
  };
}

function createClockTool(): NcpTool {
  return {
    name: "get_current_time",
    description: "Returns local time for a timezone.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA timezone string, e.g. Asia/Shanghai.",
        },
      },
      required: ["timezone"],
      additionalProperties: false,
    },
    async execute(args: unknown): Promise<unknown> {
      const timezone =
        isRecord(args) && typeof args.timezone === "string" && args.timezone.trim().length > 0
          ? args.timezone
          : "UTC";
      const date = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour12: false,
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return {
        timezone,
        iso: date.toISOString(),
        local: formatter.format(date),
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createLlmApi(): { api: NcpLLMApi; mode: DemoLlmMode } {
  const mode = (process.env.NCP_DEMO_LLM_MODE ?? "auto").trim().toLowerCase();
  if (mode === "mock") {
    return { api: new DemoClockNcpLLMApi(), mode: "mock" };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || process.env.base_url?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.3-codex";

  if (apiKey && baseUrl) {
    return {
      api: new OpenAICompatibleNcpLLMApi({
        apiKey,
        baseUrl,
        model,
      }),
      mode: "openai",
    };
  }

  return { api: new DemoClockNcpLLMApi(), mode: "mock" };
}
