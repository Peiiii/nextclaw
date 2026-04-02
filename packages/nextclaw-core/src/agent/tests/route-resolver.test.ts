import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/schema.js";
import { AgentRouteResolver, parseAgentScopedSessionKey } from "./route-resolver.js";

describe("AgentRouteResolver", () => {
  it("routes by binding with channel/account/peer", () => {
    const config = ConfigSchema.parse({
      agents: {
        list: [
          { id: "main", default: true },
          { id: "engineer" }
        ]
      },
      bindings: [
        {
          agentId: "engineer",
          match: {
            channel: "discord",
            accountId: "ops",
            peer: {
              kind: "channel",
              id: "c-123"
            }
          }
        }
      ]
    });
    const resolver = new AgentRouteResolver(config);
    const route = resolver.resolveInbound({
      message: {
        channel: "discord",
        senderId: "u-1",
        chatId: "c-123",
        content: "ping",
        timestamp: new Date(),
        attachments: [],
        metadata: {
          account_id: "ops",
          peer_kind: "channel",
          peer_id: "c-123",
          is_group: true
        }
      }
    });

    expect(route.agentId).toBe("engineer");
    expect(route.matchedBy).toBe("binding");
    expect(route.sessionKey).toBe("agent:engineer:discord:channel:c-123");
  });

  it("builds dm session key with per-account-channel-peer scope", () => {
    const config = ConfigSchema.parse({
      agents: {
        list: [{ id: "main", default: true }]
      },
      session: {
        dmScope: "per-account-channel-peer"
      }
    });
    const resolver = new AgentRouteResolver(config);
    const route = resolver.resolveInbound({
      message: {
        channel: "telegram",
        senderId: "user-42",
        chatId: "dm-chat",
        content: "hello",
        timestamp: new Date(),
        attachments: [],
        metadata: {
          account_id: "marketing",
          peer_kind: "direct",
          peer_id: "user-42"
        }
      }
    });

    expect(route.agentId).toBe("main");
    expect(route.sessionKey).toBe("agent:main:telegram:marketing:direct:user-42");
  });

  it("parses agent-scoped session key", () => {
    const parsed = parseAgentScopedSessionKey("agent:engineer:discord:ops:direct:user-9");
    expect(parsed).toEqual({
      agentId: "engineer",
      channel: "discord",
      accountId: "ops",
      peer: {
        kind: "direct",
        id: "user-9"
      }
    });
  });
});
