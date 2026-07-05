import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Config } from "@nextclaw/core";
import { McpClientFactory } from "../client/mcp-client-factory.js";
import {
  buildQualifiedMcpToolName,
  type McpLifecycleState,
  type McpServerRecord,
  type McpToolCatalogEntry
} from "../types.js";

type ActiveConnection = McpLifecycleState & {
  client: Client;
  transport: Transport;
};

export class McpServerLifecycleManager {
  private readonly pendingConnections = new Map<string, Promise<ActiveConnection>>();
  private readonly readyConnections = new Map<string, ActiveConnection>();

  constructor(
    private readonly options: {
      getConfig: () => Config;
      clientFactory?: McpClientFactory;
      now?: () => Date;
    }
  ) {}

  async warmServer(record: McpServerRecord): Promise<McpLifecycleState> {
    const connection = await this.ensureConnection(record);
    return this.stripConnection(connection);
  }

  getCachedCatalog(serverName: string): McpToolCatalogEntry[] {
    return this.readyConnections.get(serverName)?.tools ?? [];
  }

  getCachedState(serverName: string): McpLifecycleState | undefined {
    const ready = this.readyConnections.get(serverName);
    if (!ready) {
      return undefined;
    }
    return this.stripConnection(ready);
  }

  async callTool(
    record: McpServerRecord,
    toolName: string,
    args: Record<string, unknown>,
    options: { signal?: AbortSignal } = {},
  ): Promise<unknown> {
    const connection = await this.ensureConnection(record);
    const result = await connection.client.callTool({
      name: toolName,
      arguments: args
    }, undefined, { signal: options.signal });
    return this.normalizeToolResult(result);
  }

  async closeAll(): Promise<void> {
    const pending = await Promise.allSettled(this.pendingConnections.values());
    for (const result of pending) {
      if (result.status === "fulfilled") {
        this.readyConnections.set(result.value.record.name, result.value);
      }
    }
    for (const connection of this.readyConnections.values()) {
      await connection.transport.close().catch(() => {});
    }
    this.pendingConnections.clear();
    this.readyConnections.clear();
  }

  async closeServer(serverName: string): Promise<void> {
    const ready = this.readyConnections.get(serverName);
    this.readyConnections.delete(serverName);

    const pending = this.pendingConnections.get(serverName);
    this.pendingConnections.delete(serverName);

    if (ready) {
      await ready.transport.close().catch(() => {});
    }

    if (!pending) {
      return;
    }

    const result = await Promise.allSettled([pending]);
    const settled = result[0];
    if (settled?.status === "fulfilled") {
      await settled.value.transport.close().catch(() => {});
    }
    this.readyConnections.delete(serverName);
    this.pendingConnections.delete(serverName);
  }

  private async ensureConnection(record: McpServerRecord): Promise<ActiveConnection> {
    const ready = this.readyConnections.get(record.name);
    if (ready) {
      return ready;
    }

    const existing = this.pendingConnections.get(record.name);
    if (existing) {
      return existing;
    }

    const task = this.connect(record);
    this.pendingConnections.set(record.name, task);

    try {
      const connection = await task;
      this.readyConnections.set(record.name, connection);
      this.pendingConnections.delete(record.name);
      return connection;
    } catch (error) {
      this.pendingConnections.delete(record.name);
      throw error;
    }
  }

  private async connect(record: McpServerRecord): Promise<ActiveConnection> {
    const config = this.options.getConfig();
    const clientFactory = this.options.clientFactory ?? new McpClientFactory(config);
    const { client, transport } = clientFactory.create(record);
    await client.connect(transport);
    const listedTools = await client.listTools();
    const tools = listedTools.tools.map((tool) => ({
      qualifiedName: buildQualifiedMcpToolName(record.name, tool.name),
      serverName: record.name,
      toolName: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }));
    const now = (this.options.now ?? (() => new Date()))().toISOString();
    return {
      record,
      tools,
      clientReady: true,
      lastReadyAt: now,
      client,
      transport
    };
  }

  private stripConnection(connection: ActiveConnection): McpLifecycleState {
    return {
      record: connection.record,
      tools: connection.tools,
      clientReady: connection.clientReady,
      lastReadyAt: connection.lastReadyAt,
      lastError: connection.lastError
    };
  }

  private normalizeToolResult(result: CallToolResult | { toolResult: unknown }): unknown {
    if ("toolResult" in result) {
      return result.toolResult;
    }
    return {
      content: result.content,
      structuredContent: result.structuredContent,
      isError: result.isError ?? false
    };
  }
}
