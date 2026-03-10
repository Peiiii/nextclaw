export interface ActiveRunContext {
  localRunId: number;
  sessionId?: string;
  agentId?: string;
  remoteRunId?: string;
  remoteStopCapable: boolean;
  remoteStopReason?: string;
  sourceMessage?: string;
  restoreDraftOnError?: boolean;
}

export function getStopDisabledReason(run: ActiveRunContext | null): string | null {
  if (!run) return null;
  if (run.remoteStopCapable && run.remoteRunId) return null;
  if (run.remoteStopCapable) return '__preparing__';
  return run.remoteStopReason ?? '';
}

export interface RunReadyInfo {
  remoteRunId?: string;
  sessionId?: string;
  stopCapable?: boolean;
  stopReason?: string;
}

export interface RunFinalInfo {
  sessionId?: string;
  hasOutput?: boolean;
}

export interface RunLifecycleCallbacks {
  onRunSettled?: (info: { sourceSessionId?: string; resultSessionId?: string }) => void | Promise<void>;
  onRunError?: (info: { error: string; sourceMessage?: string; restoreDraft?: boolean }) => void;
  onSessionChanged?: (sessionId: string) => void;
}

export interface RunMetadataParsers {
  parseReady: (metadata: Record<string, unknown>) => RunReadyInfo | null;
  parseFinal: (metadata: Record<string, unknown>) => RunFinalInfo | null;
}

export interface SendRunOptions {
  message: string;
  sessionId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  restoreDraftOnError?: boolean;
  stopCapable?: boolean;
  stopReason?: string;
}

export interface ResumeRunOptions {
  remoteRunId: string;
  sessionId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  stopCapable?: boolean;
  stopReason?: string;
}
