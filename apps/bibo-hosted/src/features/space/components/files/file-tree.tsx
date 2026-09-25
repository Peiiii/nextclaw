import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { BiboFile } from "@nextclaw/bibo-client";
import { Button, IconButton, Input, ListRow } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { FileActions } from "./file-actions";
import { FileKindIcon } from "./file-kind-icon";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
type CreateFile = (path: string, kind?: BiboFile["kind"]) => void;
const parentPath = (path: string): string => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
function indexFileTree(files: BiboFile[], expanded: Record<string, boolean>) {
  const children = new Map<string, BiboFile[]>();
  for (const file of [...files].sort((a, b) => Number(b.kind === "folder") - Number(a.kind === "folder") || a.path.localeCompare(b.path))) {
    const parent = parentPath(file.path);
    const siblings = children.get(parent) ?? [];
    siblings.push(file);
    children.set(parent, siblings);
  }
  const visible = new Set<string>();
  const visit = (path: string) => {
    for (const file of children.get(path) ?? []) {
      visible.add(file.id);
      if (file.kind === "folder" && expanded[file.id]) visit(file.path);
    }
  };
  visit("");
  return { children, visible };
}
function FileSearchResults() {
  const { fileMatches, fileSearchLoading, fileSearchCursor, fileQuery, searchFiles, openFile } = useBiboSpaceStore();
  return (
    <>
      {fileMatches.map((file) => (
        <ListRow
          key={file.id}
          onClick={() => (file.kind === "folder" ? void searchFiles(`${file.path}/`) : void openFile(file.id))}
        >
          <FileKindIcon file={file} />
          <span>
            <strong>{file.path.split("/").at(-1)}</strong>
            <small>{file.path}</small>
          </span>
        </ListRow>
      ))}
      {fileSearchLoading ? (
        <p className="bibo-tree-empty">正在搜索…</p>
      ) : (
        fileMatches.length === 0 && <p className="bibo-tree-empty">没有匹配的文件</p>
      )}
      {fileSearchCursor && (
        <Button tone="text" onClick={() => void searchFiles(fileQuery, true)}>
          更多结果
        </Button>
      )}
    </>
  );
}
function FileTreeContents({ onCreate }: { onCreate: CreateFile }) {
  const { files, activeFileId, expandedFolders: expanded, toggleFolder, openFile, fileQuery } = useBiboSpaceStore();
  const treeRef = useRef<HTMLDivElement>(null);
  const [treeFocus, setTreeFocus] = useState<string | null>(null);
  const treeId = useId();
  const { children, visible } = useMemo(() => indexFileTree(files, expanded), [files, expanded]);
  const tabStop = visible.has(treeFocus ?? "") ? treeFocus
    : visible.has(activeFileId ?? "") ? activeFileId : children.get("")?.[0]?.id;
  const treeKeys = (event: KeyboardEvent<HTMLButtonElement>, file: BiboFile) => {
    const nodes = Array.from(treeRef.current?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]') ?? []);
    const index = nodes.indexOf(event.currentTarget);
    let target: HTMLButtonElement | undefined;
    if (event.key === "ArrowDown") target = nodes[Math.min(index + 1, nodes.length - 1)];
    else if (event.key === "ArrowUp") target = nodes[Math.max(0, index - 1)];
    else if (event.key === "Home") target = nodes[0];
    else if (event.key === "End") target = nodes.at(-1);
    else if (event.key === "ArrowRight" && file.kind === "folder") {
      if (!expanded[file.id]) toggleFolder(file.id);
      else if (parentPath(nodes[index + 1]?.title ?? "") === file.path) target = nodes[index + 1];
    } else if (event.key === "ArrowLeft") {
      if (file.kind === "folder" && expanded[file.id]) toggleFolder(file.id);
      else if (parentPath(file.path)) {
        target = nodes.find((node) => node.title === parentPath(file.path));
      }
    } else return;
    event.preventDefault();
    target?.focus();
  };
  const tree = (parentPath: string, level: number): ReactNode =>
    (children.get(parentPath) ?? [])
      .map((file, index) => (
        <div key={file.id} role="none">
          <div
            className={`bibo-tree-row${activeFileId === file.id ? " is-selected" : ""}`}
            style={{ paddingLeft: 12 + level * 17 }}
            onFocusCapture={() => setTreeFocus(file.id)}
          >
            <button
              className="bibo-tree-main"
              role="treeitem"
              aria-label={file.path.split("/").at(-1)}
              aria-level={level + 1}
              aria-posinset={index + 1}
              aria-setsize={children.get(parentPath)?.length}
              aria-selected={activeFileId === file.id}
              aria-expanded={file.kind === "folder" ? !!expanded[file.id] : undefined}
              aria-owns={file.kind === "folder" && expanded[file.id] ? `${treeId}-${file.id}` : undefined}
              tabIndex={tabStop === file.id ? 0 : -1}
              title={file.path}
              onKeyDown={(event) => treeKeys(event, file)}
              onClick={() => (file.kind === "folder" ? toggleFolder(file.id) : void openFile(file.id))}
            >
              <span className="bibo-tree-disclosure" aria-hidden="true">
                {file.kind === "folder" ? expanded[file.id] ? <ChevronDown /> : <ChevronRight /> : null}
              </span>
              <FileKindIcon file={file} expanded={!!expanded[file.id]} />
              <span className="bibo-tree-name">{file.path.split("/").at(-1)}</span>
            </button>
            {file.kind === "folder" && <>
              <IconButton label={`在 ${file.path} 下创建`} icon={<Plus />} tabIndex={tabStop === file.id ? 0 : -1} onClick={() => onCreate(file.path)} />
              <FileActions file={file} tabIndex={tabStop === file.id ? 0 : -1} />
            </>}
          </div>
          {file.kind === "folder" && expanded[file.id] && <div id={`${treeId}-${file.id}`} role="group">{tree(file.path, level + 1)}</div>}
        </div>
      ));

  return (
    <div
      className="bibo-tree-scroll"
      ref={treeRef}
      role={fileQuery ? "region" : "tree"}
      aria-label={fileQuery ? "文件搜索结果" : "文件目录"}
    >
      {fileQuery ? <FileSearchResults /> : tree("", 0)}
      {files.length === 0 && <p className="bibo-tree-empty">还没有文件。从新建开始。</p>}
    </div>
  );
}
export function FileTree({ onCreate }: { onCreate: CreateFile }) {
  const { treeCollapsed, toggleTree, treeWidth, resizeTree, fileQuery, searchFiles, cursors, moreLoading, loadMore } = useBiboSpaceStore();
  const resizeStart = useRef({ x: 0, width: treeWidth });
  return (
    <aside className="bibo-file-tree">
      <div className="bibo-pane-label">
        <IconButton onClick={toggleTree} label={treeCollapsed ? "展开目录树" : "收起目录树"} icon={treeCollapsed ? <ChevronRight /> : <ChevronLeft />} />
        {!treeCollapsed && (
          <>
            <span>目录</span>
            <IconButton label="新建文件或文件夹" icon={<Plus />} onClick={() => onCreate("", "document")} />
          </>
        )}
      </div>
      {!treeCollapsed && (
        <div className="file-tree-search">
          <Input
            aria-label="搜索文件"
            placeholder="搜索文件…"
            value={fileQuery}
            onChange={(event) => void searchFiles(event.target.value)}
          />
          {fileQuery && (
            <IconButton label="清除搜索" icon={<X />} onClick={() => void searchFiles("")} />
          )}
        </div>
      )}
      {!treeCollapsed && <FileTreeContents onCreate={onCreate} />}
      {!treeCollapsed && !fileQuery && cursors.files && (
        <Button tone="text" disabled={moreLoading.files} onClick={() => void loadMore("files")}>{moreLoading.files ? "正在加载…" : "加载更多文件"}</Button>
      )}
      {!treeCollapsed && (
        <div
          className="file-tree-resizer"
          role="separator"
          aria-label="目录宽度"
          aria-orientation="vertical"
          aria-valuemin={180}
          aria-valuemax={360}
          aria-valuenow={treeWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            resizeStart.current = { x: event.clientX, width: treeWidth };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              resizeTree(resizeStart.current.width + event.clientX - resizeStart.current.x);
          }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              resizeTree(treeWidth + (event.key === "ArrowRight" ? 10 : -10));
            }
          }}
        />
      )}
    </aside>
  );
}
