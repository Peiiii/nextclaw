import type { McpServerDefinition } from "@nextclaw/core";

export type McpConnectionRequest = {
  name: string;
  definition: McpServerDefinition;
};

export type McpConnectionTestResult = {
  name: string;
  transport: McpServerDefinition["transport"]["type"];
  accessible: boolean;
  toolCount: number;
  error?: string;
};

export type McpConnectionCreateResult = {
  name: string;
  transport: McpServerDefinition["transport"]["type"];
  message: string;
};
