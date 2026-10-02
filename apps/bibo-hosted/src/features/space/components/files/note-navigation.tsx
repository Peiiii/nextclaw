import { Link } from "react-router";
import { NavigationItem } from "@nextclaw/personal-agent-ui";
import { FileText, Library, SquarePen } from "lucide-react";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { resourceHref } from "@/app/workspace-router";

export function NoteNavigation({ onNavigate }: { onNavigate: () => void }) {
  const { notes, activeFileId, fileBrowserVisible, createNote, saving } = useBiboSpaceStore();
  return <nav className="bibo-session-nav" aria-label={copy.notes}>
    <NavigationItem label={copy.newNote} tooltip={false}><button className="bibo-new-chat" disabled={saving} onClick={() => void createNote().then(created => { if (created) onNavigate(); })}><SquarePen aria-hidden="true" /><span>{copy.newNote}</span></button></NavigationItem>
    <NavigationItem label={copy.allNotes} selected={fileBrowserVisible} tooltip={false}>
      <Link to="/notes" className="bibo-session-item" onClick={onNavigate}><Library />{copy.allNotes}</Link>
    </NavigationItem>
    <div className="bibo-session-head bibo-note-nav-heading">{copy.recent}</div>
    {notes.map(file => <NavigationItem key={file.id} label={file.path} selected={!fileBrowserVisible && activeFileId === file.id} truncatedLabel>
      <Link to={resourceHref("notes", file.id)} className="bibo-session-item" onClick={onNavigate}><FileText /><span className="bibo-session-title">{file.path.split("/").at(-1)?.replace(/\.(md|markdown|mdown)$/i, "")}</span></Link>
    </NavigationItem>)}
  </nav>;
}
