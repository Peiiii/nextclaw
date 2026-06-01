import type {
  DocBrowserOpenOptions,
  DocBrowserRouteTarget,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import type { ParsedResourceUri } from '@/shared/lib/resource-uri';

export type RightPanelResourceKind = DocBrowserTabKind;

export type RightPanelResourceTarget = DocBrowserRouteTarget;

export type RightPanelResourceRouteDefinition = {
  areEquivalent?: (left: string, right: string) => boolean;
  defaultUrl: () => string;
  id: string;
  kind: RightPanelResourceKind;
  match: (uri: ParsedResourceUri) => boolean;
  resolve: (uri: ParsedResourceUri) => RightPanelResourceTarget;
};

export type RightPanelResourceNavigationTarget =
  | {
    options?: DocBrowserOpenOptions;
    type: 'right-panel-resource';
    uri?: string;
  }
  | {
    path: string;
    type: 'app-route';
  };

export type RightPanelResourceHomeNavigationItem = {
  id: string;
  label: string;
  target: RightPanelResourceNavigationTarget;
};
