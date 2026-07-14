import type * as NextclawCore from "@nextclaw/core";
import type { NextclawKernel } from "@nextclaw/kernel";
import type {
  EventBus,
  UpdatePreferences,
  UpdateSnapshot,
} from "@nextclaw/shared";
import type { ExtensionChannelBinding, ExtensionUiMetadata } from "@nextclaw/core";
import type { UiAuthService } from "@nextclaw-server/features/auth/index.js";
import type {
  BootstrapStatusView,
  MarketplaceApiConfig,
  RemoteBrowserAuthPollRequest,
  RemoteBrowserAuthPollResult,
  RemoteBrowserAuthStartRequest,
  RemoteBrowserAuthStartResult,
  RemoteAccessView,
  RemoteAccountProfileUpdateRequest,
  RemoteDoctorView,
  RemoteLoginRequest,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteSettingsUpdateRequest,
} from "@nextclaw-server/shared/types/server-api.types.js";
import type { RuntimeControlActionResult, RuntimeControlView } from "@nextclaw-server/features/runtime-control/index.js";

export type UiAppEventBus = Pick<EventBus, "emit" | "subscribeAll">;

export type UiBootstrapStatusHost = {
  getStatus: () => BootstrapStatusView;
};

export type UiExtensionHost = {
  authenticateEventStreamCredential: (input: {
    extensionId: string | null;
    token: string | null;
  }) => { extensionId: string } | null;
  getChannelBindings: () => ExtensionChannelBinding[];
  getUiMetadata: () => ExtensionUiMetadata[];
};

export type UiKernelHost = Pick<
  NextclawKernel,
  | "assetStore"
  | "eventBus"
  | "ingress"
  | "isSessionRunning"
  | "listSessionTypes"
  | "llmProviders"
  | "sessionManager"
  | "panelAppManager"
  | "preferenceManager"
  | "serviceAppManager"
> & {
  accessManager?: NextclawKernel["accessManager"];
};

export type UiCronHost = {
  listJobs: (includeDisabled?: boolean) => CronJobEntry[];
  addJob: (params: {
    name: string;
    schedule: CronJobEntry["schedule"];
    message: string;
    agentId?: string;
    sessionId?: string;
    deleteAfterRun?: boolean;
  }) => CronJobEntry;
  removeJob: (jobId: string) => boolean;
  enableJob: (jobId: string, enabled?: boolean) => CronJobEntry | null;
  runJob: (jobId: string, force?: boolean) => Promise<boolean>;
};

export type UiRouterOptions = {
  kernel: UiKernelHost;
  configPath: string;
  appEventBus: UiAppEventBus;
  uiConfig?: Pick<NextclawCore.Config["ui"], "enabled" | "host" | "open" | "port">;
  uiStaticDir?: string | null;
  panelAppClientSdkScript?: () => Promise<string> | string;
  corsOrigins?: string[] | "*";
  productVersion?: string;
  applyLiveConfigReload?: () => Promise<void>;
  initializeAgentHomeDirectory?: (homeDirectory: string) => void;
  marketplace?: MarketplaceApiConfig;
  cron?: UiCronHost;
  authService?: UiAuthService;
  remoteAccess?: UiRemoteAccessHost;
  runtimeControl?: UiRuntimeControlHost;
  runtimeUpdate?: UiRuntimeUpdateHost;
  bootstrapStatus?: UiBootstrapStatusHost;
  extensions?: UiExtensionHost;
};

export type UiRemoteAccessHost = {
  getStatus: () => Promise<RemoteAccessView> | RemoteAccessView;
  login: (input: RemoteLoginRequest) => Promise<RemoteAccessView>;
  startBrowserAuth: (input: RemoteBrowserAuthStartRequest) => Promise<RemoteBrowserAuthStartResult>;
  pollBrowserAuth: (input: RemoteBrowserAuthPollRequest) => Promise<RemoteBrowserAuthPollResult>;
  logout: () => Promise<RemoteAccessView> | RemoteAccessView;
  updateProfile: (input: RemoteAccountProfileUpdateRequest) => Promise<RemoteAccessView> | RemoteAccessView;
  updateSettings: (input: RemoteSettingsUpdateRequest) => Promise<RemoteAccessView> | RemoteAccessView;
  runDoctor: () => Promise<RemoteDoctorView>;
  controlService: (action: RemoteServiceAction) => Promise<RemoteServiceActionResult>;
};

export type UiRuntimeControlHost = {
  getControl: () => Promise<RuntimeControlView> | RuntimeControlView;
  startService: () => Promise<RuntimeControlActionResult> | RuntimeControlActionResult;
  restartService: () => Promise<RuntimeControlActionResult> | RuntimeControlActionResult;
  stopService: () => Promise<RuntimeControlActionResult> | RuntimeControlActionResult;
};

export type UiRuntimeUpdateHost = {
  getState: () => Promise<UpdateSnapshot> | UpdateSnapshot;
  checkForUpdates: () => Promise<UpdateSnapshot> | UpdateSnapshot;
  downloadUpdate: () => Promise<UpdateSnapshot> | UpdateSnapshot;
  applyDownloadedUpdate: () => Promise<UpdateSnapshot> | UpdateSnapshot;
  updatePreferences: (preferences: Partial<UpdatePreferences>) => Promise<UpdateSnapshot> | UpdateSnapshot;
  updateChannel: (channel: UpdateSnapshot["channel"]) => Promise<UpdateSnapshot> | UpdateSnapshot;
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
    agentId?: string | null;
    sessionId?: string | null;
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
  ref: string;
  name: string;
  path: string;
  source: "builtin" | "global" | "project" | "workspace";
  scope: "builtin" | "global" | "project" | "workspace";
};

export type SkillsLoaderInstance = {
  listSkills: (filterUnavailable?: boolean) => SkillInfo[];
  getSkillMetadata?: (selector: string | SkillInfo) => Record<string, string> | null;
};

export type SkillsLoaderConstructor = new (
  workspace:
    | string
    | {
        workspace: string;
        projectRoot?: string | null;
        includeBuiltin?: boolean;
        includeGlobal?: boolean;
        globalSkillsRoot?: string;
      }
) => SkillsLoaderInstance;
