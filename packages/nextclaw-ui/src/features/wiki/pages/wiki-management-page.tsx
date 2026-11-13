import { useState } from "react";
import { BookOpen, Plus, Search, FileText, Trash2, Settings } from "lucide-react";
import { useWikiConfigStore } from "@/features/wiki/stores/wiki-config.store";

type WikiEntry = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

const MOCK_WIKI_ENTRIES: WikiEntry[] = [
  { id: "1", title: "快速开始", content: "欢迎使用 NextClaw 知识库", updatedAt: "2026-09-06" },
  { id: "2", title: "配置指南", content: "如何配置 NextClaw", updatedAt: "2026-09-05" },
];

export function WikiManagementPage() {
  const [entries, setEntries] = useState<WikiEntry[]>(MOCK_WIKI_ENTRIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<WikiEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { storagePath, name, updateConfig } = useWikiConfigStore();

  const filteredEntries = entries.filter(
    (e) => e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    const newEntry: WikiEntry = {
      id: String(Date.now()),
      title: "新页面",
      content: "",
      updatedAt: new Date().toISOString().split("T")[0],
    };
    setEntries([newEntry, ...entries]);
    setSelectedEntry(newEntry);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
    if (selectedEntry?.id === id) setSelectedEntry(null);
  };

  const handleSave = () => {
    if (selectedEntry) {
      setEntries(entries.map((e) => (e.id === selectedEntry.id ? selectedEntry : e)));
      setIsEditing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* 左侧列表 */}
      <div className="w-64 border-r border-border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5" />
            知识库
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-md border border-border p-1.5 hover:bg-accent"
              title="设置"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 设置面板 */}
        {showSettings ? (
          <div className="mb-4 rounded-lg border border-border p-3 space-y-3">
            <h3 className="text-sm font-medium">知识库设置</h3>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">存储地址</label>
              <input
                type="text"
                value={storagePath}
                onChange={(e) => updateConfig({ storagePath: e.target.value })}
                placeholder="~/knowledge-base"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              当前路径: {storagePath}
            </p>
          </div>
        ) : null}

        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索知识库..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent ${
                selectedEntry?.id === entry.id ? "bg-accent" : ""
              }`}
              onClick={() => { setSelectedEntry(entry); setIsEditing(false); }}
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {entry.title}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧编辑区 */}
      <div className="flex-1 p-6">
        {selectedEntry ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              {isEditing ? (
                <input
                  type="text"
                  value={selectedEntry.title}
                  onChange={(e) => setSelectedEntry({ ...selectedEntry, title: e.target.value })}
                  className="text-2xl font-bold border-b border-border bg-transparent outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold">{selectedEntry.title}</h1>
              )}
              <div className="flex gap-2">
                {isEditing ? (
                  <button type="button" onClick={handleSave} className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">保存</button>
                ) : (
                  <button type="button" onClick={() => setIsEditing(true)} className="rounded-md border border-border px-4 py-2 hover:bg-accent">编辑</button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">更新于 {selectedEntry.updatedAt}</p>
            {isEditing ? (
              <textarea
                value={selectedEntry.content}
                onChange={(e) => setSelectedEntry({ ...selectedEntry, content: e.target.value })}
                className="w-full h-96 rounded-md border border-border bg-background p-3 text-sm"
              />
            ) : (
              <div className="prose prose-sm max-w-none">{selectedEntry.content || <p className="text-muted-foreground">暂无内容</p>}</div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>选择一个页面开始编辑</p>
          </div>
        )}
      </div>
    </div>
  );
}
