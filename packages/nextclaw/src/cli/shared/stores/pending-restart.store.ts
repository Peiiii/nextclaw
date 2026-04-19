export type PendingRestartState = {
  changedPaths: string[];
  message: string;
  reasons: string[];
  requestedAt: string;
};

type MarkPendingRestartParams = {
  changedPaths?: string[];
  manualMessage: string;
  reason: string;
};

const clonePendingRestartState = (state: PendingRestartState | null): PendingRestartState | null => {
  if (!state) {
    return null;
  }
  return {
    changedPaths: [...state.changedPaths],
    message: state.message,
    reasons: [...state.reasons],
    requestedAt: state.requestedAt
  };
};

const dedupeStrings = (values: string[]): string[] => {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
};

export class PendingRestartStore {
  private state: PendingRestartState | null = null;

  readonly read = (): PendingRestartState | null => {
    return clonePendingRestartState(this.state);
  };

  readonly mark = (params: MarkPendingRestartParams): PendingRestartState => {
    const nextState: PendingRestartState = {
      changedPaths: dedupeStrings([...(this.state?.changedPaths ?? []), ...(params.changedPaths ?? [])]),
      message: params.manualMessage.trim() || this.state?.message || "Restart required to apply saved changes.",
      reasons: dedupeStrings([...(this.state?.reasons ?? []), params.reason]),
      requestedAt: new Date().toISOString()
    };
    this.state = nextState;
    return clonePendingRestartState(nextState)!;
  };

  readonly clear = (): void => {
    this.state = null;
  };
}

export const pendingRestartStore = new PendingRestartStore();
