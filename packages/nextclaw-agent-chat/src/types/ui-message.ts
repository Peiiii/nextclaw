import type { ToolInvocationStatus } from './agent.js';

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
type JSONObject = {
  [key: string]: JSONValue;
};
type JSONArray = JSONValue[];

type LanguageModelV1ProviderMetadata = Record<string, Record<string, JSONValue>>;

type LanguageModelV1Source = {
  sourceType: 'url';
  id: string;
  url: string;
  title?: string;
  providerMetadata?: LanguageModelV1ProviderMetadata;
};

export interface ToolInvocation<ARGS = unknown, RESULT = unknown> {
  status: ToolInvocationStatus;
  toolCallId: string;
  toolName: string;
  args: string;
  parsedArgs?: ARGS;
  result?: RESULT;
  error?: string;
  cancelled?: boolean;
}

export interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data' | 'tool';
  parts: Array<TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart>;
  meta?: UiMessageMeta;
}

export type TextUIPart = {
  type: 'text';
  text: string;
};

export type ReasoningUIPart = {
  type: 'reasoning';
  reasoning: string;
  details: Array<
    | {
        type: 'text';
        text: string;
        signature?: string;
      }
    | {
        type: 'redacted';
        data: string;
      }
  >;
};

export type ToolInvocationUIPart = {
  type: 'tool-invocation';
  toolInvocation: ToolInvocation;
};

export type SourceUIPart = {
  type: 'source';
  source: LanguageModelV1Source;
};

export type FileUIPart = {
  type: 'file';
  mimeType: string;
  data: string;
};

export type StepStartUIPart = {
  type: 'step-start';
};

export type UiMessageRole = UIMessage['role'];
export type UiMessage = UIMessage;
export type UiMessagePart = UIMessage['parts'][number];
export type UiMessageTextPart = TextUIPart;
export type UiMessageReasoningPart = ReasoningUIPart;
export type UiMessageToolInvocationPart = ToolInvocationUIPart;
export type UiMessageSourcePart = SourceUIPart;
export type UiMessageFilePart = FileUIPart;
export type UiMessageStepStartPart = StepStartUIPart;

export type UiMessageSource = 'history' | 'stream' | 'optimistic' | 'local';
export type UiMessageStatus = 'pending' | 'streaming' | 'final' | 'error';

export type UiMessageMeta = {
  seq?: number;
  status?: UiMessageStatus;
  source?: UiMessageSource;
  runId?: string;
  sessionKey?: string;
  timestamp?: string;
  isDraft?: boolean;
};
