import type { DiscussionActor } from "./discussion.types.js";
export const SUPPORT_STATUSES = ["received", "needs-info", "needs-decision", "working", "ready", "published", "resolved", "withdrawn"] as const;
export type SupportStatus = typeof SUPPORT_STATUSES[number];
export const SUPPORT_KINDS = ["bug", "usage", "request", "duplicate", "unknown"] as const;
export type SupportKind = typeof SUPPORT_KINDS[number];
export type SupportAuthority = "analyze" | "repair" | "deliver";
export type SupportReviewDecision = "repair" | "deliver" | "needs-info" | "reject" | "revoke";
export type SupportMessage = {
  id: string;
  actor: DiscussionActor;
  body: string;
  createdAt: string;
};
export type SupportRelease = { version: string; channel: "npm" | "runtime" | "desktop"; sha: string; runId: string; url: string };
export type SupportReport = {
  id: string; title: string; description: string; environment: string; version: string;
  status: SupportStatus; kind: SupportKind; priority: number; authority: SupportAuthority;
  identity: "anonymous" | "verified"; createdAt: string; updatedAt: string; revision: number;
  openedBy: DiscussionActor;
  inputVersion: number; runId: string | null; attempts: number;
  messages: SupportMessage[]; release: SupportRelease | null;
  evidence: string; relatedUrl: string | null; fixedCommit?: string;
  approval?: { inputVersion: number; authority: "repair" | "deliver"; reviewedAt: string } | null;
};
export type SupportReceipt = { id: string; key: string; endpoint: string; title: string };
export type SupportSubmission = {
  requestId: string; receiptKey: string; title: string; description: string; environment?: string; version?: string;
};
export type SupportOperation = { operationId: string; action: "reply" | "withdraw" | "reopen" | "link"; body?: string };
export type SupportWorkflowOperation = {
  operationId: string; revision: number; runId: string | null; action: "triage" | "claim" | "reply" | "checkpoint" | "recover" | "authorize-delivery" | "publish" | "review";
  decision?: SupportReviewDecision;
  body?: string; kind?: SupportKind; priority?: number; authority?: SupportAuthority;
  status?: SupportStatus; evidence?: string; relatedUrl?: string; release?: SupportRelease; fixedCommit?: string;
};
export type SupportPage = { items: SupportReport[]; nextCursor: string | null };
export type SupportReviewPage = { items: SupportReport[]; total: number; page: number; pageSize: number; maxAuthority: SupportAuthority };
