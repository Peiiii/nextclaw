import { Bold, Italic, List, Search, Undo2, Redo2 } from "lucide-react";
import { IconButton } from "../icon-button";
import { ActionMenu, ActionMenuItem } from "../overlays/action-menu";
import type { MarkdownEditorManager } from "../../managers/markdown-editor.manager";
import type { MarkdownAction, MarkdownEditorLabels, MarkdownSelection } from "../../types/markdown-editor.types";

export function MarkdownEditorToolbar({ labels, selection, manager, onSearch }: { labels: MarkdownEditorLabels; selection: MarkdownSelection; manager?: MarkdownEditorManager; onSearch: () => void }) {
  const text = labels.rich;
  const actions: MarkdownAction[] = ["orderedList", "taskList", "quote", "link", "image", "table", "codeBlock", "math", "strike", "divider"];
  return <div className="ui-markdown-editor-toolbar" role="toolbar" aria-label={labels.toolbar}>
    <select aria-label={text.heading} value={selection.heading} onChange={(event) => manager?.heading(Number(event.target.value))}>
      <option value={0}>{text.paragraph}</option>
      {[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>{text.heading} {level}</option>)}
    </select>
    <IconButton label={labels.bold} icon={<Bold />} aria-pressed={selection.bold} onClick={() => manager?.run("bold")} />
    <IconButton label={labels.italic} icon={<Italic />} aria-pressed={selection.italic} onClick={() => manager?.run("italic")} />
    <IconButton label={labels.list} icon={<List />} onClick={() => manager?.run("list")} />
    <ActionMenu label={labels.more} transferringFocus>
      <ActionMenuItem onSelect={() => manager?.run("code")}>{labels.code}</ActionMenuItem>
      {actions.map((action) => <ActionMenuItem key={action} onSelect={() => manager?.run(action)}>{text[action as keyof typeof text]}</ActionMenuItem>)}
      {selection.table && (["addRow", "addColumn", "deleteRow", "deleteColumn"] as const).map((action) => <ActionMenuItem key={action} onSelect={() => manager?.run(action)}>{text[action]}</ActionMenuItem>)}
      <ActionMenuItem disabled={!selection.undo} onSelect={() => manager?.run("undo")}>{labels.undo}</ActionMenuItem>
      <ActionMenuItem disabled={!selection.redo} onSelect={() => manager?.run("redo")}>{labels.redo}</ActionMenuItem>
    </ActionMenu>
    <span className="ui-markdown-editor-toolbar-space" />
    <IconButton className="ui-rich-history" label={labels.undo} disabled={!selection.undo} icon={<Undo2 />} onClick={() => manager?.run("undo")} />
    <IconButton className="ui-rich-history" label={labels.redo} disabled={!selection.redo} icon={<Redo2 />} onClick={() => manager?.run("redo")} />
    <IconButton label={labels.search} icon={<Search />} onClick={onSearch} />
  </div>;
}
