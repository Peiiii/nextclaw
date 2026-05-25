export type ChannelTypingControllerOptions = {
  heartbeatMs: number;
  autoStopMs: number;
  sendTyping: (targetId: string) => Promise<void> | void;
};

type TypingTask = {
  heartbeat: NodeJS.Timeout;
  autoStop: NodeJS.Timeout;
};

export class ChannelTypingController {
  private readonly heartbeatMs: number;
  private readonly autoStopMs: number;
  private readonly sendTyping: (targetId: string) => Promise<void> | void;
  private readonly tasks = new Map<string, TypingTask>();

  constructor(options: ChannelTypingControllerOptions) {
    this.heartbeatMs = Math.max(1000, Math.floor(options.heartbeatMs));
    this.autoStopMs = Math.max(this.heartbeatMs, Math.floor(options.autoStopMs));
    this.sendTyping = options.sendTyping;
  }

  start = (targetId: string): void => {
    this.stop(targetId);
    void this.sendTyping(targetId);

    const heartbeat = setInterval(() => {
      void this.sendTyping(targetId);
    }, this.heartbeatMs);

    const autoStop = setTimeout(() => {
      this.stop(targetId);
    }, this.autoStopMs);

    this.tasks.set(targetId, {
      heartbeat,
      autoStop,
    });
  };

  stop = (targetId: string): void => {
    const task = this.tasks.get(targetId);
    if (!task) {
      return;
    }
    clearInterval(task.heartbeat);
    clearTimeout(task.autoStop);
    this.tasks.delete(targetId);
  };

  stopAll = (): void => {
    for (const targetId of this.tasks.keys()) {
      this.stop(targetId);
    }
  };
}
