import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { Button, EmptyState, IconButton, LoadingState, Notice, Popover } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { FileKindIcon } from "./file-kind-icon";

function DirectoryBrowser({ path, onNavigate, onOpenFile }: { path: string; onNavigate: (path: string) => void; onOpenFile: (id: string) => void }) {
  const { files, fileDetails, cursors, moreLoading, loadMore, readStatus, error, load } = useBiboSpaceStore();
  const entries = [...new Map([...files, ...Object.values(fileDetails)].map((file) => [file.id, file])).values()]
    .filter((file) => file.path.slice(0, Math.max(0, file.path.lastIndexOf("/"))) === path)
    .sort((a, b) => Number(b.kind === "folder") - Number(a.kind === "folder") || a.path.localeCompare(b.path));
  return <div className="file-directory-browser">
    <div className="file-directory-location">
      {path && <IconButton label={copy.fileParent} icon={<ChevronLeft />} tooltip={false} onClick={() => onNavigate(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "")} />}
      <span title={path}>{path || copy.fileRoot}</span>
    </div>
    {readStatus.files === "loading" && <LoadingState label="正在读取目录" />}
    {error && <div><Notice tone="error">{error}</Notice><Button tone="text" onClick={() => void load("files")}>{copy.fileDirectoryRetry}</Button></div>}
    {entries.map((file) => <Button key={file.id} tone="text" className="file-directory-entry"
      onClick={() => file.kind === "folder" ? onNavigate(file.path) : onOpenFile(file.id)}>
      <FileKindIcon file={file} /><span title={file.path}>{file.path.split("/").at(-1)}</span>{file.kind === "folder" && <ChevronRight aria-hidden="true" />}
    </Button>)}
    {!entries.length && !cursors.files && readStatus.files === "ready" && !error && <EmptyState title={copy.fileEmptyDirectory} />}
    {cursors.files && <Button tone="text" disabled={moreLoading.files} onClick={() => void loadMore("files")}>{copy.fileMore}</Button>}
  </div>;
}

function DirectorySegment({ label, path, current, iconOnly, onOpenFile }: { label: string; path: string; current?: boolean; iconOnly?: boolean; onOpenFile: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState(path);
  return <Popover open={open} label={copy.fileDirectory} onOpenChange={(value) => {
    setOpen(value);
    if (value) {
      setBrowsePath(path);
      const store = useBiboSpaceStore.getState();
      if (store.readStatus.files !== "ready") void store.load("files");
    }
  }} trigger={iconOnly ? <IconButton label={label} icon={<FolderOpen />} /> : <Button tone="text" aria-current={current ? "page" : undefined}>
    {!path && !current && <FolderOpen aria-hidden="true" />}{label}{current && <ChevronDown aria-hidden="true" />}
  </Button>}>
    <DirectoryBrowser path={browsePath} onNavigate={setBrowsePath} onOpenFile={(id) => { onOpenFile(id); setOpen(false); }} />
  </Popover>;
}

export function FileDirectoryButton({ onOpenFile }: { onOpenFile: (id: string) => void }) {
  return <DirectorySegment label={copy.fileDirectory} path="" iconOnly onOpenFile={onOpenFile} />;
}

export function FileBreadcrumbs({ path, onOpenFile }: { path: string; onOpenFile: (id: string) => void }) {
  const scroll = useRef<HTMLElement>(null);
  useEffect(() => {
    const current = scroll.current?.querySelector<HTMLElement>('[aria-current="page"]');
    current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [path]);
  const parts = path.split("/");
  return <nav className="file-breadcrumb" ref={scroll} aria-label="文件路径" title={path}>
    <DirectorySegment label={copy.fileRoot} path="" onOpenFile={onOpenFile} />
    {parts.map((part, index) => <Fragment key={`${index}-${part}`}>
      <ChevronRight aria-hidden="true" />
      <DirectorySegment label={part} path={parts.slice(0, index === parts.length - 1 ? index : index + 1).join("/")} current={index === parts.length - 1} onOpenFile={onOpenFile} />
    </Fragment>)}
  </nav>;
}
