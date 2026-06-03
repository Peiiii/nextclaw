export type AdaptiveCadenceStage = {
  untilElapsedMs?: number;
  delaysMs: readonly number[];
};

export type AdaptiveCadenceOptions = {
  idleDelayMs: number | false;
  manualTriggerDelayMs: number;
  successDelayMs: number | false;
  stages: readonly AdaptiveCadenceStage[];
  clock?: () => number;
};

export type AdaptiveCadenceSnapshot = {
  attempt: number;
  startedAt: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  manualTriggerPending: boolean;
  completed: boolean;
};

export type AdaptiveCadenceDelayOptions = {
  consumeManualTrigger?: boolean;
};

function validateStages(stages: readonly AdaptiveCadenceStage[]): void {
  if (stages.length === 0) {
    throw new Error('AdaptiveCadence requires at least one stage.');
  }
  for (const stage of stages) {
    if (stage.delaysMs.length === 0) {
      throw new Error('AdaptiveCadence stage requires at least one delay.');
    }
  }
}

export class AdaptiveCadence {
  private attempt = 0;
  private startedAt: number | null = null;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private manualTriggerPending = false;
  private completed = false;
  private readonly clock: () => number;

  constructor(private readonly options: AdaptiveCadenceOptions) {
    validateStages(options.stages);
    this.clock = options.clock ?? (() => Date.now());
  }

  recordFailure = (): void => {
    const now = this.clock();
    this.completed = false;
    this.manualTriggerPending = false;
    this.startedAt = this.startedAt ?? now;
    this.lastFailureAt = now;
    this.attempt += 1;
  };

  recordSuccess = (): void => {
    this.lastSuccessAt = this.clock();
    this.attempt = 0;
    this.startedAt = null;
    this.lastFailureAt = null;
    this.manualTriggerPending = false;
    this.completed = true;
  };

  reset = (): void => {
    this.attempt = 0;
    this.startedAt = null;
    this.lastFailureAt = null;
    this.lastSuccessAt = null;
    this.manualTriggerPending = false;
    this.completed = false;
  };

  requestManualTrigger = (): void => {
    this.completed = false;
    this.manualTriggerPending = true;
  };

  hasManualTrigger = (): boolean => this.manualTriggerPending;

  getNextDelay = (
    delayOptions: AdaptiveCadenceDelayOptions = {},
  ): number | false => {
    if (this.manualTriggerPending) {
      if (delayOptions.consumeManualTrigger) {
        this.manualTriggerPending = false;
      }
      return this.options.manualTriggerDelayMs;
    }
    if (this.completed) {
      return this.options.successDelayMs;
    }
    if (this.startedAt === null) {
      return this.options.idleDelayMs;
    }

    const stage = this.resolveStage(this.clock() - this.startedAt);
    return stage.delaysMs[Math.min(this.attempt - 1, stage.delaysMs.length - 1)];
  };

  getSnapshot = (): AdaptiveCadenceSnapshot => ({
    attempt: this.attempt,
    startedAt: this.startedAt,
    lastFailureAt: this.lastFailureAt,
    lastSuccessAt: this.lastSuccessAt,
    manualTriggerPending: this.manualTriggerPending,
    completed: this.completed,
  });

  private resolveStage = (elapsedMs: number): AdaptiveCadenceStage =>
    this.options.stages.find(
      (stage) =>
        stage.untilElapsedMs === undefined || elapsedMs < stage.untilElapsedMs,
    ) ?? this.options.stages[this.options.stages.length - 1];
}
