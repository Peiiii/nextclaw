import { useState } from "react";
import { ListTree } from "lucide-react";
import { Button, IconButton, Popover, SegmentedControl } from "@nextclaw/personal-agent-ui";
import type { FileDocumentManager, FileDocumentView } from "@/features/space/managers/file-document.manager";
import { biboCopy } from "@/shared/configs/bibo-copy.config";

export function FileDocumentTools({ manager, view }: { manager: FileDocumentManager; view: FileDocumentView }) {
  const [open, setOpen] = useState(false);
  const copy = biboCopy.documentView;
  const changeOpen = (value: boolean) => { manager.open(value); setOpen(value); };
  return <Popover label={copy.title} open={open} onOpenChange={changeOpen}
    trigger={<IconButton label={copy.title} icon={<ListTree />} />}>
    <div className="bibo-document-tools">
      <div className="bibo-document-outline-title">{copy.outline}</div>
      <nav aria-label={copy.outline} className="bibo-document-outline">
        {view.headings.length ? view.headings.map((heading, index) => <Button key={index} tone="text"
          style={{ paddingInlineStart: 8 + (heading.level - 1) * 12 }}
          onClick={() => { manager.navigate(index); changeOpen(false); }}>{heading.title || copy.untitled}</Button>)
          : <p>{copy.empty}</p>}
      </nav>
      <div className="bibo-document-appearance">
        <div><span>{copy.width}</span><SegmentedControl label={copy.width} value={view.wide ? "wide" : "standard"}
          options={[{ value: "standard", label: copy.standard }, { value: "wide", label: copy.wide }]} onChange={value => manager.appearance("wide", value === "wide")} /></div>
        <div><span>{copy.font}</span><SegmentedControl label={copy.font} value={view.small ? "small" : "standard"}
          options={[{ value: "standard", label: copy.standard }, { value: "small", label: copy.small }]} onChange={value => manager.appearance("small", value === "small")} /></div>
      </div>
      <p className="bibo-document-statistics">{copy.characters.replace("{count}", view.characters.toLocaleString())}</p>
    </div>
  </Popover>;
}
