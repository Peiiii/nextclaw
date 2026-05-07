import { EventBus } from "@nextclaw/kernel";
import type { NextClawClient } from "../types/nextclaw-client.types.js";
import type { NextClawClientOptions } from "../types/nextclaw-request.types.js";
import type { NextClawRealtimeSubscription } from "../types/nextclaw-realtime.types.js";
import { normalizeBaseUrl } from "../utils/url.utils.js";
import { AgentsService } from "./agents.service.js";
import { AppService } from "./app.service.js";
import { AuthService } from "./auth.service.js";
import { ChannelAuthService } from "./channel-auth.service.js";
import { ConfigService } from "./config.service.js";
import { MarketplaceService } from "./marketplace.service.js";
import { McpMarketplaceService } from "./mcp-marketplace.service.js";
import { RealtimeService } from "./realtime.service.js";
import { RemoteService } from "./remote.service.js";
import { RequestService } from "./request.service.js";
import { RuntimeControlService } from "./runtime-control.service.js";
import { RuntimeUpdateService } from "./runtime-update.service.js";
import { ServerPathsService } from "./server-paths.service.js";
import { SessionsService } from "./sessions.service.js";

export class NextClawClientService implements NextClawClient {
  readonly baseUrl: string;
  readonly app: AppService;
  readonly agents: AgentsService;
  readonly auth: AuthService;
  readonly channelAuth: ChannelAuthService;
  readonly config: ConfigService;
  readonly eventBus: EventBus;
  readonly marketplace: MarketplaceService;
  readonly mcpMarketplace: McpMarketplaceService;
  readonly realtime: RealtimeService;
  readonly remote: RemoteService;
  readonly runtimeControl: RuntimeControlService;
  readonly runtimeUpdate: RuntimeUpdateService;
  readonly serverPaths: ServerPathsService;
  readonly sessions: SessionsService;

  constructor(options: NextClawClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    const normalizedOptions = {
      ...options,
      baseUrl: this.baseUrl
    };
    const requestService = new RequestService(normalizedOptions);
    this.realtime = new RealtimeService(normalizedOptions);
    let realtimeSubscription: NextClawRealtimeSubscription | null = null;
    this.eventBus = new EventBus({
      onFirstSubscriber: () => {
        realtimeSubscription ??= this.realtime.subscribe((event) => {
          this.eventBus.emitEnvelope({
            type: event.type,
            payload: "payload" in event ? event.payload : undefined,
            emittedAt: "emittedAt" in event ? event.emittedAt : new Date().toISOString(),
            source: "source" in event ? event.source : "realtime"
          });
        });
      },
      onNoSubscribers: () => {
        realtimeSubscription?.close();
        realtimeSubscription = null;
      }
    });
    this.app = new AppService(requestService);
    this.agents = new AgentsService(requestService, this.baseUrl);
    this.auth = new AuthService(requestService);
    this.channelAuth = new ChannelAuthService(requestService);
    this.config = new ConfigService(requestService);
    this.marketplace = new MarketplaceService(requestService);
    this.mcpMarketplace = new McpMarketplaceService(requestService);
    this.remote = new RemoteService(requestService);
    this.runtimeControl = new RuntimeControlService(requestService);
    this.runtimeUpdate = new RuntimeUpdateService(requestService);
    this.serverPaths = new ServerPathsService(requestService);
    this.sessions = new SessionsService(requestService, this.eventBus);
  }
}

export function createNextClawClient(options: NextClawClientOptions): NextClawClientService {
  return new NextClawClientService(options);
}
