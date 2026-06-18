import type {
  ChatInputSurfaceItem,
  ChatInputSurfaceMenuTexts,
  ChatInputSurfaceTrigger,
  ChatInputSurfaceTriggerSpec,
  ChatInputSurfacePanel,
  ChatInputSurfacePlugin,
  ChatInputSurfacePluginContext,
  ChatInputSurfaceResolvedState,
} from './input-surface.types';

export function createInputSurfaceTriggeredPanelPlugin<TData>(params: {
  key: string;
  trigger: ChatInputSurfaceTriggerSpec;
  resolvePanel: (context: ChatInputSurfacePluginContext<TData>) => ChatInputSurfacePanel | null;
}): ChatInputSurfacePlugin<TData> {
  return {
    key: params.key,
    triggerSpecs: [params.trigger],
    resolvePanel: (context) =>
      context.trigger.key === params.trigger.key ? params.resolvePanel(context) : null,
  };
}

export function createInputSurfaceReferenceTokenPlugin<TData, TRecord>(params: {
  key: string;
  trigger: ChatInputSurfaceTriggerSpec;
  tokenKind: string;
  texts: ChatInputSurfaceMenuTexts;
  getRecords: (context: ChatInputSurfacePluginContext<TData>) => readonly TRecord[];
  getIsLoading?: (context: ChatInputSurfacePluginContext<TData>) => boolean;
  getItems: (params: {
    context: ChatInputSurfacePluginContext<TData>;
    records: readonly TRecord[];
    query: string;
    tokenKind: string;
  }) => ChatInputSurfaceItem[];
  onSelectItem?: (item: ChatInputSurfaceItem) => void;
}): ChatInputSurfacePlugin<TData> {
  return createInputSurfaceTriggeredPanelPlugin({
    key: params.key,
    trigger: params.trigger,
    resolvePanel: (context) => ({
      isLoading: params.getIsLoading?.(context) ?? false,
      items: params.getItems({
        context,
        records: params.getRecords(context),
        query: context.trigger.query,
        tokenKind: params.tokenKind,
      }),
      onSelectItem: params.onSelectItem,
      texts: params.texts,
    }),
  });
}

export function resolveChatInputSurfaceState<TData>(params: {
  data: TData;
  plugins: readonly ChatInputSurfacePlugin<TData>[];
  trigger: ChatInputSurfaceTrigger | null;
}): ChatInputSurfaceResolvedState {
  const { data, plugins, trigger } = params;
  const triggerSpecs = plugins.flatMap((plugin) => [...plugin.triggerSpecs]);
  if (!trigger) {
    return {
      triggerSpecs,
      panel: null,
    };
  }

  for (const plugin of plugins) {
    const panel = plugin.resolvePanel({
      data,
      trigger,
    });
    if (panel) {
      return {
        triggerSpecs,
        panel,
      };
    }
  }

  return {
    triggerSpecs,
    panel: null,
  };
}
