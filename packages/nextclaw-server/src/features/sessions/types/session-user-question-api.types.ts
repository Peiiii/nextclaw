import type { UserQuestionResolution, UserQuestionView } from "@nextclaw/kernel";

export type UiNcpSessionUserQuestionsView = {
  sessionId: string;
  questions: UserQuestionView[];
};

export type UiNcpSessionUserQuestionResolutionView = UserQuestionResolution;
