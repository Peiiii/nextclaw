import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ClaudeCodeMessage } from "@claude-code-sdk/types/claude-code-sdk.types.js";
import {
  buildQueryEnv,
  extractFailureMessage,
  isRetryableClaudeFailure,
} from "./claude-code-runtime.utils.js";

describe("buildQueryEnv", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("isolates explicit NextClaw provider routes", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-claude-route-"));

    const env = buildQueryEnv({
      sessionId: "session-explicit-route",
      apiKey: "route-key",
      apiBase: "https://route.example",
      model: "route-model",
      env: { NEXTCLAW_HOME: tempDir },
    });

    expect(env.CLAUDE_CONFIG_DIR).toBe(join(tempDir, "runtime", "claude-code"));
    expect(env.ANTHROPIC_API_KEY).toBe("route-key");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://route.example");
    expect(env.ANTHROPIC_MODEL).toBe("route-model");
  });

  it("preserves Claude Code configuration for runtime-default requests", () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/native-claude-config");
    vi.stubEnv("ANTHROPIC_API_KEY", "native-key");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://native.example");
    vi.stubEnv("ANTHROPIC_MODEL", "native-model");

    const env = buildQueryEnv({
      sessionId: "session-runtime-default",
      apiKey: "route-key",
      apiBase: "https://route.example",
      model: "route-model",
      useClaudeRuntimeDefaults: true,
    });

    expect(env.CLAUDE_CONFIG_DIR).toBe("/tmp/native-claude-config");
    expect(env.ANTHROPIC_API_KEY).toBe("native-key");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://native.example");
    expect(env.ANTHROPIC_MODEL).toBe("native-model");
  });
});

describe("extractFailureMessage", () => {
  it("recognizes Claude Code synthetic API errors", () => {
    const message = {
      type: "assistant",
      error: "unknown",
      message: {
        model: "<synthetic>",
        content: [{
          type: "text",
          text: "API Error: API returned an empty or malformed response (HTTP 200)",
        }],
      },
    } as ClaudeCodeMessage;

    expect(extractFailureMessage(message)).toBe(
      "API Error: API returned an empty or malformed response (HTTP 200)",
    );
    expect(isRetryableClaudeFailure(message)).toBe(true);
  });
});
