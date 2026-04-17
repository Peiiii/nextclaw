import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildStdioLaunchEnv,
  isHermesAcpRuntimeConfig,
} from "./hermes-acp-route-bridge.utils.js";
import type { StdioRuntimeResolvedConfig } from "./stdio-runtime-config.utils.js";

const tempDirs: string[] = [];

function createHermesAcpConfig(): StdioRuntimeResolvedConfig {
  return {
    wireDialect: "acp",
    processScope: "per-session",
    command: "hermes",
    args: ["acp"],
    startupTimeoutMs: 8000,
    probeTimeoutMs: 3000,
    requestTimeoutMs: 120000,
  };
}

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function seedFakeHermesPythonPackage(rootDir: string): void {
  mkdirSync(join(rootDir, "acp_adapter"), { recursive: true });
  writeFileSync(join(rootDir, "acp_adapter", "__init__.py"), "", "utf8");
  writeFileSync(
    join(rootDir, "acp_adapter", "auth.py"),
    [
      "def detect_provider():",
      "    return None",
      "",
      "def has_provider():",
      "    return False",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(rootDir, "acp_adapter", "session.py"),
    [
      "_last_registered_task = None",
      "",
      "def _register_task_cwd(session_id, cwd):",
      "    global _last_registered_task",
      "    _last_registered_task = {\"session_id\": session_id, \"cwd\": cwd}",
      "",
      "def _acp_stderr_print(*args, **kwargs):",
      "    return None",
      "",
      "class SessionManager:",
      "    def __init__(self, agent_factory=None):",
      "        self._agent_factory = agent_factory",
      "",
      "    def _make_agent(self, *, session_id, cwd, model=None, requested_provider=None, base_url=None, api_mode=None):",
      "        return {",
      "            \"original\": True,",
      "            \"session_id\": session_id,",
      "            \"cwd\": cwd,",
      "            \"model\": model,",
      "            \"requested_provider\": requested_provider,",
      "            \"base_url\": base_url,",
      "            \"api_mode\": api_mode,",
      "        }",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(rootDir, "run_agent.py"),
    [
      "class _InnerClient:",
      "    def __init__(self):",
      "        self.headers = {}",
      "",
      "class _AnthropicClient:",
      "    def __init__(self):",
      "        self._default_headers = {}",
      "        self._client = _InnerClient()",
      "",
      "class AIAgent:",
      "    def __init__(self, **kwargs):",
      "        self.init_kwargs = kwargs",
      "        self._client_kwargs = {",
      "            \"api_key\": kwargs.get(\"api_key\", \"\"),",
      "            \"base_url\": kwargs.get(\"base_url\", \"\"),",
      "        }",
      "        self.model = kwargs.get(\"model\", \"\")",
      "        self.provider = kwargs.get(\"provider\", \"\")",
      "        self.base_url = kwargs.get(\"base_url\", \"\")",
      "        self.api_mode = kwargs.get(\"api_mode\", \"\")",
      "        self.client = object()",
      "        self._anthropic_client = _AnthropicClient() if self.api_mode == \"anthropic_messages\" else None",
      "        self._replace_reasons = []",
      "",
      "    def _replace_primary_openai_client(self, *, reason):",
      "        self._replace_reasons.append(reason)",
      "        return True",
      "",
    ].join("\n"),
    "utf8",
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("isHermesAcpRuntimeConfig", () => {
  it("detects hermes acp launchers", () => {
    expect(
      isHermesAcpRuntimeConfig({
        command: "hermes",
        args: ["acp"],
      }),
    ).toBe(true);
    expect(
      isHermesAcpRuntimeConfig({
        command: "/usr/local/bin/hermes-acp",
        args: [],
      }),
    ).toBe(true);
    expect(
      isHermesAcpRuntimeConfig({
        command: "python3",
        args: ["-m", "acp_adapter.entry"],
      }),
    ).toBe(true);
    expect(
      isHermesAcpRuntimeConfig({
        command: "node",
        args: ["server.js"],
      }),
    ).toBe(false);
  });
});

describe("buildStdioLaunchEnv", () => {
  it("injects a synthetic route for hermes acp probes", () => {
    const env = buildStdioLaunchEnv({
      config: createHermesAcpConfig(),
      useProbeRoute: true,
      baseEnv: {},
    });
    expect(env.NEXTCLAW_MODEL).toBe("nextclaw-hermes-acp-probe");
    expect(env.NEXTCLAW_API_BASE).toBe("http://127.0.0.1:1/v1");
    expect(env.NEXTCLAW_API_KEY).toBe("nextclaw-hermes-acp-probe-key");
    expect(env.NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE).toBe("1");
    expect(env.PYTHONPATH).toContain("hermes-acp-route-bridge");
  });
});

describe("Hermes ACP bridge sitecustomize", () => {
  it("patches fake Hermes ACP session creation to consume the NextClaw RuntimeRoute", () => {
    const fakeHermesRoot = createTempDir("nextclaw-hermes-acp-fake-");
    seedFakeHermesPythonPackage(fakeHermesRoot);
    const env = buildStdioLaunchEnv({
      config: createHermesAcpConfig(),
      baseEnv: {
        ...process.env,
        PYTHONPATH: fakeHermesRoot,
      },
      providerRoute: {
        model: "qwen3.5-plus",
        apiBase: "http://127.0.0.1:18999/v1",
        apiKey: "bridge-key",
        headers: {
          "x-nextclaw-narp-api-mode": "chat_completions",
          "x-test-header": "bridge-ok",
        },
      },
    });

    const pythonResult = spawnSync(
      "python3",
      [
        "-c",
        [
          "import json",
          "from acp_adapter.auth import detect_provider, has_provider",
          "from acp_adapter.session import SessionManager",
          "agent = SessionManager()._make_agent(session_id='session-1', cwd='/tmp/work')",
          "print(json.dumps({",
          "  'provider_detected': detect_provider(),",
          "  'has_provider': has_provider(),",
          "  'init_kwargs': agent.init_kwargs,",
          "  'client_kwargs': agent._client_kwargs,",
          "  'replace_reasons': agent._replace_reasons,",
          "}))",
        ].join("\n"),
      ],
      {
        env,
        encoding: "utf8",
      },
    );

    expect(pythonResult.status).toBe(0);
    const output = JSON.parse(pythonResult.stdout.trim()) as {
      provider_detected: string;
      has_provider: boolean;
      init_kwargs: Record<string, unknown>;
      client_kwargs: Record<string, unknown>;
      replace_reasons: string[];
    };

    expect(output.provider_detected).toBe("nextclaw");
    expect(output.has_provider).toBe(true);
    expect(output.init_kwargs).toEqual(
      expect.objectContaining({
        model: "qwen3.5-plus",
        provider: "custom",
        api_mode: "chat_completions",
        base_url: "http://127.0.0.1:18999/v1",
        api_key: "bridge-key",
      }),
    );
    expect(output.client_kwargs.default_headers).toEqual({
      "x-test-header": "bridge-ok",
    });
    expect(output.replace_reasons).toContain("nextclaw_runtime_route_bridge");
  });
});
