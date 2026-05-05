#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

class DeepSeekReasoningContentSmoke {
  constructor(configPath) {
    this.configPath = configPath;
  }

  loadConfig = () => {
    const raw = readFileSync(this.configPath, "utf8");
    const config = JSON.parse(raw);
    const deepseek = config?.providers?.deepseek;
    const apiKey = typeof deepseek?.apiKey === "string" ? deepseek.apiKey.trim() : "";
    const apiBase =
      typeof deepseek?.apiBase === "string" && deepseek.apiBase.trim()
        ? deepseek.apiBase.trim()
        : "https://api.deepseek.com";
    if (!apiKey) {
      throw new Error(`Missing providers.deepseek.apiKey in ${this.configPath}`);
    }
    return {
      apiKey,
      apiBase,
      model: "deepseek-v4-flash",
    };
  };

  post = async (body) => {
    const { apiBase, apiKey } = this.loadConfig();
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed, raw: text };
  };

  buildProbeRequest = () => ({
    model: this.loadConfig().model,
    messages: [
      {
        role: "user",
        content: "先思考，再调用 shell 工具执行 `pwd`，最后不要总结。",
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "shell",
          description: "run shell",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string" },
            },
            required: ["command"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });

  extractAssistantToolRound = (response) => {
    const message = response.body?.choices?.[0]?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    if (response.status >= 400) {
      throw new Error(`Probe request failed: ${response.status} ${JSON.stringify(response.body)}`);
    }
    if (!toolCalls.length) {
      throw new Error(`Probe request did not produce tool_calls: ${JSON.stringify(response.body)}`);
    }
    const reasoningContent =
      typeof message?.reasoning_content === "string" ? message.reasoning_content : null;
    if (reasoningContent === null) {
      throw new Error(
        `Probe request did not return assistant reasoning_content: ${JSON.stringify(response.body)}`,
      );
    }
    return {
      assistant: {
        role: "assistant",
        content: message?.content ?? "",
        reasoning_content: reasoningContent,
        tool_calls: toolCalls,
      },
      firstToolCallId: typeof toolCalls[0]?.id === "string" ? toolCalls[0].id : null,
      reasoningContent,
    };
  };

  buildReplayRequest = ({ assistant, replayMode, toolCallId }) => ({
    model: this.loadConfig().model,
    messages: [
      {
        role: assistant.role,
        content: assistant.content,
        ...(replayMode === "empty-reasoning" ? { reasoning_content: "" } : {}),
        ...(replayMode === "original-reasoning"
          ? { reasoning_content: assistant.reasoning_content }
          : {}),
        tool_calls: assistant.tool_calls,
      },
      {
        role: "tool",
        tool_call_id: toolCallId,
        content: "done",
      },
      {
        role: "user",
        content: "继续",
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "shell",
          description: "run shell",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string" },
            },
            required: ["command"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });

  run = async () => {
    const probe = await this.post(this.buildProbeRequest());
    const { assistant, firstToolCallId, reasoningContent } = this.extractAssistantToolRound(probe);
    if (!firstToolCallId) {
      throw new Error(`Probe request returned a tool_call without id: ${JSON.stringify(probe.body)}`);
    }

    const missingReasoning = await this.post(
      this.buildReplayRequest({
        assistant,
        replayMode: "missing-reasoning",
        toolCallId: firstToolCallId,
      }),
    );

    const emptyReasoning = await this.post(
      this.buildReplayRequest({
        assistant,
        replayMode: "empty-reasoning",
        toolCallId: firstToolCallId,
      }),
    );
    if (emptyReasoning.status >= 400) {
      throw new Error(
        `Expected replay with empty reasoning_content to succeed, got ${emptyReasoning.status}: ${JSON.stringify(emptyReasoning.body)}`,
      );
    }

    const originalReasoning = await this.post(
      this.buildReplayRequest({
        assistant,
        replayMode: "original-reasoning",
        toolCallId: firstToolCallId,
      }),
    );
    if (originalReasoning.status >= 400) {
      throw new Error(
        `Expected replay with original reasoning_content to succeed, got ${originalReasoning.status}: ${JSON.stringify(originalReasoning.body)}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          model: this.loadConfig().model,
          probeStatus: probe.status,
          missingReasoningStatus: missingReasoning.status,
          emptyReasoningStatus: emptyReasoning.status,
          originalReasoningStatus: originalReasoning.status,
          probeReasoningLength: reasoningContent.length,
        },
        null,
        2,
      ),
    );
  };
}

function parseArgs(argv) {
  const configIndex = argv.indexOf("--config-path");
  const configPath = configIndex >= 0 ? argv[configIndex + 1] : null;
  if (configIndex >= 0) {
    if (!configPath) {
      throw new Error("--config-path requires a value");
    }
    argv.splice(configIndex, 2);
  }
  return {
    configPath: configPath
      ? resolve(configPath)
      : resolve(homedir(), ".nextclaw", "config.json"),
  };
}

async function main() {
  const { configPath } = parseArgs(process.argv.slice(2));
  const smoke = new DeepSeekReasoningContentSmoke(configPath);
  await smoke.run();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
