export type SystemdProcessSupervisorSource =
  | "configured-systemd"
  | "legacy-systemd-invocation";

export const SUPERVISED_PROCESS_RESTART_EXIT_CODE = 75;

export function resolveSystemdProcessSupervisor(
  env: NodeJS.ProcessEnv,
): SystemdProcessSupervisorSource | null {
  const configuredSupervisor = env.NEXTCLAW_PROCESS_SUPERVISOR?.trim();
  if (configuredSupervisor === "systemd") {
    return "configured-systemd";
  }
  if (!configuredSupervisor && env.INVOCATION_ID?.trim()) {
    return "legacy-systemd-invocation";
  }
  return null;
}
