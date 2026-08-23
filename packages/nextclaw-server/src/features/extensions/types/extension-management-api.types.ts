export type UiExtensionObservationCapabilities = {
  context: boolean;
  events: boolean;
};

export type UiExtensionChannelView = {
  id: string;
  name?: string;
  description?: string;
};

export type UiExtensionView = {
  id: string;
  name: string;
  version?: string;
  state: "stopped" | "starting" | "running" | "stopping" | "failed";
  generation?: string;
  pid?: number;
  startedAt?: string;
  leaseCount: number;
  observations: UiExtensionObservationCapabilities;
  channels: UiExtensionChannelView[];
};

export type UiExtensionsView = {
  extensions: UiExtensionView[];
  counts: {
    total: number;
    running: number;
    withObservations: number;
    withChannels: number;
  };
};
