import type { PointerEvent } from 'react';

export type ChatInputSurfaceTriggerSpec = {
  key: string;
  marker: string;
};

export type ChatInputSurfaceTrigger = {
  key: string;
  marker: string;
  query: string;
  start: number;
  end: number;
};

export type ChatInputSurfaceTriggerChangeReason =
  | { type: 'delete-content' }
  | { type: 'insert-text'; text: string }
  | { type: 'programmatic' }
  | { type: 'selection' }
  | { type: 'sync' };

export type ChatInputSurfaceMenuTexts = {
  loadingLabel: string;
  sectionLabel: string;
  emptyLabel: string;
  hintLabel: string;
  itemHintLabel: string;
};

export type ChatInputSurfaceItem = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  detailLines: string[];
  hintLabel?: string;
  sectionKey?: string;
  sectionLabel?: string;
  value?: string;
  tokenKind?: string;
  tokenKey?: string;
};

export type ChatInputSurfaceFilterOption = {
  key: string;
  label: string;
  sectionKeys?: readonly string[];
};

export type ChatInputSurfaceMenuProps = {
  filterOptions?: readonly ChatInputSurfaceFilterOption[];
  isOpen: boolean;
  isLoading: boolean;
  items: ChatInputSurfaceItem[];
  texts: ChatInputSurfaceMenuTexts;
  onSelectItem: (item: ChatInputSurfaceItem) => void;
  onOpenChange: (open: boolean) => void;
  onDetailsPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
};

export type ChatInputSurfaceConfig = Pick<
  ChatInputSurfaceMenuProps,
  "filterOptions" | "isLoading" | "items" | "texts"
> & {
  onSelectItem?: (item: ChatInputSurfaceItem) => void;
};

export type ChatInputSurfacePluginContext<TData = unknown> = {
  data: TData;
  trigger: ChatInputSurfaceTrigger;
};

export type ChatInputSurfacePanel = Omit<ChatInputSurfaceConfig, "onSelectItem"> & {
  onSelectItem?: (item: ChatInputSurfaceItem) => void;
};

export type ChatInputSurfacePlugin<TData = unknown> = {
  key: string;
  triggerSpecs: readonly ChatInputSurfaceTriggerSpec[];
  resolvePanel: (context: ChatInputSurfacePluginContext<TData>) => ChatInputSurfacePanel | null;
};

export type ChatInputSurfaceResolvedState = {
  triggerSpecs: ChatInputSurfaceTriggerSpec[];
  panel: ChatInputSurfacePanel | null;
};
