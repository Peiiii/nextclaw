import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatMessageTexts,
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import type { ReactNode } from 'react';
import { TerminalExecutionView, FileOperationView, SearchSnippetView, GenericToolCard, PanelAppInlineToolCard } from './chat-tool-specialized';

function isTerminalTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'exec' || lowered === 'exec_command' || lowered === 'execute_command' || lowered === 'command_execution' || lowered === 'bash' || lowered === 'shell' || lowered.includes('run_');
}

function isFileTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'read_file' || lowered === 'write_file' || lowered === 'edit_file' || lowered === 'apply_patch' || lowered === 'file_change';
}

function isFileWriteTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'write_file' || lowered === 'edit_file' || lowered === 'apply_patch' || lowered === 'file_change';
}

function isSearchTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'grep_search' || lowered === 'find_files' || lowered.includes('search');
}

export function ChatToolCard({
  card,
  toolStatusLabels,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  renderPanelAppCard,
}: {
  card: ChatToolPartViewModel;
  toolStatusLabels?: ChatMessageTexts['toolStatusLabels'];
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
}) {
  if (card.panelApp) {
    return (
      <PanelAppInlineToolCard
        card={card}
        onToolAction={onToolAction}
        renderPanelAppCard={renderPanelAppCard}
      />
    );
  }
  if (isTerminalTool(card.toolName)) {
    return <TerminalExecutionView card={card} toolLabel={toolStatusLabels?.terminal[card.statusTone]} />;
  }
  if (isFileTool(card.toolName)) {
    const toolLabel = isFileWriteTool(card.toolName)
      ? toolStatusLabels?.fileEdit[card.statusTone]
      : toolStatusLabels?.fileRead[card.statusTone];
    return <FileOperationView card={card} toolLabel={toolLabel} onFileOpen={onFileOpen} />;
  }
  if (isSearchTool(card.toolName)) {
    return <SearchSnippetView card={card} toolLabel={toolStatusLabels?.search[card.statusTone]} />;
  }

  // Fallback minimalist card for read_url_content, multi_replace, etc.
  return (
    <GenericToolCard
      card={card}
      onToolAction={onToolAction}
      renderToolAgent={renderToolAgent}
    />
  );
}
