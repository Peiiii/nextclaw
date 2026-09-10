import type {
  DiscussionActor,
  DiscussionEvent,
  DiscussionEventPage,
  DiscussionEventType,
  DiscussionPost,
  DiscussionThread,
  DiscussionThreadPage,
  DiscussionThreadView,
} from "@nextclaw/shared";
import type { D1BindValue, D1Database, D1PreparedStatement } from "../portal-env.types.js";

export type DiscussionWriteCondition = { sql: string; values: D1BindValue[] };

type ThreadRow = {
  id: string;
  space: string;
  title: string;
  opened_by_json: string;
  created_at: string;
  updated_at: string;
  last_event_cursor: number;
};
type PostRow = {
  id: string;
  thread_id: string;
  sequence: number;
  author_json: string;
  body: string;
  payload_hash: string;
  created_at: string;
};
type EventRow = {
  cursor: number;
  event_type: string;
  thread_id: string;
  post_id: string | null;
  audience_role: string;
  created_at: string;
};

export class DiscussionRepository {
  constructor(readonly db: D1Database) {}

  get = async (id: string): Promise<DiscussionThreadView | null> => {
    const row = await this.db.prepare("SELECT * FROM discussion_threads WHERE id=?").bind(id).first<ThreadRow>();
    if (!row) return null;
    const posts = await this.db.prepare("SELECT * FROM discussion_posts WHERE thread_id=? ORDER BY sequence")
      .bind(id).all<PostRow>();
    return { thread: this.thread(row), posts: posts.results.map(this.post) };
  };

  getPost = async (id: string): Promise<(DiscussionPost & { payloadHash: string }) | null> => {
    const row = await this.db.prepare("SELECT * FROM discussion_posts WHERE id=?").bind(id).first<PostRow>();
    return row ? { ...this.post(row), payloadHash: row.payload_hash } : null;
  };

  list = async (space: string, before: number, limit = 20): Promise<DiscussionThreadPage> => {
    const result = await this.db.prepare(`SELECT * FROM discussion_threads
      WHERE space=? AND (?=0 OR last_event_cursor<?)
      ORDER BY last_event_cursor DESC, id LIMIT ?`).bind(space, before, before, limit + 1).all<ThreadRow>();
    const items = result.results.slice(0, limit).map(this.thread);
    return { items, nextCursor: result.results.length > limit ? items.at(-1)!.lastEventCursor : null };
  };

  events = async (after: number, spaces: string[], audienceRole: string, limit = 100): Promise<DiscussionEventPage> => {
    if (!spaces.length) return { items: [], nextCursor: after };
    const placeholders = spaces.map(() => "?").join(",");
    const result = await this.db.prepare(`SELECT e.* FROM discussion_events e
      JOIN discussion_threads t ON t.id=e.thread_id
      WHERE e.cursor>? AND e.audience_role=? AND t.space IN (${placeholders})
      ORDER BY e.cursor LIMIT ?`).bind(after, audienceRole, ...spaces, limit + 1).all<EventRow>();
    const items = result.results.slice(0, limit).map(this.event);
    if (result.results.length > limit) return { items, nextCursor: items.at(-1)!.cursor };
    const highWater = await this.db.prepare(`SELECT COALESCE(MAX(e.cursor), ?) AS cursor FROM discussion_events e
      JOIN discussion_threads t ON t.id=e.thread_id WHERE t.space IN (${placeholders})`)
      .bind(after, ...spaces).first<{ cursor: number }>();
    return { items, nextCursor: highWater?.cursor ?? after };
  };

  prepareCreate = (thread: DiscussionThread, opening: DiscussionPost, payloadHash: string, audienceRole: string): D1PreparedStatement[] => [
    this.db.prepare(`INSERT INTO discussion_threads
      (id,space,title,opened_by_json,created_at,updated_at,last_event_cursor) VALUES (?,?,?,?,?,?,0)`)
      .bind(thread.id, thread.space, thread.title, JSON.stringify(thread.openedBy), thread.createdAt, thread.updatedAt),
    this.db.prepare(`INSERT INTO discussion_posts
      (id,thread_id,sequence,author_json,body,payload_hash,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(opening.id, opening.threadId, opening.sequence, JSON.stringify(opening.author), opening.body, payloadHash, opening.createdAt),
    this.db.prepare("INSERT INTO discussion_events(event_type,thread_id,post_id,audience_role,created_at) VALUES ('thread-created',?,?,?,?)")
      .bind(thread.id, opening.id, audienceRole, thread.createdAt),
    this.cursorStatement(thread.id, thread.updatedAt),
  ];

  preparePost = (post: Omit<DiscussionPost, "sequence">, payloadHash: string, audienceRole: string, eventType: DiscussionEventType = "post-created", condition?: DiscussionWriteCondition): D1PreparedStatement[] => [
    this.db.prepare(`INSERT INTO discussion_posts
      (id,thread_id,sequence,author_json,body,payload_hash,created_at)
      SELECT ?,?,COALESCE((SELECT MAX(sequence)+1 FROM discussion_posts WHERE thread_id=?),1),?,?,?,?
      WHERE EXISTS (SELECT 1 FROM discussion_threads WHERE id=?)${condition ? ` AND ${condition.sql}` : ""}`)
      .bind(post.id, post.threadId, post.threadId, JSON.stringify(post.author), post.body, payloadHash, post.createdAt, post.threadId, ...(condition?.values ?? [])),
    this.db.prepare("INSERT INTO discussion_events(event_type,thread_id,post_id,audience_role,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM discussion_posts WHERE id=?)")
      .bind(eventType, post.threadId, post.id, audienceRole, post.createdAt, post.id),
    this.cursorStatement(post.threadId, post.createdAt),
  ];

  prepareTouch = (threadId: string, createdAt: string, audienceRole: string, condition?: DiscussionWriteCondition): D1PreparedStatement[] => [
    this.db.prepare(`INSERT INTO discussion_events(event_type,thread_id,post_id,audience_role,created_at)
      SELECT 'thread-updated',?,NULL,?,?${condition ? ` WHERE ${condition.sql}` : ""}`)
      .bind(threadId, audienceRole, createdAt, ...(condition?.values ?? [])),
    this.cursorStatement(threadId, createdAt),
  ];

  private cursorStatement = (threadId: string, updatedAt: string): D1PreparedStatement =>
    this.db.prepare(`UPDATE discussion_threads SET updated_at=?, last_event_cursor=(SELECT MAX(cursor) FROM discussion_events WHERE thread_id=?) WHERE id=?`)
      .bind(updatedAt, threadId, threadId);

  private thread = (row: ThreadRow): DiscussionThread => ({
    id: row.id,
    space: row.space,
    title: row.title,
    openedBy: JSON.parse(row.opened_by_json) as DiscussionActor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEventCursor: row.last_event_cursor,
  });

  private post = (row: PostRow): DiscussionPost => ({
    id: row.id,
    threadId: row.thread_id,
    sequence: row.sequence,
    author: JSON.parse(row.author_json) as DiscussionActor,
    body: row.body,
    createdAt: row.created_at,
  });

  private event = (row: EventRow): DiscussionEvent => ({
    cursor: row.cursor,
    type: row.event_type as DiscussionEventType,
    threadId: row.thread_id,
    postId: row.post_id,
    audienceRole: row.audience_role,
    createdAt: row.created_at,
  });
}
