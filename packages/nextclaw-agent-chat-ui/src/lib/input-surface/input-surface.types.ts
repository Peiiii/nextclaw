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
  value?: string;
  tokenKind?: string;
  tokenKey?: string;
};

export type ChatInputSurfaceMenuProps = {
  isOpen: boolean;
  isLoading: boolean;
  items: ChatInputSurfaceItem[];
  activeIndex: number;
  activeItem: ChatInputSurfaceItem | null;
  texts: ChatInputSurfaceMenuTexts;
  onSelectItem: (item: ChatInputSurfaceItem) => void;
  onOpenChange: (open: boolean) => void;
  onDetailsPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onSetActiveIndex: (index: number) => void;
};

export type ChatInputSurfaceConfig = Pick<
  ChatInputSurfaceMenuProps,
  "isLoading" | "items" | "texts"
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
