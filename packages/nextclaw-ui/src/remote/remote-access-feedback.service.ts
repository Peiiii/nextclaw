import type { RemoteAccessView } from '@/api/remote.types';
import { t } from '@/lib/i18n';

type RemoteHeroView = {
  badgeStatus: 'active' | 'inactive' | 'ready' | 'setup' | 'warning';
  badgeLabel: string;
  title: string;
  description: string;
};

type RemotePrimaryAction =
  | {
      kind: 'sign-in-enable' | 'enable' | 'repair' | 'reauthorize';
      label: string;
      showRefreshIcon: boolean;
    }
  | null;

type RemoteIssueHint = {
  title: string;
  body: string;
};

export type RemoteAccessFeedbackView = {
  hero: RemoteHeroView;
  primaryAction: RemotePrimaryAction;
  issueHint: RemoteIssueHint | null;
  shouldShowIssueHint: boolean;
  requiresReauthorization: boolean;
};

const AUTH_EXPIRED_PATTERNS = [
  /invalid or expired token/i,
  /missing bearer token/i,
  /token expired/i,
  /token is invalid/i,
  /run "nextclaw login"/i,
  /browser sign-in again/i
];

function readRuntimeError(status: RemoteAccessView | undefined): string {
  return status?.runtime?.lastError?.trim() || '';
}

export function requiresRemoteReauthorization(status: RemoteAccessView | undefined): boolean {
  if (!status?.settings.enabled) {
    return false;
  }
  const error = readRuntimeError(status);
  return AUTH_EXPIRED_PATTERNS.some((pattern) => pattern.test(error));
}

export function buildRemoteAccessFeedbackView(status: RemoteAccessView | undefined): RemoteAccessFeedbackView {
  const reauthorizationRequired = requiresRemoteReauthorization(status);

  if (reauthorizationRequired) {
    return {
      hero: {
        badgeStatus: 'warning',
        badgeLabel: t('remoteStateReauthorizationRequired'),
        title: t('remoteStatusReauthorizationTitle'),
        description: t('remoteStatusReauthorizationDescription')
      },
      primaryAction: {
        kind: 'reauthorize',
        label: t('remoteReauthorizeNow'),
        showRefreshIcon: false
      },
      issueHint: {
        title: t('remoteStatusRecoveryTitle'),
        body: t('remoteStatusReauthorizationHint')
      },
      shouldShowIssueHint: true,
      requiresReauthorization: true
    };
  }

  if (!status?.account.loggedIn) {
    return {
      hero: {
        badgeStatus: 'setup',
        badgeLabel: t('statusSetup'),
        title: t('remoteStatusNeedsSignIn'),
        description: t('remoteStatusNeedsSignInDescription')
      },
      primaryAction: {
        kind: 'sign-in-enable',
        label: t('remoteSignInAndEnable'),
        showRefreshIcon: false
      },
      issueHint: null,
      shouldShowIssueHint: false,
      requiresReauthorization: false
    };
  }

  if (!status.settings.enabled) {
    return {
      hero: {
        badgeStatus: 'inactive',
        badgeLabel: t('statusInactive'),
        title: t('remoteStatusNeedsEnable'),
        description: t('remoteStatusNeedsEnableDescription')
      },
      primaryAction: {
        kind: 'enable',
        label: t('remoteEnableNow'),
        showRefreshIcon: false
      },
      issueHint: null,
      shouldShowIssueHint: false,
      requiresReauthorization: false
    };
  }

  if (!status.service.running) {
    return {
      hero: {
        badgeStatus: 'warning',
        badgeLabel: t('remoteServiceStopped'),
        title: t('remoteStatusNeedsServiceTitle'),
        description: t('remoteStatusNeedsServiceDescription')
      },
      primaryAction: {
        kind: 'repair',
        label: t('remoteReconnectNow'),
        showRefreshIcon: true
      },
      issueHint: {
        title: t('remoteStatusRecoveryTitle'),
        body: t('remoteStatusIssueDetailServiceStopped')
      },
      shouldShowIssueHint: true,
      requiresReauthorization: false
    };
  }

  if (status.runtime?.state === 'connected') {
    return {
      hero: {
        badgeStatus: 'ready',
        badgeLabel: t('statusReady'),
        title: t('remoteStatusReadyTitle'),
        description: t('remoteStatusReadyDescription')
      },
      primaryAction: {
        kind: 'repair',
        label: t('remoteReconnectNow'),
        showRefreshIcon: true
      },
      issueHint: null,
      shouldShowIssueHint: false,
      requiresReauthorization: false
    };
  }

  if (status.runtime?.state === 'connecting') {
    return {
      hero: {
        badgeStatus: 'active',
        badgeLabel: t('connecting'),
        title: t('remoteStatusConnectingTitle'),
        description: t('remoteStatusConnectingDescription')
      },
      primaryAction: {
        kind: 'repair',
        label: t('remoteReconnectNow'),
        showRefreshIcon: true
      },
      issueHint: null,
      shouldShowIssueHint: false,
      requiresReauthorization: false
    };
  }

  return {
    hero: {
      badgeStatus: 'warning',
      badgeLabel: t('remoteStateDisconnected'),
      title: t('remoteStatusIssueTitle'),
      description: t('remoteStatusIssueDescription')
    },
    primaryAction: {
      kind: 'repair',
      label: t('remoteReconnectNow'),
      showRefreshIcon: true
    },
    issueHint: {
      title: t('remoteStatusRecoveryTitle'),
      body: t('remoteStatusIssueDetailGeneric')
    },
    shouldShowIssueHint: Boolean(status.settings.enabled && status.account.loggedIn),
    requiresReauthorization: false
  };
}
