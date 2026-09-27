import type { BiboFile } from "@nextclaw/bibo-client";
import { FileCode2, FileJson2, FileText, Folder, FolderOpen, NotebookText, Sparkles } from "lucide-react";

export function FileKindIcon({ file, expanded = false }: { file: Pick<BiboFile, "kind" | "path">; expanded?: boolean }) {
  let Icon = FileText;
  if (file.kind === "folder") Icon = expanded ? FolderOpen : Folder;
  else if (file.kind === "note") Icon = NotebookText;
  else if (file.kind === "artifact") Icon = Sparkles;
  else if (/\.(html?|jsx?|tsx?)$/i.test(file.path)) Icon = FileCode2;
  else if (/\.json$/i.test(file.path)) Icon = FileJson2;
  return <span className="bibo-file-kind-icon" aria-hidden="true"><Icon /></span>;
}
