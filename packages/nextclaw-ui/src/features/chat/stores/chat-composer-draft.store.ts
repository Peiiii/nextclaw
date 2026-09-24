import type { ChatComposerNode } from "@nextclaw/agent-chat-ui";
import type { NcpDraftAttachment } from "@nextclaw/ncp-react";
import type { NcpAgentSendEnvelope } from "@nextclaw/ncp";
import { create, type StoreApi } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ThinkingLevel } from "@/shared/lib/api";

export const CHAT_NEW_SESSION_DRAFT_KEY = "new-session";

type ChatComposerDraftSkillSelection = {
  readonly ref: string;
  readonly name: string;
};

export type ChatComposerDraftSnapshot = {
  readonly text: string;
  readonly nodes: readonly ChatComposerNode[];
  readonly selectedSkills: readonly string[];
  readonly skillRecords: readonly ChatComposerDraftSkillSelection[];
  readonly attachments: readonly NcpDraftAttachment[];
  readonly selectedModel: string | null | undefined;
  readonly selectedThinkingLevel: ThinkingLevel | null;
  readonly pendingSessionType: string;
  readonly selectedSessionType: string | null;
  readonly composerFocusRequestId: number;
  readonly sendError: string | null;
};

export type ChatComposerSubmission = {
  readonly envelope: NcpAgentSendEnvelope;
  readonly composer: Pick<
    ChatComposerDraftSnapshot,
    "text" | "nodes" | "selectedSkills" | "skillRecords" | "attachments"
  >;
  readonly status: "sending" | "uncertain" | "rejected";
};

type ChatComposerDraftStore = {
  drafts: Record<string, ChatComposerDraftSnapshot>;
  submissions: Record<string, ChatComposerSubmission>;
  recentSubmittedNodes: Record<string, string>;
  ensureDraft: (
    draftKey: string,
    initialSnapshot: ChatComposerDraftSnapshot,
  ) => void;
  updateDraft: (
    draftKey: string,
    initialSnapshot: ChatComposerDraftSnapshot,
    update: (snapshot: ChatComposerDraftSnapshot) => ChatComposerDraftSnapshot,
  ) => void;
  beginSubmission: (
    draftKey: string,
    initialSnapshot: ChatComposerDraftSnapshot,
    submission: ChatComposerSubmission,
  ) => void;
  acceptSubmission: (draftKey: string, messageId: string) => void;
  failSubmission: (
    draftKey: string,
    messageId: string,
    status: "uncertain" | "rejected",
    message: string,
  ) => void;
  restoreSubmission: (draftKey: string, messageId: string) => void;
  discardSubmission: (draftKey: string, messageId: string) => void;
};

const CHAT_COMPOSER_DRAFT_STORAGE_KEY = "nextclaw.chat.composer-drafts";
const CHAT_COMPOSER_DRAFT_STORAGE_VERSION = 1;

const isComposerEmpty = (draft: ChatComposerDraftSnapshot): boolean =>
  draft.attachments.length === 0 &&
  draft.selectedSkills.length === 0 &&
  !draft.text.trim();

const restoreComposer = (
  draft: ChatComposerDraftSnapshot,
  submission: ChatComposerSubmission,
): ChatComposerDraftSnapshot => ({ ...draft, ...submission.composer });

export function resolveChatComposerDraftKey(sessionKey: string | null): string {
  const normalizedSessionKey = sessionKey?.trim();
  return normalizedSessionKey
    ? `session:${normalizedSessionKey}`
    : CHAT_NEW_SESSION_DRAFT_KEY;
}

class ChatComposerDraftActions {
  constructor(
    private readonly set: StoreApi<ChatComposerDraftStore>["setState"],
  ) {}

  ensureDraft: ChatComposerDraftStore["ensureDraft"] = (
    draftKey,
    initialSnapshot,
  ) => {
    this.set((state) =>
      state.drafts[draftKey]
        ? state
        : {
            drafts: {
              ...state.drafts,
              [draftKey]: initialSnapshot,
            },
          },
    );
  };

  updateDraft: ChatComposerDraftStore["updateDraft"] = (
    draftKey,
    initialSnapshot,
    update,
  ) => {
    this.set((state) => {
      const current = state.drafts[draftKey] ?? initialSnapshot;
      const next = update(current);
      const submittedNodes = state.recentSubmittedNodes[draftKey];
      if (
        submittedNodes &&
        isComposerEmpty(current) &&
        !isComposerEmpty(next) &&
        JSON.stringify(next.nodes) === submittedNodes
      ) {
        return state;
      }
      return {
        drafts: { ...state.drafts, [draftKey]: next },
        recentSubmittedNodes:
          submittedNodes && !isComposerEmpty(next)
            ? Object.fromEntries(
                Object.entries(state.recentSubmittedNodes).filter(
                  ([key]) => key !== draftKey,
                ),
              )
            : state.recentSubmittedNodes,
      };
    });
  };

  beginSubmission: ChatComposerDraftStore["beginSubmission"] = (
    draftKey,
    initialSnapshot,
    submission,
  ) => {
    this.set((state) => ({
      drafts: {
        ...state.drafts,
        [draftKey]: {
          ...(state.drafts[draftKey] ?? initialSnapshot),
          text: "",
          nodes: [],
          selectedSkills: [],
          skillRecords: [],
          attachments: [],
          sendError: null,
        },
      },
      submissions: { ...state.submissions, [draftKey]: submission },
      recentSubmittedNodes: {
        ...state.recentSubmittedNodes,
        [draftKey]: JSON.stringify(submission.composer.nodes),
      },
    }));
  };

  acceptSubmission: ChatComposerDraftStore["acceptSubmission"] = (
    draftKey,
    messageId,
  ) => {
    this.set((state) => {
      if (state.submissions[draftKey]?.envelope.message.id !== messageId)
        return state;
      const submissions = { ...state.submissions };
      delete submissions[draftKey];
      return { submissions };
    });
  };

  failSubmission: ChatComposerDraftStore["failSubmission"] = (
    draftKey,
    messageId,
    status,
    message,
  ) => {
    this.set((state) => {
      const submission = state.submissions[draftKey];
      if (!submission || submission.envelope.message.id !== messageId)
        return state;
      const draft = state.drafts[draftKey];
      if (!draft) return state;
      const shouldRestore = status === "rejected" && isComposerEmpty(draft);
      const submissions = { ...state.submissions };
      if (shouldRestore) delete submissions[draftKey];
      else submissions[draftKey] = { ...submission, status };
      const recentSubmittedNodes = { ...state.recentSubmittedNodes };
      if (shouldRestore) delete recentSubmittedNodes[draftKey];
      return {
        submissions,
        recentSubmittedNodes,
        drafts: {
          ...state.drafts,
          [draftKey]: {
            ...(shouldRestore ? restoreComposer(draft, submission) : draft),
            sendError: message,
          },
        },
      };
    });
  };

  restoreSubmission: ChatComposerDraftStore["restoreSubmission"] = (
    draftKey,
    messageId,
  ) => {
    this.set((state) => {
      const submission = state.submissions[draftKey];
      const draft = state.drafts[draftKey];
      if (
        !submission ||
        submission.status !== "rejected" ||
        submission.envelope.message.id !== messageId ||
        !draft ||
        !isComposerEmpty(draft)
      )
        return state;
      const submissions = { ...state.submissions };
      delete submissions[draftKey];
      const recentSubmittedNodes = { ...state.recentSubmittedNodes };
      delete recentSubmittedNodes[draftKey];
      return {
        submissions,
        recentSubmittedNodes,
        drafts: {
          ...state.drafts,
          [draftKey]: restoreComposer(draft, submission),
        },
      };
    });
  };

  discardSubmission: ChatComposerDraftStore["discardSubmission"] = (
    draftKey,
    messageId,
  ) => {
    this.set((state) => {
      if (state.submissions[draftKey]?.envelope.message.id !== messageId)
        return state;
      const submissions = { ...state.submissions };
      delete submissions[draftKey];
      return { submissions };
    });
  };
}

export const useChatComposerDraftStore = create<ChatComposerDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      submissions: {},
      recentSubmittedNodes: {},
      ...new ChatComposerDraftActions(set),
    }),
    {
      name: CHAT_COMPOSER_DRAFT_STORAGE_KEY,
      version: CHAT_COMPOSER_DRAFT_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        drafts: Object.fromEntries(
          Object.entries(state.drafts).map(([draftKey, snapshot]) => [
            draftKey,
            {
              ...snapshot,
              composerFocusRequestId: 0,
              sendError: null,
            },
          ]),
        ),
        submissions: Object.fromEntries(
          Object.entries(state.submissions).map(([draftKey, submission]) => [
            draftKey,
            {
              ...submission,
              status:
                submission.status === "sending"
                  ? "uncertain"
                  : submission.status,
            },
          ]),
        ),
      }),
    },
  ),
);
