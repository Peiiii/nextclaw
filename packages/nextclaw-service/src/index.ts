export {
  RuntimeCommandService,
  describeUnmanagedHealthyTargetMessage,
  buildMarketplaceSkillInstallArgs,
  pickUserFacingCommandSummary,
} from "./shared/services/runtime/runtime-command.service.js";
export {
  ManagedServiceCommandService,
  resolveManagedServiceReadySnapshot,
  resolveManagedServiceUiBinding,
  resolveSessionRouteCandidate,
  spawnManagedService,
  waitForManagedServiceReadiness,
  type ManagedServiceSnapshot,
  type StartServiceOptions,
} from "./shared/services/runtime/service-managed-startup.service.js";
export { initializeConfigIfMissing } from "./shared/services/runtime/runtime-config-init.service.js";
export { createTopLevelNextclawCommandEnv } from "./shared/utils/top-level-nextclaw-command-env.utils.js";
export { getPackageVersion, isProcessRunning } from "./shared/utils/cli.utils.js";
export { logStartupTrace, measureStartupAsync, measureStartupSync } from "./shared/utils/startup-trace.js";
