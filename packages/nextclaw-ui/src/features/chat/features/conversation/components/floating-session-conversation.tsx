import { PageResourceActionsMenu } from '@/features/right-panel-resources';
import { pageResourceFromTarget } from '@/features/right-panel-resources';
import { buildSessionPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';
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
    title={session.title} testId="floating-session-conversation" focusOnOpen
    moreActions={<PageResourceActionsMenu page={pageResourceFromTarget({ kind: 'chat-session', title: session.title, url: buildSessionPanelUrl(session.sessionKey), resourceUri: buildSessionPanelUrl(session.sessionKey), historyPolicy: 'none' })} />}
    onClose={sessionSurfaceManager.close}
    onPlace={() => sessionSurfaceManager.dock(session, presenter.docBrowserManager)}
    onOpenMain={() => { navigate(buildSessionPath(session.sessionKey)); sessionSurfaceManager.close(); }}>
    <SessionConversationArea key={session.sessionKey} sessionKey={session.sessionKey} />
  </WorkbenchSurface>;
}
