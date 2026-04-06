import type { Context } from "hono";
import { createAgent, deleteAgent, listAgents, readAgentAvatar } from "../agents.js";
import type { AgentCreateRequest } from "../types.js";
import { err, ok, readJson } from "./response.js";
import type { UiRouterOptions } from "./types.js";

export class AgentsRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  private publishAgentUpdates = async (paths: string[]): Promise<void> => {
    for (const path of paths) {
      this.options.publish({ type: "config.updated", payload: { path } });
    }
    await this.options.applyLiveConfigReload?.();
  };

  readonly listAgents = (c: Context) => {
    return c.json(ok({ agents: listAgents(this.options.configPath) }));
  };

  readonly createAgent = async (c: Context) => {
    const body = await readJson<AgentCreateRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    try {
      const agent = createAgent(this.options.configPath, body.data, {
        initializeAgentHomeDirectory: this.options.initializeAgentHomeDirectory
      });
      await this.publishAgentUpdates(["agents.list"]);
      return c.json(ok(agent));
    } catch (error) {
      return c.json(err("AGENT_CREATE_FAILED", error instanceof Error ? error.message : String(error)), 400);
    }
  };

  readonly deleteAgent = async (c: Context) => {
    const agentId = c.req.param("agentId");
    try {
      const result = deleteAgent(this.options.configPath, agentId);
      if (!result) {
        return c.json(err("NOT_FOUND", `agent not found: ${agentId}`), 404);
      }
      await this.publishAgentUpdates(["agents.list"]);
      return c.json(ok(result));
    } catch (error) {
      return c.json(err("AGENT_DELETE_FAILED", error instanceof Error ? error.message : String(error)), 400);
    }
  };

  readonly getAgentAvatar = (c: Context): Response => {
    const agentId = c.req.param("agentId");
    try {
      const avatar = readAgentAvatar(this.options.configPath, agentId);
      if (!avatar) {
        return c.json(err("NOT_FOUND", `avatar not found for agent: ${agentId}`), 404);
      }
      return new Response(avatar.bytes, {
        headers: {
          "content-type": avatar.mimeType,
          "cache-control": "public, max-age=300"
        }
      });
    } catch (error) {
      return c.json(err("AGENT_AVATAR_FAILED", error instanceof Error ? error.message : String(error)), 400);
    }
  };
}
