import type * as NextclawCore from "@nextclaw/core";
import type { UiAuthService } from "../auth.service.js";
import type {
  MarketplaceApiConfig,
  RemoteAccessView,
  RemoteDoctorView,
  RemoteLoginRequest,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteSettingsUpdateRequest,
  UiChatRuntime,
  UiNcpAgent,
  UiServerEvent
} from "../types.js";

export type UiRouterOptions = {
  configPath: string;
  productVersion?: string;
  publish: (event: UiServerEvent) => void;
  marketplace?: MarketplaceApiConfig;
  cronService?: InstanceType<typeof NextclawCore.CronService>;
  chatRuntime?: UiChatRuntime;
  ncpAgent?: UiNcpAgent;
  authService?: UiAuthService;
  remoteAccess?: UiRemoteAccessHost;
};

export type UiRemoteAccessHost = {
  getStatus: () => Promise<RemoteAccessView> | RemoteAccessView;
  login: (input: RemoteLoginRequest) => Promise<RemoteAccessView>;
  logout: () => Promise<RemoteAccessView> | RemoteAccessView;
  updateSettings: (input: RemoteSettingsUpdateRequest) => Promise<RemoteAccessView> | RemoteAccessView;
  runDoctor: () => Promise<RemoteDoctorView>;
  controlService: (action: RemoteServiceAction) => Promise<RemoteServiceActionResult>;
};

export type CronJobEntry = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: "at" | "every" | "cron";
    atMs?: number | null;
    everyMs?: number | null;
    expr?: string | null;
    tz?: string | null;
  };
  payload: {
    kind?: "system_event" | "agent_turn";
    message: string;
    deliver?: boolean;
    channel?: string | null;
    to?: string | null;
  };
  state: {
    nextRunAtMs?: number | null;
    lastRunAtMs?: number | null;
    lastStatus?: "ok" | "error" | "skipped" | null;
    lastError?: string | null;
  };
  createdAtMs: number;
  updatedAtMs: number;
  deleteAfterRun: boolean;
};

export type SkillInfo = {
  name: string;
  path: string;
  source: "workspace" | "builtin";
};

export type SkillsLoaderInstance = {
  listSkills: (filterUnavailable?: boolean) => SkillInfo[];
  getSkillMetadata?: (name: string) => Record<string, string> | null;
};

export type SkillsLoaderConstructor = new (workspace: string, builtinSkillsDir?: string) => SkillsLoaderInstance;
