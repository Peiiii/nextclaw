import type { McpConnectionCreateResult, McpConnectionRequest, McpConnectionTestResult } from "@nextclaw/client-sdk";
import { nextclawClient } from "@/shared/lib/api/managers/client.manager";

export async function testMcpConnection(request: McpConnectionRequest): Promise<McpConnectionTestResult> {
  return await nextclawClient.mcp.testConnection(request);
}

export async function createMcpConnection(request: McpConnectionRequest): Promise<McpConnectionCreateResult> {
  return await nextclawClient.mcp.createConnection(request);
}
