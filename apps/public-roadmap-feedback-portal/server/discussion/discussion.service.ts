import type {
  DiscussionActor,
  DiscussionEventPage,
  DiscussionPost,
  DiscussionThread,
  DiscussionThreadCreateInput,
  DiscussionThreadPage,
  DiscussionThreadView,
} from "@nextclaw/shared";
import { digest, identifier, reject, textField } from "../support/support-validation.utils.js";
import type { DiscussionRepository } from "./discussion.repository.js";
import { DiscussionTransactionService } from "./discussion-transaction.service.js";

export class DiscussionService {
  private readonly transaction: DiscussionTransactionService;
  constructor(readonly repository: DiscussionRepository) {
    this.transaction = new DiscussionTransactionService(repository.db);
  }

  create = async (space: string, raw: DiscussionThreadCreateInput, actor: DiscussionActor, audienceRole: string): Promise<DiscussionThreadView> => {
    const id = identifier(raw.requestId);
    const title = textField(raw.title, "标题", 100);
    const body = textField(raw.body, "正文", 8000);
    const payloadHash = await digest(JSON.stringify({ space, title, body, actor }));
    const existing = await this.repository.get(id);
    if (existing) {
      const opening = await this.repository.getPost(id + ":opening");
      if (opening?.payloadHash !== payloadHash) reject(409, "会话标识已被其它内容使用。");
      return existing;
    }
    const now = new Date().toISOString();
    const thread: DiscussionThread = { id, space, title, openedBy: actor, createdAt: now, updatedAt: now, lastEventCursor: 0 };
    const opening: DiscussionPost = { id: id + ":opening", threadId: id, sequence: 1, author: actor, body, createdAt: now };
    await this.transaction.commit(this.repository.prepareCreate(thread, opening, payloadHash, audienceRole));
    return (await this.repository.get(id))!;
  };

  post = async (threadId: string, operationId: string, bodyValue: unknown, actor: DiscussionActor, audienceRole: string, spaces: string[]): Promise<DiscussionThreadView> => {
    const thread = await this.requireThread(identifier(threadId));
    if (!spaces.includes(thread.thread.space)) reject(403, "无权访问此会话。");
    const id = identifier(operationId);
    const body = textField(bodyValue, "回复", 4000);
    const payloadHash = await digest(JSON.stringify({ threadId: thread.thread.id, body, actor }));
    const existing = await this.repository.getPost(id);
    if (existing) {
      if (existing.payloadHash !== payloadHash) reject(409, "操作标识已被其它内容使用。");
      return thread;
    }
    const now = new Date().toISOString();
    await this.transaction.commit(this.repository.preparePost({ id, threadId: thread.thread.id, author: actor, body, createdAt: now }, payloadHash, audienceRole));
    return (await this.repository.get(thread.thread.id))!;
  };

  get = async (id: string, spaces: string[]): Promise<DiscussionThreadView> => {
    const view = await this.requireThread(identifier(id));
    if (!spaces.includes(view.thread.space)) reject(403, "无权访问此会话。");
    return view;
  };

  list = async (space: string, before: number): Promise<DiscussionThreadPage> =>
    this.repository.list(space, before);

  events = async (after: number, spaces: string[], audienceRole: string): Promise<DiscussionEventPage> =>
    this.repository.events(after, spaces, audienceRole);

  private requireThread = async (id: string): Promise<DiscussionThreadView> => {
    const value = await this.repository.get(id);
    if (!value) reject(404, "会话不存在。");
    return value;
  };
}
