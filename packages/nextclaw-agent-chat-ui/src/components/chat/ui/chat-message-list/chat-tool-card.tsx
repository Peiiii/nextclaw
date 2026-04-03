import type {
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '../../view-models/chat-ui.types';
import { TerminalExecutionView, FileOperationView, SearchSnippetView, GenericToolCard } from './chat-tool-specialized';

function isTerminalTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'exec' || lowered === 'exec_command' || lowered === 'execute_command' || lowered === 'command_execution' || lowered === 'bash' || lowered === 'shell' || lowered.includes('run_');
}

function isFileEditTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'read_file' || lowered === 'write_file' || lowered === 'edit_file' || lowered === 'apply_patch' || lowered === 'file_change';
}

function isSearchTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'grep_search' || lowered === 'find_files' || lowered.includes('search');
}

export function ChatToolCard({
  card,
  onToolAction,
}: {
  card: ChatToolPartViewModel;
  onToolAction?: (action: ChatToolActionViewModel) => void;
}) {
  if (isTerminalTool(card.toolName)) {
    return <TerminalExecutionView card={card} />;
  }
  if (isFileEditTool(card.toolName)) {
    return <FileOperationView card={card} />;
  }
  if (isSearchTool(card.toolName)) {
    return <SearchSnippetView card={card} />;
  }

  // Fallback minimalist card for read_url_content, multi_replace, etc.
  return <GenericToolCard card={card} onToolAction={onToolAction} />;
}
