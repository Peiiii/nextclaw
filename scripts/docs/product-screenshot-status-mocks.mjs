export const authStatusPayload = {
  enabled: false,
  configured: false,
  authenticated: false,
  username: 'demo'
};

export const remoteStatusPayload = {
  account: { loggedIn: false, email: '', username: null, role: 'member', platformBase: 'https://platform.nextclaw.io', apiBase: 'https://platform-api.nextclaw.io' },
  settings: { enabled: false, deviceName: 'Screenshot Mac', platformApiBase: 'https://platform-api.nextclaw.io' },
  service: { running: true, pid: 55231, uiUrl: 'http://127.0.0.1:5194', uiPort: 5194, currentProcess: true },
  localOrigin: 'http://127.0.0.1:5194',
  configuredEnabled: false,
  platformBase: 'https://platform.nextclaw.io',
  runtime: {
    enabled: false,
    mode: 'foreground',
    state: 'disabled',
    deviceId: 'screenshot-device',
    deviceName: 'Screenshot Mac',
    platformBase: 'https://platform.nextclaw.io',
    localOrigin: 'http://127.0.0.1:5194',
    lastConnectedAt: null,
    lastError: null,
    updatedAt: '2026-04-16T00:00:00.000Z'
  }
};

export const bootstrapStatusPayload = {
  phase: 'ready',
  ncpAgent: {
    state: 'ready'
  },
  extensionLoading: {
    state: 'ready',
    loadedExtensionCount: 3,
    totalExtensionCount: 3
  },
  channels: {
    state: 'ready',
    enabled: ['discord', 'telegram', 'feishu']
  },
  remote: {
    state: 'disabled'
  }
};

const unavailableActionCapability = {
  available: false,
  requiresConfirmation: false,
  impact: 'none',
  reasonIfUnavailable: 'Screenshot mode does not control a managed runtime.'
};

export const runtimeControlPayload = {
  environment: 'self-hosted-web',
  lifecycle: 'healthy',
  serviceState: 'running',
  canStartService: unavailableActionCapability,
  canRestartService: unavailableActionCapability,
  canStopService: unavailableActionCapability,
  canRestartApp: unavailableActionCapability,
  pendingRestart: null,
  ownerLabel: 'Screenshot runtime',
  managementHint: 'Screenshot mode uses a mock runtime state.'
};

export const runtimeUpdatePayload = {
  status: 'up-to-date',
  installationKind: 'npm-runtime-bundle',
  channel: 'stable',
  hostVersion: '0.22.6',
  currentVersion: '0.22.6',
  availableVersion: null,
  downloadedVersion: null,
  minimumHostVersion: null,
  releaseNotesUrl: null,
  lastCheckedAt: '2026-07-05T00:00:00.000Z',
  progress: null,
  canApplyInApp: false,
  requiresRestart: false,
  blockReason: null,
  recoveryCommand: null,
  errorMessage: null
};
