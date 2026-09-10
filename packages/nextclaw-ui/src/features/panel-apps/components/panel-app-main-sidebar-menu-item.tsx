import type { PanelAppEntryView } from '@/shared/lib/api';
import { PageResourceActionItems } from '@/features/right-panel-resources';
import { pageResourceFromTarget } from '@/features/right-panel-resources';
import { createPanelAppRightPanelResourceTarget } from '@/features/right-panel-resources';

export function PanelAppMainSidebarMenuItem({ entry, onSelect }: { entry: PanelAppEntryView; onSelect?: () => void }) {
  return <PageResourceActionItems page={pageResourceFromTarget(createPanelAppRightPanelResourceTarget(entry))} onSelect={onSelect} />;
}
