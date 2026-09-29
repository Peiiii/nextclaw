import assert from "node:assert/strict";
import test from "node:test";
import type { getSandbox, Sandbox } from "@cloudflare/sandbox";
import { BiboExecutionService } from "./bibo-execution.service.js";
import type { WorkspaceByteStore } from "@nextclaw/kernel";

class MemoryEnvironmentStorage {
  readonly values = new Map<string, unknown>();
  alarm = 0;
  get = async <T>(key: string): Promise<T | undefined> => structuredClone(this.values.get(key)) as T | undefined;
  put = async (key: string, value: unknown): Promise<void> => { this.values.set(key, structuredClone(value)); };
  delete = async (key: string): Promise<boolean> => this.values.delete(key);
  list = async <T>(options: { prefix: string }): Promise<Map<string, T>> => new Map(
    [...this.values].filter(([key]) => key.startsWith(options.prefix)).map(([key, value]) => [key, structuredClone(value) as T]));
  setAlarm = async (time: number): Promise<void> => { this.alarm = time; };
  asStorage = () => this as unknown as DurableObjectStorage;
}

const workspace = {
  resolve: (path: string) => path === "." ? "/data/workspace" : path.startsWith("/data/workspace")
    ? path : `/data/workspace/${path}`,
  mountPrefix: async (path: string) => path === "/data/workspace" ? "/user/workspace/" : "/user/workspace/notes/",
} as WorkspaceByteStore & { mountPrefix(path: string): Promise<string> };

test("chat does not acquire an OS; commands lazily acquire and reuse one sandbox", async () => {
  let acquired = 0;
  let destroyed = 0;
  const commands: string[] = [];
  const fake = {
    exec: async (command: string) => {
      commands.push(command);
      return { success: true, exitCode: 0, stdout: "ready", stderr: "", command, duration: 1 };
    },
    mountBucket: async () => {},
    destroy: async () => { destroyed += 1; },
  };
  const acquire = (() => { acquired += 1; return fake; }) as unknown as typeof getSandbox;
  const execution = new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, "run-1",
    new AbortController().signal, workspace, new MemoryEnvironmentStorage().asStorage(), acquire);
  const exec = execution.tools().find((tool) => tool.name === "exec")!;

  assert.equal(acquired, 0);
  const first = await exec.execute({ command: "printf ready" });
  await exec.execute({ command: "pwd" });
  assert.equal(acquired, 1);
  assert.deepEqual(commands, ["printf ready", "pwd"]);
  assert.equal(JSON.parse(first as string).workspaceIsTemporary, true);
  await execution.dispose();
  assert.equal(destroyed, 0);
});

test("mount_directory directly uses the persistent R2 prefix without a projection or save step", async () => {
  let acquired = 0;
  const mounts: Array<{ binding: string; path: string; prefix: string }> = [];
  const fake = {
    exec: async (command: string) => ({ exitCode: 0, stdout: command, stderr: "" }),
    mountBucket: async (binding: string, path: string, options: { prefix: string }) => {
      if (mounts.length) throw new Error(`Mount path "${path}" is already in use by bucket "SNAPSHOTS". Unmount the existing bucket first or use a different mount path.`);
      mounts.push({ binding, path, prefix: options.prefix });
    },
    destroy: async () => {},
  };
  const acquire = (() => { acquired += 1; return fake; }) as unknown as typeof getSandbox;
  const execution = new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, "run-2",
    new AbortController().signal, workspace, new MemoryEnvironmentStorage().asStorage(), acquire);
  const [mount, exec] = execution.tools();
  assert.equal(acquired, 0);
  const first = JSON.parse(await mount!.execute({ path: "notes" }) as string) as { path: string };
  assert.equal(first.path, "/mnt/bibo-data/1");
  assert.deepEqual(mounts, [{ binding: "SNAPSHOTS", path: "/mnt/bibo-data/1", prefix: "/user/workspace/notes/" }]);
  await mount!.execute({ path: "notes" });
  assert.equal(mounts.length, 1);
  await exec!.execute({ command: "pwd" });
  assert.equal(acquired, 1);
  await execution.dispose();
});

test("cancelled or invalid exec never acquires an OS", async () => {
  let acquired = 0;
  const acquire = (() => { acquired += 1; throw new Error("unexpected acquire"); }) as unknown as typeof getSandbox;
  const controller = new AbortController();
  controller.abort();
  const execution = new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, "run-3",
    controller.signal, workspace, new MemoryEnvironmentStorage().asStorage(), acquire);
  const exec = execution.tools().find((tool) => tool.name === "exec")!;
  await assert.rejects(exec.execute({ command: "printf ready" }), /cancelled/);
  await assert.rejects(exec.execute({ command: "" }), /1-8000/);
  assert.equal(acquired, 0);
});

test("named environments survive service disposal and remain distinct across chat turns", async () => {
  const storage = new MemoryEnvironmentStorage();
  const ids: string[] = [];
  let destroys = 0;
  const acquire = ((_namespace: unknown, id: string) => {
    ids.push(id);
    return { exec: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      setKeepAlive: async () => {}, destroy: async () => { destroys++; } };
  }) as unknown as typeof getSandbox;
  const create = () => new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, "account-1",
    new AbortController().signal, workspace, storage.asStorage(), acquire);
  const first = create();
  const manage = first.tools().find(tool => tool.name === "execution_environment")!;
  assert.deepEqual(JSON.parse(await manage.execute({ action: "list" }) as string), []);
  assert.equal(ids.length, 0);
  await first.tools()[1]!.execute({ command: "pwd" });
  await first.dispose();
  const second = create();
  await second.tools()[1]!.execute({ command: "pwd" });
  await second.tools()[1]!.execute({ command: "pwd", environment: "second" });
  assert.equal(ids[0], ids[1]);
  assert.notEqual(ids[1], ids[2]);
  assert.equal(destroys, 0);
  await second.tools()[2]!.execute({ action: "release" });
  assert.equal(destroys, 1);
  await second.tools()[1]!.execute({ command: "pwd" });
  assert.notEqual(ids[3], ids[0]);
});

test("background retention is alarm-backed before keepAlive and failed cleanup retains its retry record", async () => {
  const storage = new MemoryEnvironmentStorage();
  let failDestroy = true;
  let processStarts = 0;
  const acquire = (() => ({
    setKeepAlive: async (enabled: boolean) => {
      if (enabled) assert.ok(storage.alarm > Date.now());
      assert.equal(storage.values.size, 1);
    },
    startProcess: async () => { processStarts++; return { id: "process-1", status: "running" }; },
    destroy: async () => { if (failDestroy) throw new Error("temporary cleanup failure"); },
  })) as unknown as typeof getSandbox;
  const execution = new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, "account-1",
    new AbortController().signal, workspace, storage.asStorage(), acquire);
  const tool = execution.tools()[2]!;
  await assert.rejects(tool.execute({ action: "start_process", command: "server", retainMinutes: 0 }), /retainMinutes/);
  assert.equal(storage.values.size, 0);
  const result = JSON.parse(await tool.execute({ action: "start_process", command: "server", retainMinutes: 10 }) as string);
  assert.equal(result.processId, "process-1");
  const renewed = JSON.parse(await tool.execute({ action: "retain", retainMinutes: 20 }) as string);
  assert.ok(renewed.retainUntil > result.retainUntil);
  assert.equal(processStarts, 1);
  const record = storage.values.get("executionEnvironment:default") as { retainUntil: number };
  record.retainUntil = Date.now() - 1000;
  await assert.rejects(execution.reclaimExpired(), /temporary cleanup failure/);
  assert.equal(storage.values.size, 1);
  assert.ok(storage.alarm > Date.now());
  failDestroy = false;
  await execution.reclaimExpired();
  assert.equal(storage.values.size, 0);
});

test("official one-prefix-per-binding limit is reported before attempting a second mount", async () => {
  const storage = new MemoryEnvironmentStorage();
  let mounts = 0;
  const acquire = (() => ({ mountBucket: async () => { mounts++; } })) as unknown as typeof getSandbox;
  const execution = new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, "account-1",
    new AbortController().signal, workspace, storage.asStorage(), acquire);
  await execution.tools()[0]!.execute({ path: "notes" });
  await assert.rejects(execution.tools()[0]!.execute({ path: "other" }), /another directory/);
  assert.equal(mounts, 1);
});
