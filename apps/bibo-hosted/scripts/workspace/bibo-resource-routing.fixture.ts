import assert from "node:assert/strict";
import type { Page, Route } from "playwright";
import { mockApi } from "../personal-workspace.fixture";

export const nestedNoteId = "笔记/功能演示 - 起步.md";
export const documentId = "Mermaid 图表示例.md";
const at = "2026-09-26T00:00:00.000Z";

export class ResourceRoutingFixture {
  readonly document = { id: documentId, path: documentId, kind: "document", content: "# Mermaid 图表示例\n\n普通 Markdown 也能继续编辑。", version: 1, uri: `nextclaw://objects/file/${encodeURIComponent(documentId)}`, createdAt: at, updatedAt: at };
  readonly calls: Array<{ action: string; input: Record<string, unknown> }> = [];
  readonly chunks: string[] = [];
  readonly pendingLists: Array<() => void> = [];
  readonly pendingDetails: Array<() => void> = [];
  private listsHeld = false;
  private detailHeld = false;
  private slowDetail = () => {};
  holdLists = (value: boolean): void => { this.listsHeld = value; };
  holdDetail = (value: boolean): void => { this.detailHeld = value; };
  releaseLists = (): void => { this.pendingLists.splice(0).forEach(release => release()); };
  releaseDomainDetails = (): void => { this.pendingDetails.splice(0).forEach(release => release()); };
  releaseDetail = (): void => { this.slowDetail(); };
  private respond = async (route: Route): Promise<void> => {
    const body = route.request().postDataJSON();
    this.calls.push(body);
    if (body.action.endsWith(".list") && this.listsHeld) await new Promise<void>(resolve => this.pendingLists.push(resolve));
    if (body.action === "file.get" && body.input.id === documentId) {
      if (this.detailHeld) await new Promise<void>(resolve => { this.slowDetail = resolve; });
      return route.fulfill({ json: { result: this.document } });
    }
    if (body.action === "file.update" && body.input.id === documentId) {
      assert.equal(body.input.version, this.document.version);
      this.document.content = body.input.content;
      this.document.version++;
      return route.fulfill({ json: { result: this.document } });
    }
    if (body.action === "file.list" && body.input.parentPath === "") return route.fulfill({ json: { result: { items: [this.document], nextCursor: null } } });
    if (this.detailHeld && ["task.get", "event.get", "inbox.get"].includes(body.action)) await new Promise<void>(resolve => this.pendingDetails.push(resolve));
    if (body.action === "file.get" && body.input.id === nestedNoteId) return route.fulfill({ json: { result: { id: nestedNoteId, path: nestedNoteId, kind: "note", content: "# 嵌套正文", version: 1, uri: `nextclaw://objects/file/${encodeURIComponent(nestedNoteId)}`, createdAt: at, updatedAt: at } } });
    if (body.action === "file.get" && body.input.id === "slow") {
      if (this.detailHeld) await new Promise<void>(resolve => { this.slowDetail = resolve; });
      return route.fulfill({ json: { result: { id: "slow", path: "slow.md", kind: "note", content: "迟到的正文", version: 1, uri: "nextclaw://objects/file/slow", createdAt: at, updatedAt: at } } });
    }
    return route.fallback();
  };
  bind = async (page: Page): Promise<void> => {
    page.on("request", request => { if (request.url().includes("/assets/")) this.chunks.push(request.url()); });
    await mockApi(page);
    await page.route("**/api/space", this.respond);
    await page.addInitScript(() => localStorage.setItem("space-layout:smoke", JSON.stringify({ tabs: ["file-a", "slow"], activeFileId: "file-a", workspaceOpen: true, workspaceFileId: "slow" })));
  };
}
