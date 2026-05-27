import { EventBus } from "@nextclaw/shared";
import type { NextClawClientOptions } from "./types/nextclaw-request.types.js";
import type { NextClawRealtimeSubscription } from "./types/nextclaw-realtime.types.js";
import { normalizeBaseUrl } from "./utils/url.utils.js";
import { AgentsService } from "./services/agents.service.js";
import { AppService } from "./services/app.service.js";
import { AuthService } from "./services/auth.service.js";
import { ChannelAuthService } from "./services/channel-auth.service.js";
import { ConfigService } from "./services/config.service.js";
import { MarketplaceService } from "./services/marketplace.service.js";
import { McpMarketplaceService } from "./services/mcp-marketplace.service.js";
import { PanelAppsClientService } from "./services/panel-apps.service.js";
import { RealtimeService } from "./services/realtime.service.js";
import { RemoteService } from "./services/remote.service.js";
import { RequestService } from "./services/request.service.js";
import { RuntimeControlService } from "./services/runtime-control.service.js";
import { RuntimeUpdateService } from "./services/runtime-update.service.js";
import { ServerPathsService } from "./services/server-paths.service.js";
import { ServiceAppsClientService } from "./services/service-apps.service.js";
import { SessionsService } from "./services/sessions.service.js";

export class NextClawClient {
  readonly baseUrl: string;
  readonly app: AppService;
  readonly agents: AgentsService;
  readonly auth: AuthService;
  readonly channelAuth: ChannelAuthService;
  readonly config: ConfigService;
  readonly eventBus: EventBus;
  readonly marketplace: MarketplaceService;
  readonly mcpMarketplace: McpMarketplaceService;
  readonly panelApps: PanelAppsClientService;
  readonly realtime: RealtimeService;
  readonly remote: RemoteService;
  readonly runtimeControl: RuntimeControlService;
  readonly runtimeUpdate: RuntimeUpdateService;
  readonly serverPaths: ServerPathsService;
  readonly serviceApps: ServiceAppsClientService;
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
    this.panelApps = new PanelAppsClientService(requestService);
    this.remote = new RemoteService(requestService);
    this.runtimeControl = new RuntimeControlService(requestService);
    this.runtimeUpdate = new RuntimeUpdateService(requestService);
    this.serverPaths = new ServerPathsService(requestService);
    this.serviceApps = new ServiceAppsClientService(requestService);
    this.sessions = new SessionsService(requestService, this.eventBus);
  }
}
