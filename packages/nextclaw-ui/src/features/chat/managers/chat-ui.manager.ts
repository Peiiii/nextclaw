import type { NavigateFunction, NavigateOptions } from 'react-router-dom';
import type { ChatUiShowContentRequest } from '@nextclaw/agent-chat-ui';
import { viewportLayoutManager } from '@/app/managers/viewport-layout.manager';
import { CHAT_DRAFT_SESSION_PATH, buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';
import {
  createPanelAppResourceUri,
  createPanelAppRightPanelResourceTarget,
} from '@/features/right-panel-resources';
import { findPanelAppEntryByDisplayId } from '@/features/panel-apps';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { nextclawClient, type PanelAppEntryView } from '@/shared/lib/api';

type ChatUiState = {
  pathname: string;
};

type ChatUiActions = {
  navigate: NavigateFunction | null;
  confirm: (params: {
    title: string;
    variant: 'destructive';
    confirmLabel: string;
  }) => Promise<boolean>;
};

type ChatUiDisplayContentTarget = Extract<ChatUiShowContentRequest['target'], { type: 'url' | 'panel_app' }>;

const noopConfirm: ChatUiActions['confirm'] = async () => false;

export class ChatUiManager {
  private state: ChatUiState = {
    pathname: ''
  };

  private actions: ChatUiActions = {
    navigate: null,
    confirm: noopConfirm
  };

  constructor(private docBrowserManager: DocBrowserManager) {}

  syncState = (patch: Partial<ChatUiState>) => {
    this.state = {
      ...this.state,
      ...patch
    };
  };

  bindActions = (patch: Partial<ChatUiActions>) => {
    this.actions = {
      ...this.actions,
      ...patch
    };
  };

  confirm = async (params: { title: string; variant: 'destructive'; confirmLabel: string }) => this.actions.confirm(params);

  navigateTo = (to: string, options?: NavigateOptions) => {
    if (!this.actions.navigate) {
      return;
    }
    if (this.state.pathname === to && !options?.replace) {
      return;
    }
    this.actions.navigate(to, options);
    this.state.pathname = to;
  };

  goToProviders = () => {
    this.navigateTo('/providers');
  };

  isCompactViewport = (): boolean => {
    return viewportLayoutManager.getSnapshot().mode === 'mobile';
  };

  private resolvePanelAppEntry = async (value: string): Promise<PanelAppEntryView | null> => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }
    try {
      return findPanelAppEntryByDisplayId((await nextclawClient.panelApps.listPanelApps()).entries, normalizedValue);
    } catch {
      return null;
    }
  };

  showContent = async (params: { target: ChatUiDisplayContentTarget; title?: string }) => {
    const { target, title } = params;
    if (target.type === 'url') {
      this.docBrowserManager.open(target.payload.url, {
        dedupeKey: `browser:${target.payload.url}`,
        kind: 'content',
        title,
      });
      return;
    }
    const { appId } = target.payload;
    const entry = await this.resolvePanelAppEntry(appId);
    if (entry) {
      this.docBrowserManager.openTarget(createPanelAppRightPanelResourceTarget(entry), {
        title,
      });
      return;
    }
    this.docBrowserManager.open(createPanelAppResourceUri(appId), {
      title,
    });
  };

  goToChatRoot = (options?: NavigateOptions) => {
    this.navigateTo('/chat', options);
  };

  isAtChatRoot = () => this.state.pathname === '/chat' || this.state.pathname === CHAT_DRAFT_SESSION_PATH;

  goToSession = (sessionKey: string, options?: NavigateOptions) => {
    this.navigateTo(buildSessionPath(sessionKey), options);
  };
}
