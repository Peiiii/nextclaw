import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { HostIncidentStore } from "@nextclaw/core";

const GUARDIAN_ENV = "NEXTCLAW_DESKTOP_GUARDIAN";
const GUARDED_ENV = "NEXTCLAW_DESKTOP_GUARDED";
const EXECUTABLE_ENV = "NEXTCLAW_DESKTOP_EXECUTABLE";
const MAX_RESTART_ATTEMPTS = 3;

export type DesktopGuardianLaunchOptions = {
  enabled: boolean;
  executablePath: string;
  guardianScriptPath: string;
  runtimeHome: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  spawnProcess?: typeof spawn;
};

export function shouldLaunchDesktopGuardian(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): boolean {
  return platform === "win32"
    && env[GUARDIAN_ENV] !== "1"
    && env[GUARDED_ENV] !== "1"
    && env.NEXTCLAW_DESKTOP_DISABLE_GUARDIAN !== "1";
}

export function launchDesktopGuardian(options: DesktopGuardianLaunchOptions): boolean {
  const {
    enabled,
    env: inputEnv,
    executablePath,
    guardianScriptPath,
    platform,
    runtimeHome,
    spawnProcess = spawn
  } = options;
  if (!enabled || !shouldLaunchDesktopGuardian(inputEnv, platform)) {
    return false;
  }
  const env: NodeJS.ProcessEnv = {
    ...(inputEnv ?? process.env),
    ELECTRON_RUN_AS_NODE: "1",
    [GUARDIAN_ENV]: "1",
    [EXECUTABLE_ENV]: executablePath,
    NEXTCLAW_HOME: runtimeHome
  };
  delete env[GUARDED_ENV];
  const child = spawnProcess(executablePath, [guardianScriptPath], {
    detached: true,
    env,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createGuardedChild(executablePath: string, runId: string, attempt: number): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, [GUARDED_ENV]: "1", NEXTCLAW_DESKTOP_RUN_ID: runId, NEXTCLAW_DESKTOP_GUARDIAN_ATTEMPT: String(attempt) };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env[GUARDIAN_ENV];
  return spawn(executablePath, [], { env, stdio: "ignore", windowsHide: true });
}

export async function runDesktopGuardian(options: {
  executablePath?: string;
  store?: HostIncidentStore;
  spawnChild?: (executablePath: string, runId: string, attempt: number) => ChildProcess;
  delayMs?: (ms: number) => Promise<void>;
} = {}): Promise<void> {
  const executablePath = options.executablePath ?? process.env[EXECUTABLE_ENV];
  if (!executablePath) {
    return;
  }
  const store = options.store ?? new HostIncidentStore();
  const spawnChild = options.spawnChild ?? createGuardedChild;
  const wait = options.delayMs ?? delay;
  let restartAttempt = 0;

  while (true) {
    const runId = randomUUID();
    const child = spawnChild(executablePath, runId, restartAttempt);
    const [code, signal] = await once(child, "exit") as [number | null, NodeJS.Signals | null];
    const evidence = {
      source: "guardian",
      kind: "guardian.main-exited",
      observedAt: new Date().toISOString(),
      facts: { code, signal, restartAttempt }
    } as const;
    const activeRun = store.getActiveRun();
    const recordedRun = store.recordRunEvidence(runId, evidence);
    if (!recordedRun) {
      store.recordGuardianPreflightExit({ runId, observedAt: evidence.observedAt, evidence });
    }

    if (activeRun?.runId === runId && (activeRun.exitIntent || activeRun.terminal?.outcome === "controlled-exit")) {
      return;
    }

    restartAttempt += 1;
    if (restartAttempt > MAX_RESTART_ATTEMPTS) {
      store.recordRunEvidence(runId, {
        source: "guardian",
        kind: "guardian.recovery-backing-off",
        observedAt: new Date().toISOString(),
        facts: { attempt: restartAttempt - 1 }
      });
      return;
    }

    store.recordRunEvidence(runId, {
      source: "guardian",
      kind: "guardian.recovery-restarted",
      observedAt: new Date().toISOString(),
      facts: { attempt: restartAttempt }
    });
    await wait(Math.min(15_000, 500 * (2 ** (restartAttempt - 1))));
  }
}

if (process.env[GUARDIAN_ENV] === "1") {
  void runDesktopGuardian();
}
