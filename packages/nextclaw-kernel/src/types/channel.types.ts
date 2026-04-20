import type { ChannelId } from "./entity-ids.types.js";

export type ChannelDirection = "inbound" | "outbound" | "bidirectional";

export type ChannelRecord = {
  id: ChannelId;
  name: string;
  enabled: boolean;
  direction: ChannelDirection;
  metadata: Record<string, unknown>;
};
