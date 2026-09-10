export type DiscussionActorKind =
  | "human"
  | "agent"
  | "service"
  | "anonymous";

export type DiscussionActor = {
  id: string | null;
  kind: DiscussionActorKind;
  displayName: string;
  roles: string[];
  authenticated: boolean;
};

export type DiscussionThread = {
  id: string;
  space: string;
  title: string;
  openedBy: DiscussionActor;
  createdAt: string;
  updatedAt: string;
  lastEventCursor: number;
};

export type DiscussionPost = {
  id: string;
  threadId: string;
  sequence: number;
  author: DiscussionActor;
  body: string;
  createdAt: string;
};

export type DiscussionEventType =
  | "thread-created"
  | "post-created"
  | "thread-updated";

export type DiscussionEvent = {
  cursor: number;
  type: DiscussionEventType;
  threadId: string;
  postId: string | null;
  audienceRole: string;
  createdAt: string;
};

export type DiscussionThreadView = {
  thread: DiscussionThread;
  posts: DiscussionPost[];
};

export type DiscussionThreadPage = {
  items: DiscussionThread[];
  nextCursor: number | null;
};

export type DiscussionEventPage = {
  items: DiscussionEvent[];
  nextCursor: number;
};

export type DiscussionThreadCreateInput = {
  requestId: string;
  title: string;
  body: string;
};

export type DiscussionPostCreateInput = {
  operationId: string;
  body: string;
};
