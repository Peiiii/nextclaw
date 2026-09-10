import { PageResourceActionsMenu } from '@/features/right-panel-resources';
import { pageResourceFromTarget } from '@/features/right-panel-resources';
import { buildSessionPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAppPresenter } from '@/app/presenters/app.presenter';
import { sessionSurfaceManager } from '@/features/chat/managers/session-surface.manager';
import { useFloatingSessionStore } from '@/features/chat/stores/floating-session.store';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { WorkbenchSurface } from '@/shared/components/workbench/workbench-surface';
import { SESSION_WORKBENCH_SURFACE } from '@/shared/components/workbench/types/workbench-surface.types';
import { SessionConversationArea } from './session-conversation-area';

export function FloatingSessionConversation() {
  const session = useFloatingSessionStore((state) => state.session);
  const navigate = useNavigate();
  const presenter = getAppPresenter();
  if (!session) return null;
  return <WorkbenchSurface id={SESSION_WORKBENCH_SURFACE} manager={presenter.workbenchSurfaceManager}
    title={session.title} icon={<MessageSquare className="h-4 w-4 shrink-0" />} testId="floating-session-conversation" focusOnOpen
    navigation={<div className="flex min-w-0 flex-1 items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs">{session.title}</span><PageResourceActionsMenu page={pageResourceFromTarget({ kind: 'chat-session', title: session.title, url: buildSessionPanelUrl(session.sessionKey), resourceUri: buildSessionPanelUrl(session.sessionKey), historyPolicy: 'none' })} /></div>}
    onClose={sessionSurfaceManager.close}
    onPlace={() => sessionSurfaceManager.dock(session, presenter.docBrowserManager)}
    onOpenMain={() => { navigate(buildSessionPath(session.sessionKey)); sessionSurfaceManager.close(); }}>
    <SessionConversationArea key={session.sessionKey} sessionKey={session.sessionKey} />
  </WorkbenchSurface>;
}
