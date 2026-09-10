import { ResourceToolProvider } from "@kernel/contributions/tool-provider/index.js";
import { createSkillResourceProvider } from "@kernel/utils/skill-resource-provider.utils.js";
import { createAgentResourceProvider, createProjectResourceProvider, createServiceAppResourceProvider, createMcpResourceProvider, createProjectWorkResourceProvider } from "@kernel/utils/catalog-resource-providers.utils.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EventBus, SYSTEM_OBJECT_TYPE_CRON_JOB, SYSTEM_OBJECT_TYPE_INBOX_DELIVERY } from "@nextclaw/shared";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import {
  createCronJobSystemObjectProvider,
  createInboxDeliverySystemObjectProvider,
  SystemObjectReferenceManager,
} from "@kernel/managers/system-object-reference.manager.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-system-object-"));
  tempDirs.push(directory);
  const inbox = new InboxDeliveryManager({
    eventBus: new EventBus(),
    storePath: join(directory, "inbox.json"),
  });
  const cronJob = {
    id: "cron-1",
    name: "Daily review",
    enabled: true,
    schedule: { kind: "cron" as const, expr: "0 9 * * *", tz: "Asia/Shanghai" },
    payload: { kind: "agent_turn" as const, message: "Review unread reports", agentId: "main" },
    state: { nextRunAtMs: Date.parse("2026-08-12T01:00:00.000Z") },
    createdAtMs: Date.parse("2026-08-10T00:00:00.000Z"),
    updatedAtMs: Date.parse("2026-08-11T00:00:00.000Z"),
    deleteAfterRun: false,
  };
  const automation = { listJobs: () => [cronJob] };
  const assetStore = new LocalAssetStore({ rootDir: join(directory, "assets") });
  const manager = new SystemObjectReferenceManager(assetStore, [
    createInboxDeliverySystemObjectProvider(inbox),
    createCronJobSystemObjectProvider(automation as never),
  ]);
  return { assetStore, cronJob, inbox, manager };
}

describe("SystemObjectReferenceManager", () => {
  it("exposes the same exact URIs and immutable snapshots to AI tools", async () => {
    const { manager, assetStore } = await createFixture();
    const tools = new ResourceToolProvider(manager).provide();
    const list = tools.find(tool => tool.name === "resource_list")!;
    const resolve = tools.find(tool => tool.name === "resource_resolve")!;
    const catalog = await list.execute({ objectType: "cron-job" }) as Awaited<ReturnType<typeof manager.listReferences>>;
    const uri = catalog.groups[0].items[0].uri;
    expect(uri).toBe("nextclaw://objects/cron-job/cron-1");
    const reference = await resolve.execute({ uri }) as Awaited<ReturnType<typeof manager.resolveReference>>;
    expect((await assetStore.readAssetBytes(reference.assetUri))?.toString("utf8")).toContain("Daily review");
    await expect(resolve.execute({ uri: "nextclaw://objects/cron-job/missing" })).rejects.toThrow();
    await expect(list.execute({ limit: 51 })).rejects.toThrow();
    await expect(list.execute({ objectType: 1 })).rejects.toThrow();
  });

  it("returns provider-owned groups for browsing and grouped results for search", async () => {
    const { inbox, manager } = await createFixture();
    await inbox.createDelivery({
      title: "OOM investigation",
      summary: "Memory pressure report",
      content: "# Root cause\n\nJournal expansion",
      contentType: "markdown",
      source: { kind: "agent", agentId: "main", sessionId: null, toolCallId: null, filePath: null },
    });

    await expect(manager.listReferences()).resolves.toMatchObject({
      total: 2,
      groups: [
        expect.objectContaining({
          objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
          icon: "inbox",
          items: [],
          total: 1,
        }),
        expect.objectContaining({
          objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
          icon: "calendar-clock",
          items: [],
          total: 1,
        }),
      ],
    });
    await expect(manager.listReferences({ query: "unread" })).resolves.toMatchObject({
      total: 1,
      groups: [{
        objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
        items: [expect.objectContaining({ objectType: SYSTEM_OBJECT_TYPE_CRON_JOB })],
        total: 1,
      }],
    });
    await expect(manager.listReferences({
      objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
    })).resolves.toMatchObject({
      groups: [{
        objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
        items: [expect.objectContaining({ label: "OOM investigation" })],
        total: 1,
      }],
    });
  });

  it("applies the result limit independently inside each provider group", async () => {
    const { inbox, manager } = await createFixture();
    await inbox.createDelivery({
      title: "Daily inbox review",
      summary: "Review the inbox",
      content: "Inbox",
      contentType: "markdown",
      source: { kind: "agent", agentId: "main", sessionId: null, toolCallId: null, filePath: null },
    });

    const result = await manager.listReferences({ query: "review", limit: 1 });

    expect(result.groups).toEqual([
      expect.objectContaining({
        objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
        items: [expect.objectContaining({ label: "Daily inbox review" })],
      }),
      expect.objectContaining({
        objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
        items: [expect.objectContaining({ label: "Daily review" })],
      }),
    ]);
  });

  it("materializes immutable content-addressed snapshots and reuses the same version", async () => {
    const { assetStore, inbox, manager } = await createFixture();
    const report = await inbox.createDelivery({
      title: "OOM investigation",
      summary: "Memory pressure report",
      content: "# Root cause\n\nJournal expansion",
      contentType: "markdown",
      source: { kind: "agent", agentId: "main", sessionId: null, toolCallId: null, filePath: null },
    });
    const [{ uri }] = (await manager.listReferences({ query: report.title })).groups[0]!.items;

    const first = await manager.resolveReference(uri);
    const second = await manager.resolveReference(uri);
    const bytes = await assetStore.readAssetBytes(first.assetUri);

    expect(second).toEqual(first);
    expect(first.version).toMatch(/^[a-f0-9]{64}$/);
    expect(bytes?.toString("utf8")).toContain("Journal expansion");
  });

  it("exports a scheduled task snapshot through the same resolver", async () => {
    const { assetStore, manager } = await createFixture();
    const [{ uri }] = (await manager.listReferences({ query: "Daily review" })).groups[0]!.items;
    const reference = await manager.resolveReference(uri);
    const bytes = await assetStore.readAssetBytes(reference.assetUri);

    expect(reference).toMatchObject({
      objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
      mimeType: "text/markdown",
    });
    expect(bytes?.toString("utf8")).toContain("0 9 * * *");
    expect(bytes?.toString("utf8")).toContain("Review unread reports");
  });
});

describe("resource catalog providers", () => {
  it("includes exact project skill refs without treating other paths as installed skills", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-project-skill-resource-"));
    tempDirs.push(directory);
    await writeFile(join(directory, "SKILL.md"), "# Project skill");
    const provider = createSkillResourceProvider({ listSkills: () => [] } as never, {
      projects: { listProjects: async () => [{ id:"p1",rootPath:directory }] } as never,
      materials: { listSkills: async () => [{ ref:"project:exact",name:"Project skill",path:"SKILL.md" }] } as never,
    });
    expect(await provider.resolve("project:exact")).toMatchObject({ content:"# Project skill" });
    expect(await provider.resolve("/arbitrary/private/SKILL.md")).toBeNull();
  });
  it("omits service and MCP credentials and keeps project work identity unambiguous", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-private-resource-"));
    tempDirs.push(directory);
    const path = join(directory, "config.json"); await writeFile(path, "{}");
    const service = createServiceAppResourceProvider({ listServiceApps: async () => ({ entries:[{ id:"app",title:"App",manifestPath:path,enabled:true,status:"ready",protocol:"stdio",args:["secret-value"] }] }) } as never);
    expect(JSON.stringify(await service.resolve("app"))).not.toContain("secret-value");
    const mcp = createMcpResourceProvider({ listServers: () => [{ name:"server",definition:{ enabled:true,transport:{ type:"http",url:"https://private/?key=secret-value",headers:{ Authorization:"secret-value" } } } }] } as never, path);
    expect(JSON.stringify(await mcp.resolve("server"))).not.toContain("secret-value");
    expect(await mcp.resolve("missing")).toBeNull();
    const item = { id:"item/1",projectId:"project/1",title:"Work",description:"Body",stateId:"todo",attention:"none",updatedAt:"2026-09-11T00:00:00Z",deletedAt:null };
    const work = createProjectWorkResourceProvider({ listProjects:async()=>[{ id:"project/1" }],getProjectById:async(id:string)=>id==="project/1"?{ id }:null } as never, { list:async()=>({ items:[item],nextCursor:null }),get:async()=>item } as never);
    const id = JSON.stringify([item.projectId,item.id]);
    expect(await work.resolve(id)).toMatchObject({ item:{ objectId:id,label:"Work" } });
    expect(await work.resolve("project/1/item/1")).toBeNull();
    expect(await work.list()).toHaveLength(1);
  });

  it("keeps malformed Skill frontmatter readable without breaking the catalog or confusing same-name refs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-skill-resource-"));
    tempDirs.push(directory);
    const path = join(directory, "SKILL.md");
    const raw = "---\ndescription: invalid: yaml\n---\n# Original skill";
    await writeFile(path, raw);
    const skill = { ref: "project:example", name: "example", path };
    const provider = createSkillResourceProvider({
      listSkills: () => [skill],
      getSkillInfo: (ref: string) => ref === skill.ref ? skill : null,
    } as never);
    expect(await provider.list()).toMatchObject([{ uri: "nextclaw://objects/skill/project%3Aexample", label: "example" }]);
    expect(await provider.resolve(skill.ref)).toMatchObject({ content: raw, mimeType: "text/markdown" });
    expect(await provider.resolve("example")).toBeNull();
  });
  it("exposes only safe agent identity fields and registered project identity", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-catalog-resource-"));
    tempDirs.push(directory);
    const configPath = join(directory, "config.json");
    await writeFile(configPath, "{}");
    const agent = { id: "main", displayName: "Main", workspace: directory, runtimeConfig: { apiKey: "private-test-secret" } };
    const agents = createAgentResourceProvider({ getAgent: () => agent, listAgents: () => [agent] } as never, configPath);
    expect(JSON.stringify(await agents.resolve("main"))).not.toContain("private-test-secret");
    const project = { id: "project-1", name: "Example", rootPath: directory, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z" };
    const projects = createProjectResourceProvider({ listProjects: async () => [project], getProjectById: async (id: string) => id === project.id ? project : null } as never);
    expect(await projects.list()).toMatchObject([{ uri: "nextclaw://objects/project/project-1" }]);
    expect(await projects.resolve("missing")).toBeNull();
  });
});
