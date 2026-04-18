import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildHermesAcpBridgeLaunchEnv,
  isHermesAcpRuntimeConfig,
} from "./hermes-acp-route-bridge.utils.js";

const tempDirs: string[] = [];
const packageDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const expectedSourceBridgeDir = join(packageDir, "src", "hermes-acp-route-bridge");

function createHermesAcpConfig() {
  return {
    command: "hermes",
    args: ["acp"],
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
      "from dataclasses import dataclass, field",
      "import threading",
      "import uuid",
      "",
      "_last_registered_task = None",
      "",
      "def _register_task_cwd(session_id, cwd):",
      "    global _last_registered_task",
      "    _last_registered_task = {\"session_id\": session_id, \"cwd\": cwd}",
      "",
      "def _acp_stderr_print(*args, **kwargs):",
      "    return None",
      "",
      "@dataclass",
      "class SessionState:",
      "    session_id: str",
      "    agent: object",
      "    cwd: str = '.'",
      "    model: str = ''",
      "    history: list = field(default_factory=list)",
      "    cancel_event: object = None",
      "",
      "class SessionManager:",
      "    def __init__(self, agent_factory=None):",
      "        self._agent_factory = agent_factory",
      "        self._sessions = {}",
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
      "    def create_session(self, cwd='.'):",
      "        session_id = str(uuid.uuid4())",
      "        agent = self._make_agent(session_id=session_id, cwd=cwd)",
      "        state = SessionState(",
      "            session_id=session_id,",
      "            agent=agent,",
      "            cwd=cwd,",
      "            model=getattr(agent, 'model', '') or '',",
      "            cancel_event=threading.Event(),",
      "        )",
      "        self._sessions[session_id] = state",
      "        return state",
      "",
      "    def get_session(self, session_id):",
      "        return self._sessions.get(session_id)",
      "",
      "    def save_session(self, session_id):",
      "        return None",
      "",
      "    def remove_session(self, session_id):",
      "        return self._sessions.pop(session_id, None) is not None",
      "",
      "    def cleanup(self):",
      "        self._sessions = {}",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(rootDir, "acp_adapter", "server.py"),
    [
      "from acp_adapter.session import SessionManager",
      "",
      "class HermesACPAgent:",
      "    def __init__(self, session_manager=None):",
      "        self.session_manager = session_manager or SessionManager()",
      "",
      "    async def prompt(self, prompt, session_id, **kwargs):",
      "        state = self.session_manager.get_session(session_id)",
      "        if state is None:",
      "            return {\"missing\": True}",
      "        if getattr(state.agent, '_cached_system_prompt', None) is None and hasattr(state.agent, '_build_system_prompt'):",
      "            state.agent._cached_system_prompt = state.agent._build_system_prompt()",
      "        return {",
      "            \"model\": getattr(state.agent, \"model\", \"\"),",
      "            \"provider\": getattr(state.agent, \"provider\", \"\"),",
      "            \"base_url\": getattr(state.agent, \"base_url\", \"\"),",
      "            \"api_mode\": getattr(state.agent, \"api_mode\", \"\"),",
      "            \"api_key\": state.agent._client_kwargs.get(\"api_key\", \"\"),",
      "            \"default_headers\": state.agent._client_kwargs.get(\"default_headers\", {}),",
      "            \"cached_system_prompt\": getattr(state.agent, '_cached_system_prompt', None),",
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
      "        self.platform = kwargs.get(\"platform\", \"\")",
      "        self.enabled_toolsets = list(kwargs.get(\"enabled_toolsets\", []))",
      "        self.disabled_toolsets = []",
      "        self.tools = [{\"name\": \"terminal\"}]",
      "        self.valid_tool_names = {\"terminal\"}",
      "        self.client = object()",
      "        self._anthropic_client = _AnthropicClient() if self.api_mode == \"anthropic_messages\" else None",
      "        self._replace_reasons = []",
      "        self.thinking_callback = None",
      "        self.reasoning_callback = None",
      "        self._cached_system_prompt = None",
      "",
      "    def _replace_primary_openai_client(self, *, reason):",
      "        self._replace_reasons.append(reason)",
      "        return True",
      "",
      "    def _build_system_prompt(self):",
      "        return f'Model: {self.model}\\nProvider: {self.provider}'",
      "",
      "    def run_conversation(self, **kwargs):",
      "        self._last_run_state = {",
      "            \"thinking_is_none\": self.thinking_callback is None,",
      "            \"reasoning_is_callable\": callable(self.reasoning_callback),",
      "        }",
      "        if callable(self.thinking_callback):",
      "            self.thinking_callback(\"(⌐■_■) computing...\")",
      "        if callable(self.reasoning_callback):",
      "            self.reasoning_callback(\"real reasoning\")",
      "        return self._last_run_state",
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

describe("buildHermesAcpBridgeLaunchEnv", () => {
  it("injects a synthetic route for hermes acp probes", () => {
    const env = buildHermesAcpBridgeLaunchEnv({
      ...createHermesAcpConfig(),
      useProbeRoute: true,
      baseEnv: {},
    });
    expect(env.NEXTCLAW_MODEL).toBe("nextclaw-hermes-acp-probe");
    expect(env.NEXTCLAW_API_BASE).toBe("http://127.0.0.1:1/v1");
    expect(env.NEXTCLAW_API_KEY).toBe("nextclaw-hermes-acp-probe-key");
    expect(env.NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE).toBe("1");
    expect(env.PYTHONPATH).toContain("hermes-acp-route-bridge");
  });

  it("prefers the source bridge directory when the workspace package is available", () => {
    const env = buildHermesAcpBridgeLaunchEnv({
      ...createHermesAcpConfig(),
      baseEnv: {},
    });

    expect(env.NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE_DIR).toBe(expectedSourceBridgeDir);
    expect(env.PYTHONPATH?.split(":")[0]).toBe(expectedSourceBridgeDir);
  });
});

describe("Hermes ACP bridge sitecustomize session agents", () => {
  it("creates Hermes session agents from the NextClaw RuntimeRoute with a live tool surface", () => {
    const fakeHermesRoot = createTempDir("nextclaw-hermes-acp-fake-");
    seedFakeHermesPythonPackage(fakeHermesRoot);
    const env = buildHermesAcpBridgeLaunchEnv({
      ...createHermesAcpConfig(),
      baseEnv: {
        ...process.env,
        PYTHONPATH: fakeHermesRoot,
      },
    });
    env.NEXTCLAW_MODEL = "qwen3.5-plus";
    env.NEXTCLAW_API_BASE = "http://127.0.0.1:18999/v1";
    env.NEXTCLAW_API_KEY = "bridge-key";
    env.NEXTCLAW_HEADERS_JSON = JSON.stringify({
      "x-nextclaw-narp-api-mode": "chat_completions",
      "x-test-header": "bridge-ok",
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
          "  'model': getattr(agent, 'model', ''),",
          "  'provider': getattr(agent, 'provider', ''),",
          "  'base_url': getattr(agent, 'base_url', ''),",
          "  'api_mode': getattr(agent, 'api_mode', ''),",
          "  'has_client_kwargs': hasattr(agent, '_client_kwargs'),",
          "  'tool_count': len(getattr(agent, 'tools', [])),",
          "  'valid_tool_names': sorted(getattr(agent, 'valid_tool_names', set())),",
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
      model: string;
      provider: string;
      base_url: string;
      api_mode: string;
      has_client_kwargs: boolean;
      tool_count: number;
      valid_tool_names: string[];
    };

    expect(output.provider_detected).toBe("nextclaw");
    expect(output.has_provider).toBe(true);
    expect(output).toEqual({
      provider_detected: "nextclaw",
      has_provider: true,
      model: "qwen3.5-plus",
      provider: "custom",
      base_url: "http://127.0.0.1:18999/v1",
      api_mode: "chat_completions",
      has_client_kwargs: true,
      tool_count: 1,
      valid_tool_names: ["terminal"],
    });
  });
});

describe("Hermes ACP bridge sitecustomize reasoning mapping", () => {
  it("remaps ACP thinking callbacks onto reasoning during agent runs", () => {
    const fakeHermesRoot = createTempDir("nextclaw-hermes-acp-reasoning-");
    seedFakeHermesPythonPackage(fakeHermesRoot);
    const env = buildHermesAcpBridgeLaunchEnv({
      ...createHermesAcpConfig(),
      baseEnv: {
        ...process.env,
        PYTHONPATH: fakeHermesRoot,
      },
    });

    const pythonResult = spawnSync(
      "python3",
      [
        "-c",
        [
          "import json",
          "from run_agent import AIAgent",
          "captured = []",
          "agent = AIAgent(platform='acp')",
          "agent.thinking_callback = lambda text: captured.append(text)",
          "agent.reasoning_callback = None",
          "run_state = agent.run_conversation(user_message='hi', conversation_history=[], task_id='task-1')",
          "print(json.dumps({",
          "  'captured': captured,",
          "  'run_state': run_state,",
          "  'thinking_restored': callable(agent.thinking_callback),",
          "  'reasoning_restored': agent.reasoning_callback is None,",
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
      captured: string[];
      run_state: {
        thinking_is_none: boolean;
        reasoning_is_callable: boolean;
      };
      thinking_restored: boolean;
      reasoning_restored: boolean;
    };

    expect(output.captured).toEqual(["real reasoning"]);
    expect(output.run_state).toEqual({
      thinking_is_none: true,
      reasoning_is_callable: true,
    });
    expect(output.thinking_restored).toBe(true);
    expect(output.reasoning_restored).toBe(true);
  });
});

describe("Hermes ACP bridge sitecustomize prompt-routed execution", () => {
  it("rebuilds the Hermes execution agent from the prompt route without dropping tools", () => {
    const fakeHermesRoot = createTempDir("nextclaw-hermes-acp-prompt-route-");
    seedFakeHermesPythonPackage(fakeHermesRoot);
    const env = buildHermesAcpBridgeLaunchEnv({
      ...createHermesAcpConfig(),
      baseEnv: {
        ...process.env,
        PYTHONPATH: fakeHermesRoot,
      },
    });
    env.NEXTCLAW_MODEL = "MiniMax-M2.7";
    env.NEXTCLAW_API_BASE = "https://api.minimaxi.com/v1";
    env.NEXTCLAW_API_KEY = "minimax-key";
    env.NEXTCLAW_HEADERS_JSON = JSON.stringify({
      "x-nextclaw-narp-api-mode": "chat_completions",
      "x-minimax-group-id": "group-123",
    });

    const pythonResult = spawnSync(
      "python3",
      [
        "-c",
        [
          "import asyncio",
          "import json",
          "from acp_adapter.server import HermesACPAgent",
          "",
          "agent = HermesACPAgent()",
          "state = agent.session_manager.create_session(cwd='/tmp/work')",
          "result = asyncio.run(agent.prompt(",
          "  prompt=[],",
          "  session_id=state.session_id,",
          "  _meta={",
          "    'nextclaw_narp': {",
          "      'providerRoute': {",
          "        'model': 'qwen3.6-plus',",
          "        'apiBase': 'https://dashscope.aliyuncs.com/compatible-mode/v1',",
          "        'apiKey': 'dashscope-key',",
          "        'headers': {",
          "          'x-nextclaw-narp-api-mode': 'chat_completions',",
          "          'x-dashscope-workspace': 'workspace-456'",
          "        }",
          "      }",
          "    }",
          "  }",
          "))",
          "restored = agent.session_manager.get_session(state.session_id)",
          "print(json.dumps({",
          "  'result': result,",
          "  'persisted': {",
          "    'model': getattr(restored.agent, 'model', ''),",
          "    'provider': getattr(restored.agent, 'provider', ''),",
          "    'base_url': getattr(restored.agent, 'base_url', ''),",
          "    'api_mode': getattr(restored.agent, 'api_mode', ''),",
          "    'has_client_kwargs': hasattr(restored.agent, '_client_kwargs'),",
          "    'cached_system_prompt': getattr(restored.agent, '_cached_system_prompt', None),",
          "    'tool_count': len(getattr(restored.agent, 'tools', [])),",
          "    'valid_tool_names': sorted(getattr(restored.agent, 'valid_tool_names', set()))",
          "  }",
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
      result: {
        model: string;
        provider: string;
        base_url: string;
        api_mode: string;
        api_key: string;
        default_headers: Record<string, string>;
        cached_system_prompt: string | null;
      };
      persisted: {
        model: string;
        provider: string;
        base_url: string;
        api_mode: string;
        has_client_kwargs: boolean;
        cached_system_prompt?: string | null;
        tool_count: number;
        valid_tool_names: string[];
      };
    };

    expect(output).toEqual({
      result: {
        model: "qwen3.6-plus",
        provider: "custom",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_mode: "chat_completions",
        api_key: "dashscope-key",
        default_headers: {
          "x-dashscope-workspace": "workspace-456",
        },
        cached_system_prompt: "Model: qwen3.6-plus\nProvider: custom",
      },
      persisted: {
        model: "qwen3.6-plus",
        provider: "custom",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_mode: "chat_completions",
        has_client_kwargs: true,
        cached_system_prompt: "Model: qwen3.6-plus\nProvider: custom",
        tool_count: 1,
        valid_tool_names: ["terminal"],
      },
    });
  });
});
