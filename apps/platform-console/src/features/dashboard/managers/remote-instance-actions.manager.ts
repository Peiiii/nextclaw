type Translate = (key: string, params?: Record<string, string | number>) => string;

export class RemoteInstanceActionsManager {
  constructor(private readonly deps: {
    t: Translate;
    setFeedback: (value: string | null) => void;
    setSelectedInstanceId: (value: string | null) => void;
    archiveInstance: (instanceId: string) => void;
    deleteInstance: (instanceId: string) => void;
    restoreInstance: (instanceId: string) => void;
  }) {}

  selectInstance = (instanceId: string | null): void => {
    this.deps.setSelectedInstanceId(instanceId);
  };

  copyInstanceId = async (instanceId: string): Promise<void> => {
    await this.copyText(
      instanceId,
      this.deps.t('remote.messages.instanceIdCopied'),
      this.deps.t('remote.messages.instanceIdCopyManual')
    );
  };

  copyShareUrl = async (shareUrl: string): Promise<void> => {
    await this.copyText(
      shareUrl,
      this.deps.t('remote.messages.shareCopied'),
      this.deps.t('remote.messages.shareCopyManual')
    );
  };

  archiveInstance = (instanceId: string): void => {
    if (window.confirm(this.deps.t('remote.messages.archiveConfirm'))) {
      this.deps.archiveInstance(instanceId);
    }
  };

  deleteInstance = (instanceId: string): void => {
    if (window.confirm(this.deps.t('remote.messages.deleteConfirm'))) {
      this.deps.deleteInstance(instanceId);
    }
  };

  restoreInstance = (instanceId: string): void => {
    this.deps.restoreInstance(instanceId);
  };

  private copyText = async (value: string, successMessage: string, fallbackMessage: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      this.deps.setFeedback(successMessage);
    } catch {
      this.deps.setFeedback(fallbackMessage);
    }
  };
}
