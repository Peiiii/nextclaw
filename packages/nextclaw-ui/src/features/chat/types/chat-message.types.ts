export type ChatMessageAdapterTexts = {
  roleLabels: {
    user: string;
    assistant: string;
    tool: string;
    system: string;
    fallback: string;
  };
  reasoningLabel: string;
  toolCallLabel: string;
  toolResultLabel: string;
  toolInputLabel: string;
  toolNoOutputLabel: string;
  toolOutputLabel: string;
  toolStatusPreparingLabel: string;
  toolStatusRunningLabel: string;
  toolStatusCompletedLabel: string;
  toolStatusFailedLabel: string;
  toolStatusCancelledLabel: string;
  imageAttachmentLabel: string;
  fileAttachmentLabel: string;
  unknownPartLabel: string;
};

export type ChatMessagePartSource =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "file";
      mimeType: string;
      data: string;
      url?: string;
      name?: string;
      sizeBytes?: number;
    }
  | {
      type: "reasoning";
      reasoning: string;
    }
  | {
      type: "tool-invocation";
      toolInvocation: {
        status?: string;
        toolName: string;
        args?: unknown;
        parsedArgs?: unknown;
        result?: unknown;
        error?: string;
        cancelled?: boolean;
        toolCallId?: string;
      };
    }
  | {
      type: string;
      [key: string]: unknown;
    };
