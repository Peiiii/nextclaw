import type {
  McpConnectionCreateResult,
  McpConnectionRequest,
  McpConnectionTestResult,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class McpService {
  constructor(private readonly requestService: RequestService) {}

  readonly testConnection = async (request: McpConnectionRequest): Promise<McpConnectionTestResult> => {
    return await this.requestService.post<McpConnectionTestResult>("/api/mcp/servers/test", request);
  };

  readonly createConnection = async (request: McpConnectionRequest): Promise<McpConnectionCreateResult> => {
    return await this.requestService.post<McpConnectionCreateResult>("/api/mcp/servers", request);
  };
}
