import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

export type AppRuntimeToolStatus = {
  name: string;
  command: string;
  ok: boolean;
  version?: string;
  installHint: string;
  error?: string;
};

export type AppRuntimeDoctorResult = {
  ok: boolean;
  tools: AppRuntimeToolStatus[];
};

export type AppRuntimeCommandResult = {
  stdout: string;
  stderr: string;
};

type RequiredTool = {
  name: string;
  command: string;
  args: string[];
  installHint: string;
};

const REQUIRED_TOOLS: RequiredTool[] = [
  {
    name: "npm",
    command: "npm",
    args: ["--version"],
    installHint: "请安装 Node.js，或使用 NextClaw 桌面版内置运行环境。",
  },
  {
    name: "wasmtime",
    command: "wasmtime",
    args: ["--version"],
    installHint: "请安装 Wasmtime，或使用后续内置 Wasmtime 的 NextClaw 发行包。",
  },
  {
    name: "wkg",
    command: "wkg",
    args: ["--version"],
    installHint: "请安装 Bytecode Alliance wkg；有 Rust/Cargo 时可执行：cargo install wkg --locked。",
  },
];

export class AppRuntimeToolchainService {
  doctor = async (): Promise<AppRuntimeDoctorResult> => {
    const tools = await Promise.all(REQUIRED_TOOLS.map((tool) => this.checkTool(tool)));
    return {
      ok: tools.every((tool) => tool.ok),
      tools,
    };
  };

  assertReadyForWasiHttpBuild = async (): Promise<void> => {
    const result = await this.doctor();
    const missing = result.tools.filter((tool) => !tool.ok);
    if (missing.length === 0) {
      return;
    }
    throw new Error(
      [
        "NApp WASI HTTP 开发环境尚未就绪。",
        ...missing.map((tool) => `- 缺少 ${tool.name}: ${tool.installHint}`),
      ].join("\n"),
    );
  };

  runCommand = async (params: {
    command: string;
    args: string[];
    cwd: string;
  }): Promise<AppRuntimeCommandResult> => {
    const { command, args, cwd } = params;
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return await this.collectProcess(child, command);
  };

  private checkTool = async (tool: RequiredTool): Promise<AppRuntimeToolStatus> => {
    try {
      const result = await this.runCommand({
        command: tool.command,
        args: tool.args,
        cwd: process.cwd(),
      });
      const version = (result.stdout || result.stderr).trim().split(/\r?\n/)[0]?.trim();
      return {
        name: tool.name,
        command: tool.command,
        ok: true,
        version,
        installHint: tool.installHint,
      };
    } catch (error) {
      return {
        name: tool.name,
        command: tool.command,
        ok: false,
        installHint: tool.installHint,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  private collectProcess = async (
    child: ChildProcessByStdio<null, Readable, Readable>,
    command: string,
  ): Promise<AppRuntimeCommandResult> => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
    const stderr = Buffer.concat(stderrChunks).toString("utf-8");
    if (exitCode !== 0) {
      throw new Error(`${command} exited with ${exitCode ?? "unknown"}\n${stderr || stdout}`);
    }
    return {
      stdout,
      stderr,
    };
  };
}
