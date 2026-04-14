import { buildSessionPath } from '@/components/chat/chat-session-route';
import type { NavigateFunction, NavigateOptions } from 'react-router-dom';

type ChatUiState = {
  pathname: string;
};

type ChatUiActions = {
  navigate: NavigateFunction | null;
  confirm: (params: { title: string; variant: 'destructive'; confirmLabel: string }) => Promise<boolean>;
};

const noopConfirm = async (_params: { title: string; variant: 'destructive'; confirmLabel: string }) => false;

export class ChatUiManager {
  private state: ChatUiState = {
    pathname: ''
  };

  private actions: ChatUiActions = {
    navigate: null,
    confirm: noopConfirm
  };

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

  confirm = async (params: { title: string; variant: 'destructive'; confirmLabel: string }) => {
    return this.actions.confirm(params);
  };

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

  goToChatRoot = (options?: NavigateOptions) => {
    this.navigateTo('/chat', options);
  };

  isAtChatRoot = () => this.state.pathname === '/chat';

  goToSession = (sessionKey: string, options?: NavigateOptions) => {
    this.navigateTo(buildSessionPath(sessionKey), options);
  };
}
